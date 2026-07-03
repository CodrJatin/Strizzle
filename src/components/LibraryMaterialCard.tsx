"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { 
  Star, Trash2, ExternalLink, Download, Share2, 
  HelpCircle, FileText, FileArchive, FileAudio, File, 
  Link2, Calendar, LayoutGrid, Eye, Tag, CheckCircle2, Loader2
} from "lucide-react";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";

import { useMaterialCache } from "@/hooks/useMaterialCache";

import type { AppRouter } from "@/server/routers/root";
import { api } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type LibraryItem = RouterOutputs["library"]["getLibraryMaterials"]["items"][number];

interface LibraryMaterialCardProps {
  item?: LibraryItem;
  viewMode: "grid" | "list";
  onDeleteClick?: (item: LibraryItem) => void;
  onTextOpenClick?: (item: LibraryItem) => void;
  queryFilter?: {
    limit?: number;
    search?: string;
    starredOnly?: boolean;
    contentType?: "text" | "link" | "youtube" | "file" | "image";
    sortBy?: "addedAt" | "title";
    sortOrder?: "asc" | "desc";
  };
  isShimmer?: boolean;
}

// Format relative date
function formatRelativeTime(dateInput: Date | string) {
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

// Format bytes
function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Get file specific settings
function getFileMeta(mimeType: string | null) {
  if (!mimeType) return { icon: File, color: "text-muted-foreground bg-muted border-border/30" };
  const mime = mimeType.toLowerCase();
  if (mime.includes("pdf")) {
    return { icon: FileText, color: "text-red-500 bg-red-500/10 border-red-500/20" };
  }
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar") || mime.includes("7z")) {
    return { icon: FileArchive, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
  }
  if (mime.includes("audio") || mime.includes("mp3") || mime.includes("wav")) {
    return { icon: FileAudio, color: "text-violet-500 bg-violet-500/10 border-violet-500/20" };
  }
  return { icon: File, color: "text-primary bg-primary/10 border-primary/20" };
}

// Custom Youtube SVG
function YoutubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function LibraryMaterialCard({ 
  item, 
  viewMode, 
  onDeleteClick, 
  onTextOpenClick,
  queryFilter,
  isShimmer = false 
}: LibraryMaterialCardProps) {
  const utils = api.useUtils();
  const supabase = createClient();
  const { isCached, isDownloading, downloadMaterial } = useMaterialCache();

  const qFilter = queryFilter || { limit: 18 };

  // Optimistic Star/Unstar Mutations
  const starMutation = api.library.starMaterial.useMutation({
    onMutate: async (variables) => {
      await utils.library.getLibraryMaterials.cancel(qFilter);
      const previousInfinite = utils.library.getLibraryMaterials.getInfiniteData(qFilter);
      const previousStandard = utils.library.getLibraryMaterials.getData(qFilter);
      
      // Update infinite query data
      if (previousInfinite) {
        utils.library.getLibraryMaterials.setInfiniteData(qFilter, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: { items: LibraryItem[]; nextCursor?: string }) => ({
              ...page,
              items: page.items.map((i: LibraryItem) =>
                i.material.id === variables.materialId ? { ...i, starred: true } : i
              ),
            })),
          };
        });
      }

      // Update standard query data
      if (previousStandard) {
        utils.library.getLibraryMaterials.setData(qFilter, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((i: LibraryItem) =>
              i.material.id === variables.materialId ? { ...i, starred: true } : i
            ),
          };
        });
      }

      return { previousInfinite, previousStandard };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousInfinite) {
        utils.library.getLibraryMaterials.setInfiniteData(qFilter, context.previousInfinite);
      }
      if (context?.previousStandard) {
        utils.library.getLibraryMaterials.setData(qFilter, context.previousStandard);
      }
      toast.error("Failed to star material");
    },
    onSuccess: () => {
      toast.success("Material starred");
    },
    onSettled: () => {
      utils.library.getLibraryMaterials.invalidate(qFilter);
    }
  });

  const unstarMutation = api.library.unstarMaterial.useMutation({
    onMutate: async (variables) => {
      await utils.library.getLibraryMaterials.cancel(qFilter);
      const previousInfinite = utils.library.getLibraryMaterials.getInfiniteData(qFilter);
      const previousStandard = utils.library.getLibraryMaterials.getData(qFilter);
      
      // Update infinite query data
      if (previousInfinite) {
        utils.library.getLibraryMaterials.setInfiniteData(qFilter, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: { items: LibraryItem[]; nextCursor?: string }) => ({
              ...page,
              items: page.items.map((i: LibraryItem) =>
                i.material.id === variables.materialId ? { ...i, starred: false } : i
              ),
            })),
          };
        });
      }

      // Update standard query data
      if (previousStandard) {
        utils.library.getLibraryMaterials.setData(qFilter, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((i: LibraryItem) =>
              i.material.id === variables.materialId ? { ...i, starred: false } : i
            ),
          };
        });
      }

      return { previousInfinite, previousStandard };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousInfinite) {
        utils.library.getLibraryMaterials.setInfiniteData(qFilter, context.previousInfinite);
      }
      if (context?.previousStandard) {
        utils.library.getLibraryMaterials.setData(qFilter, context.previousStandard);
      }
      toast.error("Failed to unstar material");
    },
    onSuccess: () => {
      toast.success("Material unstarred");
    },
    onSettled: () => {
      utils.library.getLibraryMaterials.invalidate(qFilter);
    }
  });

  // Render Shimmer skeleton loading
  if (isShimmer || !item) {
    if (viewMode === "list") {
      return (
        <div className="flex items-center justify-between border border-border/80 bg-card p-4 rounded-xl shadow-xs animate-pulse">
          <div className="flex items-center gap-3 w-1/3 min-w-0">
            <Skeleton className="size-8.5 rounded-lg shrink-0" />
            <Skeleton className="h-4 w-full rounded" />
          </div>
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-sm animate-pulse">
        <div className="flex justify-between items-start">
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="size-8 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-4/5 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
        </div>
        <div className="flex items-center gap-1.5 pt-2">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
    );
  }

  const { material, starred, addedAt } = item;
  const isStarredPending = starMutation.isPending || unstarMutation.isPending;

  const handleStarToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isStarredPending) return;
    if (starred) {
      unstarMutation.mutate({ materialId: material.id });
    } else {
      starMutation.mutate({ materialId: material.id });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteClick?.(item);
  };

  // Generate public download URL if file/image in storage
  const fileUrl = material.storagePath
    ? supabase.storage.from("materials").getPublicUrl(material.storagePath).data.publicUrl
    : null;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (material.contentType === "text" || material.contentType === "image") {
      if (onTextOpenClick) {
        onTextOpenClick(item);
      } else {
        if (material.contentType === "text") {
          toast.info(`Text note content:\n\n${material.body}`);
        } else if (fileUrl) {
          window.open(fileUrl, "_blank", "noopener,noreferrer");
        }
      }
    } else if (material.url) {
      window.open(material.url, "_blank", "noopener,noreferrer");
    } else if (fileUrl) {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileUrl) {
      const link = document.createElement("a");
      link.href = `${fileUrl}?download`;
      link.download = material.fileName || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (material.url) {
      window.open(material.url, "_blank", "noopener,noreferrer");
    }
  };

  // Render type specific icons
  const renderTypeIcon = (size = "size-4") => {
    switch (material.contentType) {
      case "text":
        return <FileText className={cn(size, "text-emerald-500")} />;
      case "link":
        return <Link2 className={cn(size, "text-primary")} />;
      case "youtube":
        return <YoutubeIcon className={cn(size, "text-red-500")} />;
      case "file":
        return <FileText className={cn(size, "text-blue-500")} />;
      case "image":
        return <LayoutGrid className={cn(size, "text-indigo-500")} />;
      default:
        return <File className={size} />;
    }
  };

  // Render content preview inside grid layout
  const renderGridContent = () => {
    switch (material.contentType) {
      case "text":
        return (
          <div className="p-5 pl-6 border-l-4 border-l-emerald-500/80 bg-card h-full flex flex-col justify-between">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-emerald-500 tracking-wider uppercase">Text Note</span>
              <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">{material.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-4">{material.body}</p>
            </div>
            <div className="text-[10px] font-medium text-muted-foreground pt-4 border-t border-border/30 mt-4 flex justify-between items-center">
              <span>Added {formatRelativeTime(addedAt)}</span>
              {starred && <Star className="size-3.5 fill-yellow-400 text-yellow-500" />}
            </div>
          </div>
        );

      case "link":
      case "youtube":
        const isYoutube = material.contentType === "youtube";
        const ogImage = material.ogImage;
        return (
          <div className="flex flex-col h-full bg-card">
            <div className="h-32 bg-muted relative overflow-hidden shrink-0 border-b border-border/40">
              {ogImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={ogImage} 
                  alt="" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/5 via-primary/10 to-transparent flex items-center justify-center">
                  {isYoutube ? <YoutubeIcon className="size-8 text-red-500/40" /> : <Link2 className="size-8 text-primary/40" />}
                </div>
              )}
              <div className={cn(
                "absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md text-[9px] font-bold shadow-xs text-white",
                isYoutube ? "bg-red-600" : "bg-black/60 backdrop-blur-xs"
              )}>
                {isYoutube ? "YouTube" : material.ogDomain || "Web link"}
              </div>
            </div>
            <div className="flex-1 p-4 flex flex-col justify-between">
              <div className="space-y-1.5">
                <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">{material.title}</h3>
                {material.ogDescription && (
                  <p className="text-muted-foreground text-[11px] leading-normal line-clamp-2">{material.ogDescription}</p>
                )}
              </div>
              <div className="text-[10px] font-medium text-muted-foreground pt-3 border-t border-border/30 mt-3 flex justify-between items-center">
                <span>Added {formatRelativeTime(addedAt)}</span>
                {starred && <Star className="size-3.5 fill-yellow-400 text-yellow-500" />}
              </div>
            </div>
          </div>
        );

      case "file":
      case "image":
        const isImage = material.contentType === "image";
        const fileDetails = getFileMeta(material.mimeType);
        const FileIcon = fileDetails.icon;
        const imgUrl = fileUrl || material.ogImage || "";

        return (
          <div className="flex flex-col h-full bg-card">
            {isImage && imgUrl ? (
              <div className="h-32 bg-muted relative overflow-hidden shrink-0 border-b border-border/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={imgUrl} 
                  alt="" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md text-[9px] font-bold shadow-xs text-white bg-black/60 backdrop-blur-xs">
                  Image
                </div>
              </div>
            ) : (
              <div className="p-4 bg-muted/20 shrink-0 border-b border-border/40 flex items-center gap-3">
                <div className={cn("p-2 rounded-lg border", fileDetails.color)}>
                  <FileIcon className="size-5 shrink-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{material.fileName}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium mt-0.5">
                    {material.mimeType?.split("/")[1] || "file"}
                  </p>
                </div>
              </div>
            )}
            <div className="flex-1 p-4 flex flex-col justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground text-sm leading-snug truncate">{material.title || material.fileName}</h3>
                <p className="text-muted-foreground text-[10px]">
                  Size: {material.fileSize ? formatBytes(material.fileSize) : "Unknown"}
                </p>
              </div>
              <div className="text-[10px] font-medium text-muted-foreground pt-3 border-t border-border/30 mt-3 flex justify-between items-center">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">Added {formatRelativeTime(addedAt)}</span>
                  {isCached(fileUrl) && (
                    <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-200/30 dark:border-emerald-800/30 uppercase tracking-wide shrink-0">
                      Offline
                    </span>
                  )}
                </div>
                {starred && <Star className="size-3.5 fill-yellow-400 text-yellow-500 shrink-0" />}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Render Grid View
  if (viewMode === "grid") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between h-64 relative group cursor-pointer"
        onClick={handleOpen}
      >
        {/* Hover Overlay Action Menu */}
        <div className="absolute inset-0 bg-background/90 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 flex flex-col items-center justify-center gap-4 p-4">
          <div className="text-center space-y-1 max-w-full px-4">
            <h4 className="font-bold text-sm text-foreground truncate max-w-[200px]" title={material.title || material.fileName || ""}>
              {material.title || material.fileName}
            </h4>
            <p className="text-[10px] text-muted-foreground capitalize">
              {material.contentType} • Added {formatRelativeTime(addedAt)}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Open / Download Action */}
            {(material.contentType === "file" || material.contentType === "image") ? (
              isCached(fileUrl) ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-xl border-emerald-500/30 bg-emerald-50/55 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 pointer-events-none"
                  title="Available Offline"
                >
                  <CheckCircle2 className="size-4.5" />
                </Button>
              ) : isDownloading(material.id) ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-xl border-border/60"
                  disabled
                >
                  <Loader2 className="size-4.5 animate-spin" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fileUrl) downloadMaterial(material.id, fileUrl);
                  }}
                  className="size-9 rounded-xl border-border/60 hover:bg-primary/10 hover:text-primary hover:border-primary/20"
                  title="Download for Offline"
                >
                  <Download className="size-4.5" />
                </Button>
              )
            ) : (
              <Button
                variant="outline"
                size="icon"
                onClick={handleOpen}
                className="size-9 rounded-xl border-border/60 hover:bg-primary/10 hover:text-primary hover:border-primary/20"
                title="Open Resource"
              >
                <ExternalLink className="size-4.5" />
              </Button>
            )}
            
            {/* Star Action */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleStarToggle}
              className={cn(
                "size-9 rounded-xl border-border/60",
                starred 
                  ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-500 hover:bg-yellow-400/20" 
                  : "hover:bg-yellow-400/10 hover:text-yellow-500 hover:border-yellow-400/20"
              )}
              title={starred ? "Unstar Material" : "Star Material"}
            >
              <Star className={cn("size-4.5", starred && "fill-current")} />
            </Button>

            {/* Share (Mock) */}
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => { e.stopPropagation(); toast.info("Hive sharing features are coming in Phase 3!"); }}
              className="size-9 rounded-xl border-border/60 hover:bg-indigo-500/10 hover:text-indigo-500 hover:border-indigo-500/20 text-muted-foreground"
              title="Share to Hive"
            >
              <Share2 className="size-4.5" />
            </Button>

            {/* Delete Action */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleDelete}
              className="size-9 rounded-xl border-border/60 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 text-muted-foreground"
              title="Delete Material"
            >
              <Trash2 className="size-4.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 h-full">
          {renderGridContent()}
        </div>
      </motion.div>
    );
  }

  // Render List View Row
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between border border-border/60 bg-card p-4 rounded-xl hover:border-primary/20 transition-all gap-4 group/list-row relative"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer" onClick={handleOpen}>
        <div className="size-9 rounded-xl border border-border/50 bg-muted/40 flex items-center justify-center shrink-0">
          {renderTypeIcon("size-5")}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground truncate pr-6 sm:pr-0">
            {material.title || material.fileName}
          </h4>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground mt-0.5">
            <span className="capitalize">{material.contentType}</span>
            {material.ogDomain && <span>• {material.ogDomain}</span>}
            {material.fileSize && <span>• {formatBytes(material.fileSize)}</span>}
            {material.tags && material.tags.length > 0 && (
              <span className="flex items-center gap-1">
                • <Tag className="size-2.5 text-muted-foreground" /> {material.tags.slice(0, 2).join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-border/40 pt-2 sm:pt-0">
        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
          <Calendar className="size-3" />
          Added {formatRelativeTime(addedAt)}
        </span>

        <div className="flex items-center gap-1.5">
          {/* Open Button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleOpen}
            className="size-8 rounded-lg text-muted-foreground hover:bg-muted"
            title="Open / Preview Resource"
          >
            <Eye className="size-4" />
          </Button>

          {/* Download/Offline Button (for files/images) */}
          {(material.contentType === "file" || material.contentType === "image") && (
            isCached(fileUrl) ? (
              <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-lg border border-emerald-200/30 dark:border-emerald-800/30 uppercase tracking-wide flex items-center gap-1 shrink-0">
                <CheckCircle2 className="size-3.5" /> Offline
              </span>
            ) : isDownloading(material.id) ? (
              <Button
                variant="ghost"
                size="icon-sm"
                disabled
                className="size-8 rounded-lg text-muted-foreground"
              >
                <Loader2 className="size-4 animate-spin" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (fileUrl) downloadMaterial(material.id, fileUrl);
                }}
                className="size-8 rounded-lg text-muted-foreground hover:bg-muted"
                title="Download for Offline"
              >
                <Download className="size-4" />
              </Button>
            )
          )}

          {/* Star Button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleStarToggle}
            className={cn(
              "size-8 rounded-lg",
              starred ? "text-yellow-500 hover:bg-yellow-500/10" : "text-muted-foreground hover:bg-muted"
            )}
            title={starred ? "Unstar" : "Star"}
          >
            <Star className={cn("size-4", starred && "fill-current")} />
          </Button>

          {/* Share Button (Mock) */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); toast.info("Hive sharing features are coming in Phase 3!"); }}
            className="size-8 rounded-lg text-muted-foreground hover:bg-muted"
            title="Share to Hive"
          >
            <Share2 className="size-4" />
          </Button>

          {/* Delete Button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDelete}
            className="size-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Delete Material"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
