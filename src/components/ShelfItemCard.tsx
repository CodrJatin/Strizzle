"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { 
  MoreVertical, Link2, Play, FileText, FileArchive, FileAudio, File, 
  ExternalLink, Folder, Trash, Download, Calendar, Loader2
} from "lucide-react";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/routers/root";
import { api } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useConfirmStore } from "@/store/confirmStore";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

function Youtube(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type ShelfItem = RouterOutputs["shelf"]["getShelfItems"][number];

interface ShelfItemCardProps {
  item?: ShelfItem;
  onActionClick?: (item: ShelfItem) => void;
  isShimmer?: boolean;
}

// Format date to a friendly relative time or absolute date
function formatTimeAgo(dateInput: Date | string) {
  const date = new Date(dateInput);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Format byte size to readable string
function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Get file type icon and theme class
function getFileDetails(mimeType: string | null) {
  if (!mimeType) return { icon: File, color: "text-muted-foreground bg-muted" };
  
  const mime = mimeType.toLowerCase();
  if (mime.includes("pdf")) {
    return { icon: FileText, color: "text-red-500 bg-red-500/10 border-red-500/20" };
  }
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar") || mime.includes("7z")) {
    return { icon: FileArchive, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
  }
  if (mime.includes("audio") || mime.includes("mp3") || mime.includes("wav") || mime.includes("ogg")) {
    return { icon: FileAudio, color: "text-violet-500 bg-violet-500/10 border-violet-500/20" };
  }
  return { icon: File, color: "text-primary bg-primary/10 border-primary/20" };
}

export function ShelfItemCard({ item, onActionClick, isShimmer = false }: ShelfItemCardProps) {
  const utils = api.useUtils();
  const supabase = createClient();
  const confirm = useConfirmStore((s) => s.confirm);
  const [actionsOpen, setActionsOpen] = React.useState(false);

  // Mutations for quick desk operations
  const deleteShelfItem = api.shelf.deleteShelfItem.useMutation({
    onMutate: async (variables) => {
      // Cancel queries
      await utils.shelf.getShelfItems.cancel();
      // Snapshot
      const previous = utils.shelf.getShelfItems.getData();
      // Optimistic update
      utils.shelf.getShelfItems.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter(i => i.id !== variables.id);
      });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        utils.shelf.getShelfItems.setData(undefined, context.previous);
      }
      toast.error("Failed to remove item from desk");
    },
    onSuccess: () => {
      toast.success("Removed item from desk");
    },
    onSettled: () => {
      utils.shelf.getShelfItems.invalidate();
    }
  });

  const moveToLibrary = api.shelf.moveToLibrary.useMutation({
    onMutate: async (variables) => {
      await utils.shelf.getShelfItems.cancel();
      const previous = utils.shelf.getShelfItems.getData();
      utils.shelf.getShelfItems.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter(i => i.id !== variables.shelfItemId);
      });
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        utils.shelf.getShelfItems.setData(undefined, context.previous);
      }
      toast.error("Failed to move item to library");
    },
    onSuccess: () => {
      toast.success("Moved item to your library");
      utils.library.getLibraryMaterials.invalidate();
    },
    onSettled: () => {
      utils.shelf.getShelfItems.invalidate();
    }
  });

  // Render Skeleton Shimmer state
  if (isShimmer || !item) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-sm animate-pulse">
        <div className="flex justify-between items-start">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    );
  }

  const { material } = item;
  const isPendingMutation = deleteShelfItem.isPending || moveToLibrary.isPending;

  // Actions
  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: "Remove Item",
      description: `Are you sure you want to remove "${material.title || material.fileName || "this item"}" from your desk?`,
      confirmText: "Remove",
      variant: "destructive",
    });
    if (confirmed) {
      deleteShelfItem.mutate({ id: item.id });
    }
  };

  const handleMoveToLibrary = (e: React.MouseEvent) => {
    e.stopPropagation();
    moveToLibrary.mutate({ shelfItemId: item.id });
  };

  const handleOpenActionModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    onActionClick?.(item);
  };

  // Generate public URL for images/files in storage
  const fileUrl = material.storagePath
    ? supabase.storage.from("materials").getPublicUrl(material.storagePath).data.publicUrl
    : null;

  // Render the specific card type
  const renderCardContent = () => {
    switch (material.contentType) {
      case "text":
        return (
          <div className="flex flex-col justify-between h-full p-5 pl-6 border-l-4 border-l-primary/80 bg-card">
            <div className="space-y-2.5">
              <h3 className="font-semibold text-foreground text-base tracking-tight leading-snug line-clamp-2">
                {material.title || "Untitled Note"}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap line-clamp-5">
                {material.body}
              </p>
            </div>
            
            <div className="mt-4 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" />
                {formatTimeAgo(item.createdAt)}
              </span>
              {material.tags && material.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 max-w-[60%] justify-end">
                  {material.tags.slice(0, 2).map((tag, idx) => (
                    <span 
                      key={idx} 
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/30 truncate max-w-[80px]"
                      title={tag}
                    >
                      {tag}
                    </span>
                  ))}
                  {material.tags.length > 2 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-muted text-muted-foreground">
                      +{material.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case "link":
        const linkImage = material.ogImage;
        const linkFavicon = material.ogDomain 
          ? `https://www.google.com/s2/favicons?domain=${material.ogDomain}&sz=32`
          : null;
        
        return (
          <div className="flex flex-col h-full bg-card overflow-hidden">
            {/* OG image or fallback gradient */}
            <div className="h-36 relative overflow-hidden bg-muted flex items-center justify-center shrink-0 border-b border-border/40">
              {linkImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={linkImage} 
                  alt={material.ogTitle || "Preview"} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/5 via-primary/10 to-transparent flex items-center justify-center">
                  <Link2 className="size-8 text-primary/40" />
                </div>
              )}
              
              {material.ogDomain && (
                <div className="absolute bottom-2.5 left-2.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-medium flex items-center gap-1.5 shadow-sm">
                  {linkFavicon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={linkFavicon} 
                      alt="" 
                      className="size-3 rounded-sm object-contain bg-white"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <Link2 className="size-2.5" />
                  )}
                  <span className="truncate max-w-[120px]">{material.ogDomain}</span>
                </div>
              )}
            </div>

            <div className="flex-1 p-4 flex flex-col justify-between">
              <div className="space-y-1.5">
                <a 
                  href={material.url || "#"} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="group/link flex items-start gap-1 font-semibold text-foreground text-sm hover:text-primary transition-colors leading-snug line-clamp-2"
                >
                  <span>{material.title}</span>
                  <ExternalLink className="size-3.5 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity mt-0.5 text-primary" />
                </a>
                {material.ogDescription && (
                  <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                    {material.ogDescription}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" />
                  {formatTimeAgo(item.createdAt)}
                </span>
                {material.tags && material.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-w-[60%] justify-end">
                    {material.tags.slice(0, 2).map((tag, idx) => (
                      <span 
                        key={idx} 
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/30 truncate max-w-[80px]"
                        title={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "youtube":
        const ytImage = material.ogImage;
        return (
          <div className="flex flex-col h-full bg-card overflow-hidden">
            {/* Youtube Thumbnail with centered play icon */}
            <div className="h-36 relative overflow-hidden bg-black flex items-center justify-center shrink-0 border-b border-border/40">
              {ytImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={ytImage} 
                  alt={material.title || "Youtube Video"} 
                  className="w-full h-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-red-600/10 to-transparent flex items-center justify-center">
                  <Youtube className="size-10 text-red-600/40" />
                </div>
              )}
              {/* Play Button Overlay */}
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center transition-colors group-hover:bg-black/25">
                <div className="flex items-center justify-center size-11 rounded-full backdrop-blur-md bg-black/45 border border-white/20 text-white shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary/20">
                  <Play className="size-4 fill-current ml-0.5" />
                </div>
              </div>
              
              <div className="absolute bottom-2.5 left-2.5 px-2 py-1 rounded-lg bg-red-600/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                <Youtube className="size-3 fill-current" />
                <span>YouTube</span>
              </div>
            </div>

            <div className="flex-1 p-4 flex flex-col justify-between">
              <div className="space-y-1.5">
                <a 
                  href={material.url || "#"} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="group/link flex items-start gap-1 font-semibold text-foreground text-sm hover:text-primary transition-colors leading-snug line-clamp-2"
                >
                  <span>{material.title}</span>
                  <ExternalLink className="size-3.5 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity mt-0.5 text-primary" />
                </a>
                {material.ogDescription && (
                  <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                    {material.ogDescription}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" />
                  {formatTimeAgo(item.createdAt)}
                </span>
                {material.tags && material.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-w-[60%] justify-end">
                    {material.tags.slice(0, 2).map((tag, idx) => (
                      <span 
                        key={idx} 
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/30 truncate max-w-[80px]"
                        title={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "file":
        const fileDetails = getFileDetails(material.mimeType);
        const FileIcon = fileDetails.icon;
        
        return (
          <div className="flex flex-col justify-between h-full p-5 bg-card">
            <div className="space-y-4">
              <div className={cn("flex items-center gap-3 p-3 rounded-xl border", fileDetails.color)}>
                <FileIcon className="size-6 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground leading-snug truncate" title={material.fileName || "File"}>
                    {material.fileName || "Unknown File"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide font-medium">
                    {material.mimeType?.split("/")[1] || "File"}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-semibold text-foreground text-sm tracking-tight leading-snug truncate">
                  {material.title || material.fileName}
                </h3>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Size: {material.fileSize ? formatBytes(material.fileSize) : "Unknown"}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" />
                  {formatTimeAgo(item.createdAt)}
                </span>
                {fileUrl && (
                  <a 
                    href={`${fileUrl}?download`}
                    onClick={(e) => e.stopPropagation()}
                    download={material.fileName || "download"} 
                    className="p-1 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground flex items-center justify-center"
                    title="Download File"
                  >
                    <Download className="size-3" />
                  </a>
                )}
              </div>
              {material.tags && material.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 max-w-[60%] justify-end">
                  {material.tags.slice(0, 2).map((tag, idx) => (
                    <span 
                      key={idx} 
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/30 truncate max-w-[80px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case "image":
        const imgUrl = fileUrl || material.ogImage || "";
        
        return (
          <div className="flex flex-col justify-end h-64 relative overflow-hidden bg-neutral-950 text-white">
            {/* Full-bleed background image */}
            {imgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={imgUrl} 
                alt={material.title || "Uploaded Image"} 
                className="w-full h-full object-cover absolute inset-0 transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950 flex items-center justify-center">
                <File className="size-12 text-neutral-700" />
              </div>
            )}
            
            {/* Top right gradient block to overlay dropdown button contrast */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-black/60 to-transparent pointer-events-none z-10" />

            {/* Bottom gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />

            {/* Overlaid contents */}
            <div className="p-4 relative z-20 space-y-2">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-primary tracking-wider uppercase">
                  Image Capture
                </p>
                <h3 className="font-semibold text-white text-sm tracking-tight leading-snug line-clamp-2">
                  {material.title || material.fileName || "Captured Image"}
                </h3>
              </div>

              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[9px] font-medium text-white/70 flex items-center gap-1">
                  <Calendar className="size-2.5" />
                  {formatTimeAgo(item.createdAt)}
                </span>
                {material.tags && material.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-w-[60%] justify-end">
                    {material.tags.slice(0, 2).map((tag, idx) => (
                      <span 
                        key={idx} 
                        className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-white/10 text-white/90 border border-white/10 truncate max-w-[70px]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Unknown material type: {material.contentType}</p>
          </div>
        );
    }
  };

  const isLightText = material.contentType === "image";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full relative group cursor-pointer",
        isPendingMutation && "opacity-50 pointer-events-none"
      )}
      onClick={handleOpenActionModal}
    >
      {/* Three dots overlay trigger (top-right absolute) */}
      <div className="absolute top-2.5 right-2.5 z-30">
        <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-lg border bg-card/85 backdrop-blur-md shadow-sm transition-all focus-visible:ring-1",
                isLightText 
                  ? "border-white/15 text-white hover:bg-white/15 hover:text-white"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                actionsOpen ? "opacity-100 scale-100" : "opacity-0 group-hover:opacity-100 scale-95 hover:scale-100"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="size-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem 
              onClick={handleOpenActionModal}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium"
            >
              <ExternalLink className="size-4 text-muted-foreground" />
              <span>Organize...</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleMoveToLibrary}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium"
            >
              <Folder className="size-4 text-muted-foreground" />
              <span>Move to Library</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1 border-border" />
            <DropdownMenuItem 
              onClick={handleRemove}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
            >
              {isPendingMutation ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash className="size-4 text-destructive" />
              )}
              <span>Remove from Desk</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 h-full">
        {renderCardContent()}
      </div>
    </motion.div>
  );
}
