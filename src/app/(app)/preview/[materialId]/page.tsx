"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Star, Download, ExternalLink, Share2, 
  Loader2, AlertCircle, Calendar, FileText, CheckCircle2,
  Tag, Info, Eye, Play, Pause
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/youtube";

interface PageProps {
  params: Promise<{ materialId: string }>;
}

// Allowed YouTube speed levels
const SPEED_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// Utility to extract YouTube Video ID and return embed URL
function getYoutubeEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}?autoplay=0&rel=0`;
  }
  return null;
}

// Utility to extract Google Drive File ID and return preview URL
function getGoogleDriveEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  const regExp = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const match = url.match(regExp);
  if (match && match[1]) {
    return `https://drive.google.com/file/d/${match[1]}/preview`;
  }
  return null;
}

// Format bytes helper
function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default function MaterialPreviewPage({ params }: PageProps) {
  const { materialId } = React.use(params);
  const router = useRouter();
  const utils = api.useUtils();
  const supabase = createClient();

  // Fetch the material details
  const { data: material, isLoading, error } = api.material.getMaterial.useQuery(
    { id: materialId },
    { staleTime: 120000 } // Standard materials details: 2 minutes
  );

  const isPlaylist = material?.ytPlaylistId !== null && material?.contentType === "youtube";

  // Fetch playlist videos if applicable
  const { data: playlistVideos } = api.material.getPlaylistVideos.useQuery(
    { materialId },
    { enabled: !!material && isPlaylist, staleTime: 120000 }
  );

  // Video player states
  const [activeVideoId, setActiveVideoId] = React.useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = React.useState(1.0);
  const [playerReady, setPlayerReady] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);

  const playerRef = React.useRef<any>(null);
  const nextVideoRef = React.useRef<() => void>(() => {});
  const prevVideoRef = React.useRef<() => void>(() => {});

  // Set default active video
  React.useEffect(() => {
    if (isPlaylist && playlistVideos && playlistVideos.length > 0) {
      if (!activeVideoId) {
        setActiveVideoId(playlistVideos[0].videoId);
      }
    } else if (material && material.contentType === "youtube" && !material.ytPlaylistId) {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = material.url?.match(regExp);
      if (match && match[2].length === 11) {
        setActiveVideoId(match[2]);
      }
    }
  }, [playlistVideos, material, isPlaylist, activeVideoId]);

  // Next / Prev actions
  const handleNext = React.useCallback(() => {
    if (isPlaylist && playlistVideos && playlistVideos.length > 0) {
      const currentIndex = playlistVideos.findIndex(v => v.videoId === activeVideoId);
      if (currentIndex !== -1 && currentIndex < playlistVideos.length - 1) {
        setActiveVideoId(playlistVideos[currentIndex + 1].videoId);
        toast.info(`Playing next: ${playlistVideos[currentIndex + 1].title}`);
      } else {
        toast.info("End of playlist");
      }
    }
  }, [isPlaylist, playlistVideos, activeVideoId]);

  const handlePrev = React.useCallback(() => {
    if (isPlaylist && playlistVideos && playlistVideos.length > 0) {
      const currentIndex = playlistVideos.findIndex(v => v.videoId === activeVideoId);
      if (currentIndex > 0) {
        setActiveVideoId(playlistVideos[currentIndex - 1].videoId);
        toast.info(`Playing previous: ${playlistVideos[currentIndex - 1].title}`);
      } else {
        toast.info("First video in playlist");
      }
    }
  }, [isPlaylist, playlistVideos, activeVideoId]);

  // Keep references fresh for the iframe state change listener
  React.useEffect(() => {
    nextVideoRef.current = handleNext;
    prevVideoRef.current = handlePrev;
  }, [handleNext, handlePrev]);

  // Speed controls
  const handleDecreaseSpeed = React.useCallback(() => {
    const currentIndex = SPEED_LEVELS.indexOf(playbackRate);
    if (currentIndex > 0) {
      const newRate = SPEED_LEVELS[currentIndex - 1];
      setPlaybackRate(newRate);
      if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
        playerRef.current.setPlaybackRate(newRate);
      }
      toast.success(`Speed: ${newRate}x`);
    }
  }, [playbackRate]);

  const handleIncreaseSpeed = React.useCallback(() => {
    const currentIndex = SPEED_LEVELS.indexOf(playbackRate);
    if (currentIndex < SPEED_LEVELS.length - 1) {
      const newRate = SPEED_LEVELS[currentIndex + 1];
      setPlaybackRate(newRate);
      if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
        playerRef.current.setPlaybackRate(newRate);
      }
      toast.success(`Speed: ${newRate}x`);
    }
  }, [playbackRate]);

  // Instantiate YouTube Iframe API Player
  React.useEffect(() => {
    if (!activeVideoId) return;

    let active = true;
    let player: any = null;

    function initPlayer() {
      if (!active) return;
      
      const container = document.getElementById("yt-player");
      if (!container) return;

      player = new window.YT.Player("yt-player", {
        height: "100%",
        width: "100%",
        videoId: activeVideoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: any) => {
            if (active) {
              setPlayerReady(true);
              event.target.setPlaybackRate(playbackRate);
              try {
                event.target.playVideo();
              } catch (e) {}
            }
          },
          onStateChange: (event: any) => {
            if (active) {
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
              } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.BUFFERING) {
                setIsPlaying(false);
              } else if (event.data === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
                nextVideoRef.current();
              }
            }
          },
        },
      });
      playerRef.current = player;
    }

    if (!window.YT) {
      let tag = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!tag) {
        tag = document.createElement("script");
        (tag as HTMLScriptElement).src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const prevAPIReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevAPIReady) prevAPIReady();
        initPlayer();
      };
    } else {
      initPlayer();
    }

    return () => {
      active = false;
      setPlayerReady(false);
      setIsPlaying(false);
      if (player && typeof player.destroy === "function") {
        try {
          player.destroy();
        } catch (e) {
          console.error("Error destroying YT player:", e);
        }
      }
      playerRef.current = null;
    };
  }, [activeVideoId]);

  // Keyboard shortcuts event listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if in inputs
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (playerRef.current && typeof playerRef.current.getPlayerState === "function") {
          const state = playerRef.current.getPlayerState();
          if (state === 1) {
            playerRef.current.pauseVideo();
          } else {
            playerRef.current.playVideo();
          }
        }
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        nextVideoRef.current();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        prevVideoRef.current();
      } else if (e.key === ">" || (e.shiftKey && e.key === ".")) {
        e.preventDefault();
        handleIncreaseSpeed();
      } else if (e.key === "<" || (e.shiftKey && e.key === ",")) {
        e.preventDefault();
        handleDecreaseSpeed();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleIncreaseSpeed, handleDecreaseSpeed]);

  // Queries/Mutations Filters
  const qFilter = { limit: 18 };

  // Mutations
  const starMutation = api.library.starMaterial.useMutation({
    onMutate: async () => {
      await utils.material.getMaterial.cancel({ id: materialId });
      const previousMat = utils.material.getMaterial.getData({ id: materialId });
      
      if (previousMat) {
        utils.material.getMaterial.setData({ id: materialId }, {
          ...previousMat,
          inLibrary: true,
          starred: true,
        });
      }
      return { previousMat };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousMat) {
        utils.material.getMaterial.setData({ id: materialId }, ctx.previousMat);
      }
      toast.error("Failed to star material");
    },
    onSuccess: () => {
      toast.success("Material starred");
      utils.library.getLibraryMaterials.invalidate(qFilter);
    },
    onSettled: () => {
      utils.material.getMaterial.invalidate({ id: materialId });
    }
  });

  const unstarMutation = api.library.unstarMaterial.useMutation({
    onMutate: async () => {
      await utils.material.getMaterial.cancel({ id: materialId });
      const previousMat = utils.material.getMaterial.getData({ id: materialId });
      
      if (previousMat) {
        utils.material.getMaterial.setData({ id: materialId }, {
          ...previousMat,
          starred: false,
        });
      }
      return { previousMat };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousMat) {
        utils.material.getMaterial.setData({ id: materialId }, ctx.previousMat);
      }
      toast.error("Failed to unstar material");
    },
    onSuccess: () => {
      toast.success("Material unstarred");
      utils.library.getLibraryMaterials.invalidate(qFilter);
    },
    onSettled: () => {
      utils.material.getMaterial.invalidate({ id: materialId });
    }
  });

  const addToLibraryMutation = api.library.addToLibrary.useMutation({
    onMutate: async () => {
      await utils.material.getMaterial.cancel({ id: materialId });
      const previousMat = utils.material.getMaterial.getData({ id: materialId });
      
      if (previousMat) {
        utils.material.getMaterial.setData({ id: materialId }, {
          ...previousMat,
          inLibrary: true,
        });
      }
      return { previousMat };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousMat) {
        utils.material.getMaterial.setData({ id: materialId }, ctx.previousMat);
      }
      toast.error("Failed to add to library");
    },
    onSuccess: () => {
      toast.success("Copied to library!");
      utils.library.getLibraryMaterials.invalidate(qFilter);
    },
    onSettled: () => {
      utils.material.getMaterial.invalidate({ id: materialId });
    }
  });

  // Loading state skeleton
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="size-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-60 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Skeleton className="h-[60vh] w-full rounded-2xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !material) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 space-y-4 max-w-md mx-auto">
        <div className="size-14 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center shadow-sm">
          <AlertCircle className="size-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground">Failed to load resource</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error?.message || "This material doesn't exist or you don't have permission to view it."}
          </p>
        </div>
        <Button onClick={() => router.back()} variant="outline" className="rounded-xl px-4 mt-2">
          <ArrowLeft className="size-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  // File/Resource parameters
  const isYoutube = material.contentType === "youtube";
  const isGoogleDrive = !!getGoogleDriveEmbedUrl(material.url);
  const isPdf = material.mimeType === "application/pdf" || material.fileName?.endsWith(".pdf");
  
  const fileUrl = material.storagePath
    ? supabase.storage.from("materials").getPublicUrl(material.storagePath).data.publicUrl
    : null;

  // Determine Embed Target for non-YouTube resources
  let embedUrl: string | null = null;
  if (!isYoutube) {
    if (isGoogleDrive) {
      embedUrl = getGoogleDriveEmbedUrl(material.url);
    } else if (isPdf && fileUrl) {
      embedUrl = fileUrl;
    }
  }

  const handleStarToggle = () => {
    if (material.starred) {
      unstarMutation.mutate({ materialId: material.id });
    } else {
      starMutation.mutate({ materialId: material.id });
    }
  };

  const handleDownload = () => {
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation & Info Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3.5 min-w-0">
          <Button 
            onClick={() => router.back()} 
            variant="outline" 
            size="icon" 
            className="size-10 rounded-xl shrink-0 hover:bg-muted cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="size-4.5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground truncate" title={material.title || "Preview Resource"}>
              {material.title || material.fileName || "Preview Resource"}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              <span className="capitalize">{material.contentType}</span>
              {material.ytDuration !== null && material.ytDuration !== undefined && material.ytDuration > 0 && (
                <span>• Duration: {formatDuration(material.ytDuration)}</span>
              )}
              {material.ogDomain && <span>• {material.ogDomain}</span>}
              {material.fileSize && <span>• {formatBytes(material.fileSize)}</span>}
              {material.tags && material.tags.length > 0 && (
                <div className="flex items-center gap-1 ml-1.5">
                  <Tag className="size-3 text-muted-foreground" />
                  {material.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[9px] rounded-md font-semibold font-mono">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 select-none">
          {/* Star Toggle (available to library users) */}
          <Button
            onClick={handleStarToggle}
            variant="outline"
            size="sm"
            className={cn(
              "h-9.5 rounded-xl border-border/80 px-3 cursor-pointer text-xs font-semibold flex items-center gap-1.5",
              material.starred 
                ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-500 hover:bg-yellow-400/20" 
                : "hover:bg-yellow-400/10 hover:text-yellow-500 hover:border-yellow-400/20 text-muted-foreground"
            )}
            title={material.starred ? "Unstar Material" : "Star Material"}
          >
            <Star className={cn("size-4", material.starred && "fill-current")} />
            {material.starred ? "Starred" : "Star"}
          </Button>

          {/* Copy to Library (if not already owned/copied) */}
          {!material.inLibrary && (
            <Button
              onClick={() => addToLibraryMutation.mutate({ materialId: material.id })}
              variant="default"
              size="sm"
              disabled={addToLibraryMutation.isPending}
              className="h-9.5 rounded-xl px-3.5 cursor-pointer text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              {addToLibraryMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Share2 className="size-4" />
                  Copy to Library
                </>
              )}
            </Button>
          )}

          {/* Download File */}
          {(material.storagePath || material.url) && (
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="h-9.5 rounded-xl border-border/80 px-3 cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            >
              <Download className="size-4" />
              Download
            </Button>
          )}

          {/* Open Original */}
          {material.url && (
            <Button
              onClick={() => window.open(material.url!, "_blank", "noopener,noreferrer")}
              variant="outline"
              size="sm"
              className="h-9.5 rounded-xl border-border/80 px-3 cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            >
              <ExternalLink className="size-4" />
              Open Original
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Dynamic Preview Content */}
        <div className="lg:col-span-2 space-y-4">
          {isYoutube ? (
            <div className="space-y-4">
              <div className="relative w-full aspect-video overflow-hidden rounded-2xl border border-border/60 bg-black shadow-md">
                <div id="yt-player" className="w-full h-full" />
                {!playerReady && (
                  <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
                    <Loader2 className="size-8 animate-spin text-primary" />
                  </div>
                )}
              </div>

              {/* Player Custom Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/15 border border-border/50 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  {/* Prev / Next buttons for playlist */}
                  {isPlaylist && playlistVideos && playlistVideos.length > 0 && (
                    <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/40 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePrev}
                        className="h-8 text-xs font-semibold rounded-md"
                        disabled={playlistVideos.findIndex(v => v.videoId === activeVideoId) <= 0}
                      >
                        Previous
                      </Button>
                      <div className="h-4 w-px bg-border/60 mx-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleNext}
                        className="h-8 text-xs font-semibold rounded-md"
                        disabled={playlistVideos.findIndex(v => v.videoId === activeVideoId) >= playlistVideos.length - 1}
                      >
                        Next
                      </Button>
                    </div>
                  )}

                  {/* Playback speed stepper: < 1.00x > */}
                  <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/40 shrink-0 select-none">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleDecreaseSpeed}
                      className="size-8 rounded-md"
                      disabled={SPEED_LEVELS.indexOf(playbackRate) === 0}
                    >
                      &lt;
                    </Button>
                    <span className="text-xs font-mono font-bold px-2.5 min-w-[50px] text-center">
                      {playbackRate.toFixed(2)}x
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleIncreaseSpeed}
                      className="size-8 rounded-md"
                      disabled={SPEED_LEVELS.indexOf(playbackRate) === SPEED_LEVELS.length - 1}
                    >
                      &gt;
                    </Button>
                  </div>
                </div>

                {/* Keyboard shortcuts guide */}
                <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 font-medium bg-muted/20 px-3 py-1.5 rounded-xl border border-border/20">
                  <span className="flex items-center gap-1">
                    <kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-[9px] shadow-xs">Space</kbd> Play/Pause
                  </span>
                  {isPlaylist && (
                    <>
                      <span className="flex items-center gap-1">
                        <kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-[9px] shadow-xs">N</kbd> Next
                      </span>
                      <span className="flex items-center gap-1">
                        <kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-[9px] shadow-xs">P</kbd> Prev
                      </span>
                    </>
                  )}
                  <span className="flex items-center gap-1">
                    <kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-[9px] shadow-xs">&gt;</kbd> Faster
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="bg-background border border-border px-1.5 py-0.5 rounded text-[9px] shadow-xs">&lt;</kbd> Slower
                  </span>
                </div>
              </div>
            </div>
          ) : embedUrl ? (
            <div className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20 shadow-md">
              <iframe
                src={embedUrl}
                title={material.title || "Document Preview"}
                className="w-full h-[65vh] border-none"
                allow="autoplay"
              />
            </div>
          ) : (
            <Card className="border-border/60 shadow-md bg-card rounded-2xl">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-5">
                <div className="size-16 rounded-2xl bg-primary/5 text-primary border border-primary/10 flex items-center justify-center shadow-inner">
                  <ExternalLink className="size-7" />
                </div>
                
                <div className="space-y-2 max-w-sm">
                  <h3 className="text-base font-bold text-foreground">Interactive preview not available</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This file format or web URL cannot be rendered inside the sandbox. You can open the original link or download the file directly.
                  </p>
                </div>

                <div className="flex gap-3">
                  {material.url && (
                    <Button 
                      onClick={() => window.open(material.url!, "_blank")} 
                      className="rounded-xl px-5 shadow-sm"
                    >
                      <ExternalLink className="size-4 mr-2" /> Visit Website
                    </Button>
                  )}
                  {fileUrl && (
                    <Button 
                      onClick={handleDownload} 
                      variant="outline" 
                      className="rounded-xl px-5 border-border/80"
                    >
                      <Download className="size-4 mr-2" /> Download File
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Body content / Description if present */}
          {material.ogDescription && (
            <Card className="border-border/50 shadow-xs bg-muted/10 rounded-2xl mt-6">
              <CardContent className="p-5 space-y-1">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="size-3.5" />
                  Description
                </h4>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {material.ogDescription}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Side: Metadata / Side Panel */}
        <div className="space-y-6">
          {/* Playlist Videos List */}
          {isPlaylist && playlistVideos && playlistVideos.length > 0 && (
            <Card className="border-border shadow-sm bg-card rounded-2xl overflow-hidden flex flex-col max-h-[60vh]">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/15 flex justify-between items-center shrink-0">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Playlist Videos</h3>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full font-mono">
                  {playlistVideos.length} Videos
                </span>
              </div>
              <div className="p-2 overflow-y-auto divide-y divide-border/10 flex-1 min-h-0">
                {playlistVideos.map((video) => {
                  const isActive = video.videoId === activeVideoId;
                  return (
                    <div
                      key={video.id}
                      onClick={() => {
                        setActiveVideoId(video.videoId);
                        toast.info(`Playing: ${video.title}`);
                      }}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-muted/40",
                        isActive 
                          ? "bg-primary/5 border border-primary/20 shadow-xs" 
                          : "border border-transparent"
                      )}
                    >
                      <div className={cn(
                        "size-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 border",
                        isActive 
                          ? "bg-primary/15 border-primary/30 text-primary" 
                          : "bg-muted border-border/50 text-muted-foreground"
                      )}>
                        {video.position}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "text-xs font-semibold leading-snug line-clamp-2",
                          isActive ? "text-foreground font-bold" : "text-muted-foreground"
                        )}>
                          {video.title}
                        </p>
                        {video.duration > 0 && (
                          <span className="text-[10px] font-mono text-muted-foreground/80 mt-1 block">
                            {formatDuration(video.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Standard Resource Details Card */}
          <Card className="border-border shadow-sm bg-card rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 bg-muted/15">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Resource Details</h3>
            </div>
            <CardContent className="p-5 divide-y divide-border/30 text-xs">
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-muted-foreground">Type</span>
                <span className="font-semibold text-foreground capitalize">
                  {material.ytPlaylistId ? "YouTube Playlist" : material.contentType}
                </span>
              </div>
              
              {material.fileName && (
                <div className="py-2.5 flex justify-between gap-4 min-w-0">
                  <span className="text-muted-foreground shrink-0">Filename</span>
                  <span className="font-semibold text-foreground truncate" title={material.fileName}>{material.fileName}</span>
                </div>
              )}

              {material.fileSize && (
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-muted-foreground">File Size</span>
                  <span className="font-semibold text-foreground">{formatBytes(material.fileSize)}</span>
                </div>
              )}

              {material.mimeType && (
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-semibold text-foreground font-mono text-[10px]">{material.mimeType}</span>
                </div>
              )}

              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-muted-foreground">Added</span>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  {new Date(material.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-muted-foreground">Stored Status</span>
                {material.inLibrary ? (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-200/30 dark:border-emerald-800/30 uppercase tracking-wide text-[9px] flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> In Library
                  </span>
                ) : (
                  <span className="font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded uppercase tracking-wide text-[9px]">
                    Not Saved
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
