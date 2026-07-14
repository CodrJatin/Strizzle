"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { 
  Star, ExternalLink, Download, FileText, FileArchive, 
  FileAudio, File, Link2, LayoutGrid, Eye, Loader2, Check 
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MaterialFeedItemProps {
  material: {
    id: string;
    contentType: "text" | "link" | "youtube" | "file" | "image";
    title: string | null;
    body: string | null;
    url: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    ogDomain: string | null;
    storagePath: string | null;
    fileName: string | null;
    fileSize: number | null;
    mimeType: string | null;
    tags: string[];
    createdAt: Date | string;
  };
  onPreviewClick?: (material: any) => void;
}

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

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

function YoutubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function MaterialFeedItem({ material, onPreviewClick }: MaterialFeedItemProps) {
  const supabase = createClient();
  const [isSaved, setIsSaved] = React.useState(false);

  const saveMutation = api.library.addToLibrary.useMutation({
    onSuccess: () => {
      setIsSaved(true);
      toast.success("Added to your personal library!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save material.");
    }
  });

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaved || saveMutation.isPending) return;
    saveMutation.mutate({ materialId: material.id });
  };

  const fileUrl = material.storagePath
    ? supabase.storage.from("materials").getPublicUrl(material.storagePath).data.publicUrl
    : null;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (material.contentType === "text" || material.contentType === "image") {
      onPreviewClick?.(material);
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
    }
  };

  const renderContent = () => {
    switch (material.contentType) {
      case "text":
        return (
          <div className="flex flex-col gap-2.5 p-4 pl-5 border-l-4 border-l-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/2 rounded-r-xl">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground leading-snug">{material.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-wrap">
                {material.body}
              </p>
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-border/30 mt-1 shrink-0">
              <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide">Text Note</span>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleOpen} 
                  variant="ghost" 
                  size="xs" 
                  className="h-7 text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Eye className="size-3 mr-1" /> View Full
                </Button>
                <Button 
                  onClick={handleSave} 
                  variant="outline" 
                  size="xs" 
                  disabled={isSaved || saveMutation.isPending}
                  className="h-7 text-[10px] font-semibold cursor-pointer border-emerald-500/20 hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : isSaved ? (
                    <><Check className="size-3 mr-1" /> Saved</>
                  ) : (
                    "Save to Library"
                  )}
                </Button>
              </div>
            </div>
          </div>
        );

      case "link":
      case "youtube":
        const isYoutube = material.contentType === "youtube";
        const imgUrl = material.ogImage;
        return (
          <div className="flex flex-col md:flex-row overflow-hidden border border-border/80 rounded-xl bg-card hover:bg-muted/10 transition-all duration-200">
            {imgUrl ? (
              <div className="relative w-full md:w-36 h-24 bg-muted shrink-0 border-b md:border-b-0 md:border-r border-border/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={imgUrl} 
                  alt="" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className={cn(
                  "absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold shadow-xs text-white",
                  isYoutube ? "bg-red-600" : "bg-black/60 backdrop-blur-xs"
                )}>
                  {isYoutube ? "YouTube" : material.ogDomain || "Link"}
                </div>
              </div>
            ) : (
              <div className="w-full md:w-36 h-24 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent flex items-center justify-center shrink-0 border-b md:border-b-0 md:border-r border-border/40">
                {isYoutube ? <YoutubeIcon className="size-7 text-red-500/40" /> : <Link2 className="size-7 text-primary/40" />}
              </div>
            )}
            
            <div className="flex-1 p-3.5 flex flex-col justify-between min-w-0 gap-2">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-1 truncate-hover" title={material.title || ""}>
                  {material.title}
                </h4>
                {material.ogDescription && (
                  <p className="text-[11px] text-muted-foreground leading-normal line-clamp-2">
                    {material.ogDescription}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 mt-auto">
                <span className="text-[9px] font-semibold text-muted-foreground truncate max-w-[120px]">
                  {material.ogDomain || (material.url && new URL(material.url).hostname) || "web-resource"}
                </span>
                
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleOpen} 
                    variant="ghost" 
                    size="xs" 
                    className="h-7 text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <ExternalLink className="size-3 mr-1" /> Open Link
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    variant="outline" 
                    size="xs" 
                    disabled={isSaved || saveMutation.isPending}
                    className="h-7 text-[10px] font-semibold cursor-pointer"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : isSaved ? (
                      <><Check className="size-3 mr-1" /> Saved</>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case "file":
      case "image":
        const isImage = material.contentType === "image";
        const fileDetails = getFileMeta(material.mimeType);
        const FileIcon = fileDetails.icon;
        const fallbackImg = fileUrl || material.ogImage || "";

        return (
          <div className="flex flex-col overflow-hidden border border-border/80 rounded-xl bg-card hover:bg-muted/10 transition-all duration-200">
            {isImage && fallbackImg ? (
              <div className="relative w-full h-32 bg-muted shrink-0 border-b border-border/40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={fallbackImg} 
                  alt="" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-bold shadow-xs text-white bg-black/60 backdrop-blur-xs">
                  Image
                </div>
              </div>
            ) : (
              <div className="p-3 bg-muted/20 shrink-0 border-b border-border/40 flex items-center gap-3">
                <div className={cn("p-1.5 rounded-lg border", fileDetails.color)}>
                  <FileIcon className="size-4.5 shrink-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">{material.fileName}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium mt-0.5">
                    {material.mimeType?.split("/")[1] || "file"}
                  </p>
                </div>
              </div>
            )}

            <div className="p-3 flex items-center justify-between bg-card gap-4">
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-foreground truncate">{material.title || material.fileName}</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Size: {material.fileSize ? formatBytes(material.fileSize) : "Unknown"}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isImage && (
                  <Button 
                    onClick={handleOpen} 
                    variant="ghost" 
                    size="xs" 
                    className="h-7 text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <Eye className="size-3 mr-1" /> Preview
                  </Button>
                )}
                {!isImage && fileUrl && (
                  <Button 
                    onClick={handleDownload} 
                    variant="ghost" 
                    size="xs" 
                    className="h-7 text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <Download className="size-3 mr-1" /> Download
                  </Button>
                )}
                <Button 
                  onClick={handleSave} 
                  variant="outline" 
                  size="xs" 
                  disabled={isSaved || saveMutation.isPending}
                  className="h-7 text-[10px] font-semibold cursor-pointer"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : isSaved ? (
                    <><Check className="size-3 mr-1" /> Saved</>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mt-2.5 w-full">
      {renderContent()}
    </div>
  );
}
