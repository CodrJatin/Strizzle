"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
  Folder, FolderOpen, Plus, Trash2, Edit3, Loader2,
  FileText, AlertCircle, ChevronDown, ChevronRight,
  ExternalLink, Download, Share2, LayoutGrid, List,
  Filter, Search, Check, X, File, Link, CheckCircle2,
  Calendar, Eye, MoreVertical
} from "lucide-react";
import { EditMaterialModal } from "@/components/EditMaterialModal";
import { formatDuration } from "@/lib/youtube";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { hashFile } from "@/lib/hashFile";
import { useConfirmStore } from "@/store/confirmStore";

interface PageProps {
  params: Promise<{ hiveId: string }>;
}

interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  hiveId: string;
  createdBy: string;
  createdAt: Date | string;
  children: FolderNode[];
}

interface UserMaterialItem {
  id: string;
  title: string;
  contentType: string;
  createdAt: string;
  source: "library" | "desk";
  shelfItemId?: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}

export default function MaterialsPage({ params }: PageProps) {
  const { hiveId } = React.use(params);
  const router = useRouter();
  const utils = api.useUtils();
  const confirm = useConfirmStore((s) => s.confirm);

  const { data: user } = api.user.getMe.useQuery(undefined, { staleTime: 900000 });
  const [editMaterial, setEditMaterial] = React.useState<any | null>(null);

  // Queries
  const { data: hive, isLoading: isLoadingHive } = api.hive.getHive.useQuery(
    { hiveId },
    { staleTime: 300000 } // Slow-changing hive details: 5 minutes
  );
  const { data: foldersData, isLoading: isLoadingFolders } = api.folder.getHiveFolders.useQuery(
    { hiveId },
    { staleTime: 300000 } // Slow-changing syllabus tree & folder structures: 5 minutes
  );
  
  // Filter state
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(null); // null = "All Materials"
  const [contentTypeFilter, setContentTypeFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");

  // Fetch materials for selected folder
  const { data: materialsData, isLoading: isLoadingMaterials } = api.hiveMaterial.getHiveMaterials.useQuery(
    {
      hiveId,
      folderId: selectedFolderId,
      limit: 50,
    },
    { staleTime: 120000 } // Standard materials list: 2 minutes
  );

  // Fetch ALL materials in hive to calculate folder counts client-side
  const { data: allMaterialsData } = api.hiveMaterial.getHiveMaterials.useQuery(
    {
      hiveId,
      limit: 500, // Intentionally high — we need ALL materials to compute folder counts
    },
    { staleTime: 120000 } // Standard materials list: 2 minutes
  );

  // Queries for Sharing Modal (Tab: From my library)
  const [shareModalOpen, setShareModalOpen] = React.useState(false);

  const { data: libraryData } = api.library.getLibraryMaterials.useQuery(
    {},
    {
      enabled: shareModalOpen,
      staleTime: 120000, // Standard library materials list: 2 minutes
    }
  );
  const { data: shelfData } = api.shelf.getShelfItems.useQuery(
    undefined,
    {
      enabled: shareModalOpen,
      staleTime: 120000, // Standard shelf items list: 2 minutes
    }
  );

  // Mutations
  const createFolderMutation = api.folder.createFolder.useMutation({
    onMutate: async (newFolder) => {
      setCreateFolderDialogOpen(false);
      setNewFolderName("");
      setNewFolderParentId(null);
      await utils.folder.getHiveFolders.cancel({ hiveId });
      const previousFolders = utils.folder.getHiveFolders.getData({ hiveId });
      utils.folder.getHiveFolders.setData({ hiveId }, (old: any) => {
        const tempFolder = {
          id: "temp-folder-" + Math.random().toString(),
          name: newFolder.name,
          parentId: newFolder.parentId ?? null,
          hiveId,
          createdBy: "temp-user",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (!old) return { items: [tempFolder] };
        return {
          ...old,
          items: [...old.items, tempFolder],
        };
      });
      return { previousFolders };
    },
    onError: (error, _variables, context) => {
      if (context?.previousFolders) {
        utils.folder.getHiveFolders.setData({ hiveId }, context.previousFolders);
      }
      toast.error(error.message || "Something went wrong. Failed to create folder.");
    },
    onSuccess: () => {
      toast.success("Folder created successfully!");
      setCreateFolderDialogOpen(false);
      setNewFolderName("");
      setNewFolderParentId(null);
    },
    onSettled: () => {
      utils.folder.getHiveFolders.invalidate({ hiveId });
    }
  });

  const renameFolderMutation = api.folder.renameFolder.useMutation({
    onMutate: async (variables) => {
      setRenameDialogOpen(false);
      setEditFolderName("");
      setTargetFolder(null);
      await utils.folder.getHiveFolders.cancel({ hiveId });
      const previousFolders = utils.folder.getHiveFolders.getData({ hiveId });
      utils.folder.getHiveFolders.setData({ hiveId }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((f: any) => f.id === variables.folderId ? { ...f, name: variables.name } : f),
        };
      });
      return { previousFolders };
    },
    onError: (error, _variables, context) => {
      if (context?.previousFolders) {
        utils.folder.getHiveFolders.setData({ hiveId }, context.previousFolders);
      }
      toast.error(error.message || "Something went wrong. Failed to rename folder.");
    },
    onSuccess: () => {
      toast.success("Folder renamed successfully!");
      setRenameDialogOpen(false);
      setEditFolderName("");
      setTargetFolder(null);
    },
    onSettled: () => {
      utils.folder.getHiveFolders.invalidate({ hiveId });
    }
  });

  const deleteFolderMutation = api.folder.deleteFolder.useMutation({
    onMutate: async (variables) => {
      setTargetFolder(null);
      if (selectedFolderId === variables.folderId) {
        setSelectedFolderId(null);
      }
      await utils.folder.getHiveFolders.cancel({ hiveId });
      const previousFolders = utils.folder.getHiveFolders.getData({ hiveId });
      utils.folder.getHiveFolders.setData({ hiveId }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((f: any) => f.id !== variables.folderId),
        };
      });
      return { previousFolders };
    },
    onError: (error, _variables, context) => {
      if (context?.previousFolders) {
        utils.folder.getHiveFolders.setData({ hiveId }, context.previousFolders);
      }
      toast.error(error.message || "Something went wrong. Failed to delete folder.");
    },
    onSuccess: () => {
      toast.success("Folder deleted successfully!");
      setTargetFolder(null);
      if (selectedFolderId === targetFolder?.id) {
        setSelectedFolderId(null);
      }
    },
    onSettled: () => {
      utils.folder.getHiveFolders.invalidate({ hiveId });
      utils.hiveMaterial.getHiveMaterials.invalidate({ hiveId });
    }
  });

  const unshareMaterialMutation = api.hiveMaterial.unshareMaterial.useMutation({
    onMutate: async (variables) => {
      const qKey = { hiveId, folderId: selectedFolderId, limit: 50 };
      await utils.hiveMaterial.getHiveMaterials.cancel(qKey);
      const previousMaterials = utils.hiveMaterial.getHiveMaterials.getData(qKey);
      
      utils.hiveMaterial.getHiveMaterials.setData(qKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((m: any) => m.id !== variables.shareId),
        };
      });
      return { previousMaterials };
    },
    onError: (error, _variables, context) => {
      const qKey = { hiveId, folderId: selectedFolderId, limit: 50 };
      if (context?.previousMaterials) {
        utils.hiveMaterial.getHiveMaterials.setData(qKey, context.previousMaterials);
      }
      toast.error(error.message || "Something went wrong. Failed to unshare material.");
    },
    onSuccess: () => {
      toast.success("Material unshared from workspace.");
    },
    onSettled: () => {
      utils.hiveMaterial.getHiveMaterials.invalidate({ hiveId });
      utils.hive.getHiveOverview.invalidate({ hiveId });
    }
  });

  const addToLibraryMutation = api.library.addToLibrary.useMutation({
    onSuccess: () => {
      toast.success("Added to your personal library!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add to library.");
    },
  });

  const shareMaterialToHiveMutation = api.hiveMaterial.shareMaterialToHive.useMutation();
  const copyMaterialMutation = api.material.copyMaterial.useMutation();
  const createLinkMaterial = api.material.createLinkMaterial.useMutation();
  const getPresignedUploadUrl = api.material.getPresignedUploadUrl.useMutation();
  const confirmFileUpload = api.material.confirmFileUpload.useMutation();
  const deleteShelfItemMutation = api.shelf.deleteShelfItem.useMutation();

  // Sharing Modal state
  const [shareActiveTab, setShareActiveTab] = React.useState<"library" | "add_new">("library");
  const [addNewTab, setAddNewTab] = React.useState<"link" | "file">("link");
  const [shareSearchQuery, setShareSearchQuery] = React.useState("");
  const [selectedShareMaterialId, setSelectedShareMaterialId] = React.useState<string | null>(null);
  const [removeFromDesk, setRemoveFromDesk] = React.useState(false);
  const [lifecycleChoice, setLifecycleChoice] = React.useState<"clone" | "original">("clone");
  const [shareTargetFolderId, setShareTargetFolderId] = React.useState<string | null>(null);
  
  // Link states
  const [newLinkUrl, setNewLinkUrl] = React.useState("");

  // File upload state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileHash, setFileHash] = React.useState("");
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isDeduped, setIsDeduped] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [sharingInProgress, setSharingInProgress] = React.useState(false);

  // UI state for Folders
  const [expandedFolders, setExpandedFolders] = React.useState<Record<string, boolean>>({});
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [newFolderParentId, setNewFolderParentId] = React.useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [editFolderName, setEditFolderName] = React.useState("");
  const [targetFolder, setTargetFolder] = React.useState<FolderNode | null>(null);

  // Folder tree builder
  const folderTree = React.useMemo(() => {
    if (!foldersData?.items) return [];
    const folderMap: Record<string, FolderNode> = {};
    const roots: FolderNode[] = [];

    foldersData.items.forEach((f) => {
      folderMap[f.id] = { ...f, children: [] };
    });

    foldersData.items.forEach((f) => {
      const node = folderMap[f.id];
      if (f.parentId) {
        const parent = folderMap[f.parentId];
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [foldersData]);

  // Client-side folder material counter
  const folderCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: allMaterialsData?.items?.length || 0 };
    if (!allMaterialsData?.items) return counts;

    allMaterialsData.items.forEach((item) => {
      const fId = item.folderId || "root";
      counts[fId] = (counts[fId] || 0) + 1;
    });

    const getSubtreeCount = (node: FolderNode): number => {
      let nodeCount = counts[node.id] || 0;
      node.children.forEach((child) => {
        nodeCount += getSubtreeCount(child);
      });
      counts[node.id] = nodeCount;
      return nodeCount;
    };

    folderTree.forEach((root) => {
      getSubtreeCount(root);
    });

    return counts;
  }, [allMaterialsData, folderTree]);

  // Filtered materials for main grid
  const filteredMaterials = React.useMemo(() => {
    if (!materialsData?.items) return [];
    return materialsData.items.filter((item) => {
      if (contentTypeFilter !== "all" && item.material.contentType !== contentTypeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.material.title?.toLowerCase().includes(query);
        const matchesDesc = item.material.ogDescription?.toLowerCase().includes(query) || item.material.body?.toLowerCase().includes(query);
        const matchesFileName = item.material.fileName?.toLowerCase().includes(query);
        return matchesTitle || matchesDesc || matchesFileName;
      }
      return true;
    });
  }, [materialsData, contentTypeFilter, searchQuery]);

  // Combined searchable library + desk shelf materials list
  const combinedUserMaterials = React.useMemo(() => {
    if (!shareModalOpen) return [];
    
    const itemsMap = new Map<string, UserMaterialItem>();
    
    // Process library materials
    libraryData?.items?.forEach((lm) => {
      itemsMap.set(lm.material.id, {
        id: lm.material.id,
        title: lm.material.title || lm.material.fileName || "Untitled Link/File",
        contentType: lm.material.contentType,
        createdAt: typeof lm.addedAt === "string" ? lm.addedAt : new Date(lm.addedAt).toISOString(),
        source: "library",
        fileName: lm.material.fileName,
        mimeType: lm.material.mimeType,
        fileSize: lm.material.fileSize,
      });
    });

    // Process desk (shelf) items
    shelfData?.forEach((si) => {
      const existing = itemsMap.get(si.materialId);
      if (existing) {
        existing.shelfItemId = si.id;
      } else {
        itemsMap.set(si.materialId, {
          id: si.materialId,
          title: si.material.title || si.material.fileName || "Untitled Desk Item",
          contentType: si.material.contentType,
          createdAt: typeof si.createdAt === "string" ? si.createdAt : new Date(si.createdAt).toISOString(),
          source: "desk",
          shelfItemId: si.id,
          fileName: si.material.fileName,
          mimeType: si.material.mimeType,
          fileSize: si.material.fileSize,
        });
      }
    });

    return Array.from(itemsMap.values());
  }, [libraryData, shelfData, shareModalOpen]);

  // Filtered combined user materials by search query
  const filteredUserMaterials = React.useMemo(() => {
    const query = shareSearchQuery.trim().toLowerCase();
    if (!query) return combinedUserMaterials;
    return combinedUserMaterials.filter((item) =>
      item.title.toLowerCase().includes(query)
    );
  }, [combinedUserMaterials, shareSearchQuery]);

  // Process dropped or selected file
  const processFile = async (file: File) => {
    setSelectedFile(file);
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    setIsDeduped(false);

    try {
      // 1. Calculate SHA-256 client-side
      const hashData = await hashFile(file);
      setFileHash(hashData.hash);

      // 2. Check for deduplication
      const checkRes = await utils.material.checkStorageObject.fetch({ hash: hashData.hash });
      
      if (checkRes.exists) {
        setIsDeduped(true);
        setUploadProgress(100);
        setUploading(false);
        toast.success("File recognized! Will be deduplicated instantly on submit.");
        return;
      }

      // 3. Request signed upload URL
      const uploadUrlRes = await getPresignedUploadUrl.mutateAsync({
        hash: hashData.hash,
        filename: file.name,
        mimeType: file.type,
      });

      if (uploadUrlRes.exists) {
        setIsDeduped(true);
        setUploadProgress(100);
        setUploading(false);
        toast.success("File recognized! Will be deduplicated instantly.");
        return;
      }

      if (!uploadUrlRes.signedUrl) {
        throw new Error("Failed to retrieve upload URL");
      }

      // 4. Perform upload using XMLHttpRequest for progress bar
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded * 100) / e.total);
          setUploadProgress(percent);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploading(false);
          toast.success("File uploaded successfully!");
        } else {
          setUploading(false);
          setUploadError(`Upload failed with status ${xhr.status}`);
          toast.error("Failed to upload file to storage.");
        }
      });

      xhr.addEventListener("error", () => {
        setUploading(false);
        setUploadError("Network upload error occurred.");
        toast.error("Failed to upload file due to a network error.");
      });

      xhr.open("PUT", uploadUrlRes.signedUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);

    } catch (error: any) {
      console.error(error);
      setUploading(false);
      setUploadError(error.message || "An error occurred during file processing.");
      toast.error("File processing failed.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Perform sharing execution
  const handleShareMaterial = async () => {
    setSharingInProgress(true);
    try {
      let materialId = "";

      if (shareActiveTab === "library") {
        if (!selectedShareMaterialId) {
          toast.error("Please select a material to share.");
          setSharingInProgress(false);
          return;
        }

        const selectedItem = combinedUserMaterials.find((m) => m.id === selectedShareMaterialId);
        if (!selectedItem) {
          toast.error("Selected material not found.");
          setSharingInProgress(false);
          return;
        }

        // Apply lifecycle copy choice
        if (lifecycleChoice === "clone") {
          const copy = await copyMaterialMutation.mutateAsync({ id: selectedShareMaterialId });
          materialId = copy.id;
        } else {
          materialId = selectedShareMaterialId;
        }

        // Share to hive
        await shareMaterialToHiveMutation.mutateAsync({
          materialId,
          hiveId,
          folderId: shareTargetFolderId || undefined,
        });

        // Delete from desk if requested
        if (removeFromDesk && selectedItem.shelfItemId) {
          await deleteShelfItemMutation.mutateAsync({ id: selectedItem.shelfItemId });
        }

      } else {
        // Add new tab
        if (addNewTab === "link") {
          if (!newLinkUrl.trim()) {
            toast.error("Please enter a valid URL.");
            setSharingInProgress(false);
            return;
          }

          const mat = await createLinkMaterial.mutateAsync({
            url: newLinkUrl,
            tags: [],
          });
          materialId = mat.id;
        } else {
          // File upload
          if (!selectedFile || !fileHash) {
            toast.error("Please select or drop a file first.");
            setSharingInProgress(false);
            return;
          }
          if (uploading) {
            toast.error("Please wait for file upload to complete.");
            setSharingInProgress(false);
            return;
          }

          const mat = await confirmFileUpload.mutateAsync({
            hash: fileHash,
            filename: selectedFile.name,
            mimeType: selectedFile.type,
            fileSize: selectedFile.size,
          });
          materialId = mat.id;
        }

        // Share to hive
        await shareMaterialToHiveMutation.mutateAsync({
          materialId,
          hiveId,
          folderId: shareTargetFolderId || undefined,
        });
      }

      toast.success("Material shared to hive!");
      utils.hiveMaterial.getHiveMaterials.invalidate({ hiveId });
      utils.hive.getHiveOverview.invalidate({ hiveId });
      setShareModalOpen(false);
      resetShareForm();

    } catch (error: any) {
      toast.error(error.message || "Failed to share material.");
    } finally {
      setSharingInProgress(false);
    }
  };

  const resetShareForm = () => {
    setSelectedShareMaterialId(null);
    setNewLinkUrl("");
    setSelectedFile(null);
    setFileHash("");
    setUploadProgress(0);
    setUploadError(null);
    setIsDeduped(false);
    setRemoveFromDesk(false);
  };

  // Relative time formatter
  const formatTime = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const toggleExpand = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const openCreateFolder = (parentId: string | null = null) => {
    setNewFolderParentId(parentId);
    setCreateFolderDialogOpen(true);
  };

  const openRenameFolder = (folder: FolderNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetFolder(folder);
    setEditFolderName(folder.name);
    setRenameDialogOpen(true);
  };

  const openDeleteFolder = async (folder: FolderNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: "Delete Folder",
      description: `Are you sure you want to delete the folder "${folder.name}" and all of its contents? Any subfolders will also be deleted. All shared materials inside this folder structure will be preserved and moved to the workspace root.`,
      confirmText: "Delete",
      variant: "destructive",
    });
    if (confirmed) {
      deleteFolderMutation.mutate({ folderId: folder.id });
    }
  };

  const handleFolderCreateSubmit = () => {
    createFolderMutation.mutate({
      hiveId,
      name: newFolderName,
      parentId: newFolderParentId || undefined,
    });
  };

  const handleUnshare = async (shareId: string) => {
    const confirmed = await confirm({
      title: "Unshare Material",
      description: "Are you sure you want to unshare this material from the workspace?",
      confirmText: "Unshare",
      variant: "destructive",
    });
    if (confirmed) {
      unshareMaterialMutation.mutate({ shareId });
    }
  };

  const handleDownload = (storagePath: string | null, fileName: string | null) => {
    if (!storagePath) return;
    toast.info("Downloading file...");
    const link = document.createElement("a");
    link.href = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/materials/${storagePath}`;
    link.download = fileName || "download";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render folder list recursively
  const renderFolderNode = (node: FolderNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = !!expandedFolders[node.id];
    const isSelected = selectedFolderId === node.id;
    const count = folderCounts[node.id] || 0;

    return (
      <div key={node.id} className="space-y-1">
        <div
          onClick={() => setSelectedFolderId(node.id)}
          className={cn(
            "group flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer",
            isSelected 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          )}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button 
                onClick={(e) => toggleExpand(node.id, e)} 
                className="size-4 shrink-0 hover:bg-muted/80 rounded flex items-center justify-center"
              >
                {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              </button>
            ) : (
              <span className="size-4 shrink-0" />
            )}
            
            {isSelected ? <FolderOpen className="size-4 text-primary shrink-0" /> : <Folder className="size-4 text-muted-foreground shrink-0" />}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); openCreateFolder(node.id); }}
              className="size-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
            >
              <Plus className="size-3" />
            </button>
            <button 
              onClick={(e) => openRenameFolder(node, e)}
              className="size-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
            >
              <Edit3 className="size-3" />
            </button>
            <button 
              onClick={(e) => openDeleteFolder(node, e)}
              className="size-5 rounded hover:bg-muted text-muted-foreground hover:text-destructive flex items-center justify-center"
            >
              <Trash2 className="size-3" />
            </button>
            <span className="text-xs text-muted-foreground/60 font-medium px-1 bg-muted/40 rounded min-w-5 text-center">{count}</span>
          </div>

          <span className="text-xs text-muted-foreground/80 font-medium px-1.5 py-0.5 bg-muted/20 rounded min-w-5 text-center group-hover:hidden">{count}</span>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const isSelectedMaterialOnDesk = React.useMemo(() => {
    if (!selectedShareMaterialId) return false;
    const selectedItem = combinedUserMaterials.find((m) => m.id === selectedShareMaterialId);
    return !!selectedItem?.shelfItemId;
  }, [selectedShareMaterialId, combinedUserMaterials]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 min-h-[calc(100vh-12rem)] animate-in fade-in duration-300">
      
      {/* LEFT PANEL: Folder Tree */}
      <div className="md:col-span-1 border-r border-border/40 pr-4 space-y-6">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">Folders</span>
          <Button onClick={() => openCreateFolder(null)} variant="ghost" size="icon" className="size-8 rounded-lg border border-border/50 hover:bg-muted">
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="space-y-1">
          {/* All Materials Tab */}
          <div
            onClick={() => setSelectedFolderId(null)}
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer",
              selectedFolderId === null 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="size-4" />
              <span>All Materials</span>
            </div>
            <span className="text-xs font-medium px-1.5 py-0.5 bg-muted/40 rounded min-w-5 text-center">
              {folderCounts.all}
            </span>
          </div>

          {/* Recursive folders list */}
          {folderTree.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 text-center py-6">No folders created.</p>
          ) : (
            folderTree.map((root) => renderFolderNode(root))
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Materials Browser Grid */}
      <div className="md:col-span-3 space-y-6 pl-2">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {selectedFolderId 
                ? foldersData?.items?.find((f) => f.id === selectedFolderId)?.name 
                : "All Materials"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Browse and organize shared resources for {hive?.name}.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/55 shrink-0">
              <Button 
                onClick={() => setViewMode("grid")}
                variant="ghost" 
                size="icon" 
                className={cn("size-8 rounded-md", viewMode === "grid" && "bg-card text-foreground shadow-sm")}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button 
                onClick={() => setViewMode("list")}
                variant="ghost" 
                size="icon" 
                className={cn("size-8 rounded-md", viewMode === "list" && "bg-card text-foreground shadow-sm")}
              >
                <List className="size-4" />
              </Button>
            </div>

            {/* Share to Hive Trigger */}
            <Button 
              onClick={() => { resetShareForm(); setShareModalOpen(true); }}
              className="rounded-xl flex items-center gap-1.5 h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-sm"
            >
              <Share2 className="size-4" />
              Share to Hive
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 pb-1 border-b border-border/20">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Filter className="size-3.5" /> Filters:
            </span>
            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger className="h-8 text-xs w-28 rounded-lg bg-card">
                <SelectValue placeholder="Type: Any" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Type: Any</SelectItem>
                <SelectItem value="text">Notes / Text</SelectItem>
                <SelectItem value="link">Web Links</SelectItem>
                <SelectItem value="file">Files</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear All Filters */}
            {(contentTypeFilter !== "all" || searchQuery.trim()) && (
              <button 
                onClick={() => { setContentTypeFilter("all"); setSearchQuery(""); }} 
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground/60" />
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search materials..." 
              className="h-9 text-xs pl-9 pr-4 rounded-xl bg-card border-border/80" 
            />
          </div>
        </div>

        {/* Material Cards List */}
        {filteredMaterials.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/80 rounded-2xl bg-card text-center">
            <FileText className="size-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-semibold text-foreground">No materials shared here</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Upload resources or share links from your library to collaborate with the hive.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMaterials.map((item) => {
              const m = item.material;
              const isOwnerOrAdmin = hive?.role === "owner" || hive?.role === "admin";
              const isSharer = item.sharedBy === hive?.ownerId; // simplfy check for unsharing permissions

              // Visual styling variables based on content type
              const isWeb = m.contentType === "link";
              const isPdf = m.mimeType === "application/pdf" || m.fileName?.endsWith(".pdf");
              const isVideo = m.url?.includes("youtube.com") || m.url?.includes("youtu.be") || m.url?.includes("vimeo.com");
              const isDocx = m.fileName?.endsWith(".docx") || m.fileName?.endsWith(".doc");
              const isPreviewable = m.contentType !== "text" && m.contentType !== "image";

              return (
                <Card 
                  key={item.id} 
                  onClick={() => {
                    if (isPreviewable) {
                      router.push(`/preview/${m.id}`);
                    }
                  }}
                  className={cn(
                    "group relative border-border shadow-sm bg-card rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col h-full",
                    isPreviewable && "cursor-pointer"
                  )}
                >
                  {/* Card Image Header */}
                  <div className="relative aspect-video w-full bg-muted/30 flex items-center justify-center border-b border-border/40 overflow-hidden select-none">
                    {isWeb && m.ogImage ? (
                      <img src={m.ogImage} alt={m.title || "Preview"} className="object-cover w-full h-full group-hover:scale-102 transition-transform duration-300" />
                    ) : isVideo && m.ogImage ? (
                      <div className="relative w-full h-full">
                        <img src={m.ogImage} alt={m.title || "Preview"} className="object-cover w-full h-full group-hover:scale-102 transition-transform duration-300" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                          <div className="size-11 rounded-full bg-white/90 text-primary shadow flex items-center justify-center border border-border">
                            <Plus className="size-5 fill-primary text-primary ml-0.5 shrink-0" style={{ transform: "rotate(45deg)" }} />
                          </div>
                        </div>
                      </div>
                    ) : isPdf ? (
                      <div className="flex flex-col items-center justify-center p-6 w-full h-full bg-red-50/20 dark:bg-red-950/5">
                        <FileText className="size-14 text-red-500 stroke-[1.5]" />
                      </div>
                    ) : isDocx ? (
                      <div className="flex flex-col items-center justify-center p-6 w-full h-full bg-blue-50/20 dark:bg-blue-950/5">
                        <FileText className="size-14 text-blue-500 stroke-[1.5]" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 w-full h-full bg-muted/10">
                        <FileText className="size-12 text-muted-foreground/60 stroke-[1.5]" />
                      </div>
                    )}

                    {/* Content Type Badge Overlay */}
                    <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider text-white bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-lg">
                      {isWeb ? "Web" : isPdf ? "PDF" : isVideo ? "Video" : isDocx ? "DOCX" : m.contentType}
                    </span>
                    {m.ytDuration !== null && m.ytDuration !== undefined && m.ytDuration > 0 && (
                      <span className="absolute bottom-3 right-3 text-[10px] font-bold text-white bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded-lg font-mono">
                        {formatDuration(m.ytDuration)}
                      </span>
                    )}
                  </div>

                  {/* Card Content */}
                  <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2" title={m.title || "Untitled"}>
                        {m.title || "Untitled shared material"}
                      </h3>
                      {(m.ogDescription || m.body) && (
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {m.ogDescription || m.body}
                        </p>
                      )}
                    </div>

                    {/* Footer Info */}
                    <div className="flex items-center justify-between border-t border-border/30 pt-3 select-none">
                      <span className="text-[10px] font-semibold text-muted-foreground tracking-tight max-w-[50%] truncate">
                        {isWeb ? m.ogDomain || "Web link" : isPdf && m.fileSize ? `${(m.fileSize / (1024 * 1024)).toFixed(1)} MB` : m.fileName || "File"}
                      </span>
                      <span className="text-[10px] text-muted-foreground/80 font-medium">
                        shared by <span className="font-bold text-foreground">{item.sharer?.fullName || "Member"}</span>
                      </span>
                    </div>
                  </CardContent>

                  {/* PREMIUM ACTION HOVER OVERLAY */}
                  <div className="absolute inset-0 bg-background/90 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center gap-3 p-4">
                    <h4 className="text-xs font-bold text-foreground text-center line-clamp-2 px-2 mb-1">
                      {m.title || "Shared Resource"}
                    </h4>
                    
                    <div className="flex flex-col gap-2 w-44" onClick={(e) => e.stopPropagation()}>
                      {/* Copy to Library Action */}
                      <Button 
                        onClick={(e) => { e.stopPropagation(); addToLibraryMutation.mutate({ materialId: m.id }); }}
                        variant="default" 
                        size="sm" 
                        className="h-8 text-xs font-semibold rounded-lg shadow-sm"
                      >
                        <Share2 className="size-3.5 mr-1.5" />
                        Copy to Library
                      </Button>

                      {/* Open / Preview Action */}
                      {isPreviewable ? (
                        <Button 
                          onClick={(e) => { e.stopPropagation(); router.push(`/preview/${m.id}`); }}
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs font-semibold rounded-lg bg-card border-border hover:bg-muted"
                        >
                          <Eye className="size-3.5 mr-1.5" />
                          Preview
                        </Button>
                      ) : m.url ? (
                        <Button 
                          onClick={(e) => { e.stopPropagation(); window.open(m.url!, "_blank"); }}
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs font-semibold rounded-lg bg-card border-border hover:bg-muted"
                        >
                          <ExternalLink className="size-3.5 mr-1.5" />
                          Open Link
                        </Button>
                      ) : m.storagePath ? (
                        <Button 
                          onClick={(e) => { e.stopPropagation(); handleDownload(m.storagePath, m.fileName); }}
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs font-semibold rounded-lg bg-card border-border hover:bg-muted"
                        >
                          <Download className="size-3.5 mr-1.5" />
                          Download
                        </Button>
                      ) : null}

                      {/* Edit Details Action (if owner) */}
                      {user && m.ownerId === user.id && (
                        <Button 
                          onClick={(e) => { e.stopPropagation(); setEditMaterial(m); }}
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs font-semibold rounded-lg bg-card border-border hover:bg-muted"
                        >
                          <Edit3 className="size-3.5 mr-1.5" />
                          Edit Details
                        </Button>
                      )}

                      {/* Delete (Unshare) Action for Owner / Admin / Sharer */}
                      {(isOwnerOrAdmin || isSharer) && (
                        <Button 
                          onClick={(e) => { e.stopPropagation(); handleUnshare(item.id); }}
                          variant="destructive" 
                          size="sm" 
                          className="h-8 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          <Trash2 className="size-3.5 mr-1.5" />
                          Unshare
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* List Mode Layout */
          <div className="border border-border/60 bg-card rounded-2xl overflow-hidden shadow-sm divide-y divide-border/40">
            {filteredMaterials.map((item) => {
              const m = item.material;
              const isOwnerOrAdmin = hive?.role === "owner" || hive?.role === "admin";
              const isSharer = item.sharedBy === hive?.ownerId; // simplfy check for unsharing permissions
              const isPreviewable = m.contentType !== "text" && m.contentType !== "image";

              return (
                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-all select-none">
                  <div 
                    onClick={() => {
                      if (isPreviewable) {
                        router.push(`/preview/${m.id}`);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 min-w-0 flex-1",
                      isPreviewable && "cursor-pointer"
                    )}
                  >
                    <FileText className="size-5 text-primary shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-foreground truncate">{m.title || "Untitled shared material"}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        Shared by <span className="font-semibold text-foreground">{item.sharer?.fullName || "Member"}</span> &bull; {m.contentType.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      onClick={(e) => { e.stopPropagation(); addToLibraryMutation.mutate({ materialId: m.id }); }}
                      variant="ghost" 
                      size="icon" 
                      className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                      title="Copy to Library"
                    >
                      <Share2 className="size-4" />
                    </Button>

                    {isPreviewable ? (
                      <Button 
                        onClick={(e) => { e.stopPropagation(); router.push(`/preview/${m.id}`); }}
                        variant="ghost" 
                        size="icon" 
                        className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                        title="Preview"
                      >
                        <Eye className="size-4" />
                      </Button>
                    ) : m.url ? (
                      <Button 
                        onClick={(e) => { e.stopPropagation(); window.open(m.url!, "_blank"); }}
                        variant="ghost" 
                        size="icon" 
                        className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                        title="Open Link"
                      >
                        <ExternalLink className="size-4" />
                      </Button>
                    ) : m.storagePath ? (
                      <Button 
                        onClick={(e) => { e.stopPropagation(); handleDownload(m.storagePath, m.fileName); }}
                        variant="ghost" 
                        size="icon" 
                        className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                        title="Download file"
                      >
                        <Download className="size-4" />
                      </Button>
                    ) : null}

                    {/* Edit Details Action for owner */}
                    {user && m.ownerId === user.id && (
                      <Button 
                        onClick={(e) => { e.stopPropagation(); setEditMaterial(m); }}
                        variant="ghost" 
                        size="icon" 
                        className="size-8 text-muted-foreground hover:text-foreground rounded-lg"
                        title="Edit Details"
                      >
                        <Edit3 className="size-4" />
                      </Button>
                    )}

                    {(isOwnerOrAdmin || isSharer) && (
                      <Button 
                        onClick={(e) => { e.stopPropagation(); handleUnshare(item.id); }}
                        variant="ghost" 
                        size="icon" 
                        className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                        title="Unshare"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editMaterial && (
        <EditMaterialModal
          material={{
            id: editMaterial.id,
            title: editMaterial.title,
            tags: editMaterial.tags,
            contentType: editMaterial.contentType,
            ytPlaylistId: editMaterial.ytPlaylistId,
            ytVideoRange: editMaterial.ytVideoRange,
          }}
          isOpen={!!editMaterial}
          onClose={() => setEditMaterial(null)}
          hiveId={hiveId}
          queryFilter={{ hiveId, folderId: selectedFolderId, limit: 50 }}
        />
      )}

      {/* DIALOGS */}

      {/* 1. Create Folder Dialog */}
      <Dialog open={createFolderDialogOpen} onOpenChange={setCreateFolderDialogOpen}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>
              {newFolderParentId ? "Create a subfolder inside this folder." : "Create a new root level folder in this workspace."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Folder Name</label>
              <Input 
                value={newFolderName} 
                onChange={(e) => setNewFolderName(e.target.value)} 
                placeholder="Lecture Notes" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateFolderDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleFolderCreateSubmit}
              disabled={createFolderMutation.isPending || !newFolderName.trim()}
            >
              {createFolderMutation.isPending ? <Loader2 className="animate-spin size-4" /> : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Rename Folder Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>Modify the name of the folder below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">New Folder Name</label>
              <Input 
                value={editFolderName} 
                onChange={(e) => setEditFolderName(e.target.value)} 
                placeholder="New name" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => targetFolder && renameFolderMutation.mutate({ folderId: targetFolder.id, name: editFolderName })}
              disabled={renameFolderMutation.isPending || !editFolderName.trim()}
            >
              {renameFolderMutation.isPending ? <Loader2 className="animate-spin size-4" /> : "Save Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* 4. PREMIUM SHARE TO HIVE MODAL (Task 3.14 COMPLETE) */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="max-w-xl border-border bg-card flex flex-col p-0 overflow-hidden rounded-2xl h-[85vh] sm:h-[75vh]">
          {/* Header */}
          <div className="p-6 border-b border-border/40 pb-4">
            <DialogHeader className="flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold">Share a material</DialogTitle>
              </div>
            </DialogHeader>
          </div>

          {/* Navigation Tabs (From Library / Add New) */}
          <Tabs 
            value={shareActiveTab} 
            onValueChange={(val) => setShareActiveTab(val as any)}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-6 border-b border-border/20">
              <TabsList className="w-full justify-start bg-transparent h-11 p-0 gap-6">
                <TabsTrigger 
                  value="library" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-1 py-3 text-sm font-semibold cursor-pointer shadow-none"
                >
                  From my library
                </TabsTrigger>
                <TabsTrigger 
                  value="add_new"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-1 py-3 text-sm font-semibold cursor-pointer shadow-none"
                >
                  Add new
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB CONTENT: Library search & selection */}
            <TabsContent value="library" className="flex-1 flex flex-col min-h-0 p-0 m-0">
              {/* Search bar inside list */}
              <div className="p-4 px-6 border-b border-border/10">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground/60" />
                  <Input
                    value={shareSearchQuery}
                    onChange={(e) => setShareSearchQuery(e.target.value)}
                    placeholder="Search my materials..."
                    className="h-9 text-xs pl-9 pr-10 rounded-xl bg-muted/20 border-border/80"
                  />
                  <kbd className="absolute right-3 top-2.5 pointer-events-none inline-flex h-4.5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[9px] font-medium text-muted-foreground">
                    <span className="text-[10px]">⌘</span>K
                  </kbd>
                </div>
              </div>

              {/* Scrollable Materials List */}
              <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2">
                {filteredUserMaterials.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText className="size-10 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-muted-foreground">No materials found in library/desk.</p>
                  </div>
                ) : (
                  filteredUserMaterials.map((item) => {
                    const isSelected = selectedShareMaterialId === item.id;
                    const isFile = item.contentType === "file" || item.contentType === "image";
                    const isLink = item.contentType === "link" || item.contentType === "youtube";

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedShareMaterialId(item.id)}
                        className={cn(
                          "flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none",
                          isSelected 
                            ? "bg-primary/5 border-primary/20" 
                            : "bg-card border-border/50 hover:bg-muted/30"
                        )}
                      >
                        {/* Custom Checkbox */}
                        <div className={cn(
                          "size-4.5 rounded border flex items-center justify-center shrink-0 transition-all",
                          isSelected 
                            ? "bg-primary border-primary text-primary-foreground" 
                            : "border-border bg-card group-hover:border-foreground/45"
                        )}>
                          {isSelected && <Check className="size-3 stroke-[3]" />}
                        </div>

                        {/* Media Icon */}
                        <div className={cn(
                          "size-9 rounded-lg flex items-center justify-center border shrink-0 shadow-sm",
                          isLink ? "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800/30" :
                          isFile ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800/30" :
                          "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/30"
                        )}>
                          {isLink ? <Link className="size-4.5" /> : <File className="size-4.5" />}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-bold truncate", isSelected ? "text-primary" : "text-foreground")}>
                            {item.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate uppercase tracking-tight">
                            {item.contentType} &bull; {item.source === "desk" ? "Desk Shelf" : "Library"} &bull; Added {formatTime(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Conditional shelf options & Lifecycle Choice */}
              {selectedShareMaterialId && (
                <div className="px-6 py-4 bg-muted/20 border-t border-border/20 space-y-4">
                  {/* Remove from desk option */}
                  {isSelectedMaterialOnDesk && (
                    <div className="flex items-center space-x-2 select-none">
                      <Checkbox 
                        id="removeFromDesk" 
                        checked={removeFromDesk} 
                        onCheckedChange={(checked) => setRemoveFromDesk(!!checked)} 
                        className="rounded border-border text-primary"
                      />
                      <label 
                        htmlFor="removeFromDesk" 
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Remove from desk after sharing
                      </label>
                    </div>
                  )}

                  {/* Lifecycle Choice */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Lifecycle settings</span>
                    <RadioGroup 
                      value={lifecycleChoice} 
                      onValueChange={(val) => setLifecycleChoice(val as any)}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      <div className={cn(
                        "flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none",
                        lifecycleChoice === "clone" ? "border-primary/20 bg-primary/5" : "border-border/60 bg-card hover:bg-muted/10"
                      )} onClick={() => setLifecycleChoice("clone")}>
                        <RadioGroupItem value="clone" id="lc-clone" className="mt-0.5" />
                        <div className="flex flex-col text-[10px]">
                          <span className="font-bold text-foreground leading-normal">Clone and share copy</span>
                          <span className="text-muted-foreground leading-snug mt-0.5">Creates an independent copy for the hive. Safe from deletions.</span>
                        </div>
                      </div>

                      <div className={cn(
                        "flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none",
                        lifecycleChoice === "original" ? "border-primary/20 bg-primary/5" : "border-border/60 bg-card hover:bg-muted/10"
                      )} onClick={() => setLifecycleChoice("original")}>
                        <RadioGroupItem value="original" id="lc-orig" className="mt-0.5" />
                        <div className="flex flex-col text-[10px]">
                          <span className="font-bold text-foreground leading-normal">Share original link</span>
                          <span className="text-muted-foreground leading-snug mt-0.5">Directly maps the current file. Deletions by owner affect the share.</span>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB CONTENT: Add new URL or File */}
            <TabsContent value="add_new" className="flex-1 flex flex-col min-h-0 p-6 space-y-6 m-0">
              <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/50 w-fit shrink-0">
                <Button
                  onClick={() => setAddNewTab("link")}
                  variant="ghost"
                  className={cn("h-8 text-xs font-semibold px-4 rounded-md", addNewTab === "link" && "bg-card text-foreground shadow-sm")}
                >
                  Web Link
                </Button>
                <Button
                  onClick={() => setAddNewTab("file")}
                  variant="ghost"
                  className={cn("h-8 text-xs font-semibold px-4 rounded-md", addNewTab === "file" && "bg-card text-foreground shadow-sm")}
                >
                  File Upload
                </Button>
              </div>

              {/* Sub-tab 1: Web Link URL Input */}
              {addNewTab === "link" ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">URL Address</label>
                  <div className="relative">
                    <Link className="absolute left-3 top-2.5 size-4 text-muted-foreground/60" />
                    <Input
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="https://wikipedia.org/wiki/Cellular_respiration"
                      className="h-9 text-xs pl-9 rounded-xl bg-card border-border/80"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Links are automatically scanned for OpenGraph preview metadata (title, image, desc).
                  </p>
                </div>
              ) : (
                /* Sub-tab 2: Drag & Drop File Upload Area */
                <div className="space-y-4 flex-1 flex flex-col justify-center">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center transition-all min-h-48 select-none",
                      isDragging ? "border-primary bg-primary/5" : "border-border/80 hover:bg-muted/10",
                      selectedFile ? "border-solid border-border/40 bg-muted/5" : ""
                    )}
                  >
                    {!selectedFile ? (
                      <div className="space-y-2">
                        <File className="size-10 text-muted-foreground/50 mx-auto" />
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-foreground">Drag and drop file here</p>
                          <p className="text-[10px] text-muted-foreground">or click below to choose from your computer</p>
                        </div>
                        <input 
                          type="file" 
                          id="share-file-input" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) processFile(file);
                          }}
                        />
                        <Button 
                          onClick={() => document.getElementById("share-file-input")?.click()}
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs font-semibold rounded-lg bg-card border-border shadow-sm shrink-0"
                        >
                          Choose File
                        </Button>
                      </div>
                    ) : (
                      /* Active File State & Progress Bar */
                      <div className="w-full max-w-sm space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-card border border-border/60 rounded-xl">
                          <File className="size-8 text-primary shrink-0" />
                          <div className="text-left min-w-0 flex-1">
                            <p className="text-xs font-bold truncate text-foreground">{selectedFile.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB &bull; {selectedFile.type || "unknown type"}
                            </p>
                          </div>
                          <button 
                            onClick={() => resetShareForm()}
                            className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer shrink-0"
                          >
                            <X className="size-4" />
                          </button>
                        </div>

                        {/* Progress meter */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-semibold">
                            <span className="text-muted-foreground">
                              {uploading ? "Uploading file..." : isDeduped ? "De-duplicated instantly" : "Upload complete"}
                            </span>
                            <span className="text-foreground">{uploadProgress}%</span>
                          </div>
                          <Progress value={uploadProgress} className="h-1.5 bg-muted rounded-full overflow-hidden" />
                        </div>

                        {uploadError && (
                          <div className="text-[10px] font-semibold text-destructive flex items-center gap-1 justify-center bg-destructive/5 py-1.5 px-3 rounded-lg border border-destructive/10">
                            <AlertCircle className="size-3.5" />
                            {uploadError}
                          </div>
                        )}
                        {!uploading && !uploadError && (
                          <div className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1 justify-center bg-emerald-50/30 dark:bg-emerald-950/5 py-1.5 px-3 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                            <CheckCircle2 className="size-3.5" />
                            File processed successfully
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Dialog Footer Actions with Folder Selector & Share Button */}
          <div className="p-4 border-t border-border/40 bg-muted/10 flex items-center justify-between gap-4 select-none shrink-0">
            {/* Folder Selector Dropdown */}
            <Select 
              value={shareTargetFolderId || "root"} 
              onValueChange={(val) => setShareTargetFolderId(val === "root" ? null : val)}
            >
              <SelectTrigger className="h-10 text-xs w-48 rounded-xl bg-card border-border shadow-sm flex items-center gap-2">
                <Folder className="size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Select Folder" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="root">Select Folder (Root)</SelectItem>
                {foldersData?.items?.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Submit Sharing Trigger */}
            <Button
              onClick={handleShareMaterial}
              disabled={
                sharingInProgress ||
                (shareActiveTab === "library" && !selectedShareMaterialId) ||
                (shareActiveTab === "add_new" && addNewTab === "link" && !newLinkUrl.trim()) ||
                (shareActiveTab === "add_new" && addNewTab === "file" && (!selectedFile || uploading))
              }
              className="rounded-xl flex items-center gap-2 h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-5 shadow-sm"
            >
              {sharingInProgress ? (
                <>
                  <Loader2 className="animate-spin size-3.5" />
                  Sharing...
                </>
              ) : (
                <>
                  Share Material
                  <Share2 className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
