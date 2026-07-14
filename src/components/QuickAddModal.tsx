"use client";

import * as React from "react";
import { useQuickAddStore } from "@/store/quickAddStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FileText, Link2, UploadCloud, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/trpc/client";
import { hashFile } from "@/lib/hashFile";
import { cn } from "@/lib/utils";
import { useModalKeybinds } from "@/hooks/useModalKeybinds";

export function QuickAddModal() {
  const { isOpen, close, defaultTab } = useQuickAddStore();
  const utils = api.useUtils();

  const [activeTab, setActiveTab] = React.useState<"text" | "link" | "file">("text");
  const [submitting, setSubmitting] = React.useState(false);

  // Sync activeTab with store's defaultTab when modal opens
  React.useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // Form State - Text Tab
  const [textBody, setTextBody] = React.useState("");
  const [textTitle, setTextTitle] = React.useState("");
  const [textTagsInput, setTextTagsInput] = React.useState("");

  // Form State - Link Tab
  const [linkUrl, setLinkUrl] = React.useState("");
  const [debouncedUrl, setDebouncedUrl] = React.useState("");
  const [linkTagsInput, setLinkTagsInput] = React.useState("");

  // Form State - File Tab
  const [file, setFile] = React.useState<File | null>(null);
  const [fileHash, setFileHash] = React.useState<string | null>(null);
  const [isDeduped, setIsDeduped] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const dragRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // tRPC Mutations
  const createTextMaterial = api.material.createTextMaterial.useMutation();
  const createLinkMaterial = api.material.createLinkMaterial.useMutation();
  const getPresignedUploadUrl = api.material.getPresignedUploadUrl.useMutation();
  const confirmFileUpload = api.material.confirmFileUpload.useMutation();
  const createShelfItem = api.shelf.createShelfItem.useMutation();

  // URL input debounce logic (400ms)
  React.useEffect(() => {
    if (!linkUrl) {
      setDebouncedUrl("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedUrl(linkUrl);
    }, 400);

    return () => clearTimeout(timer);
  }, [linkUrl]);

  // Validate URL helper
  const isValidUrl = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  // Fetch link metadata query for live debounced preview
  const linkMetaQuery = api.material.getLinkMetadata.useQuery(
    { url: debouncedUrl },
    {
      enabled: !!debouncedUrl && isValidUrl(debouncedUrl),
      retry: false,
      staleTime: 300000, // 5 mins cache
    }
  );

  // File selection and processing
  const processFile = async (selectedFile: File) => {
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error("File exceeds 50MB size limit");
      return;
    }

    setFile(selectedFile);
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    setIsDeduped(false);

    try {
      // 1. Calculate SHA-256 client-side
      const hashData = await hashFile(selectedFile);
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
        filename: selectedFile.name,
        mimeType: selectedFile.type,
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
      xhr.setRequestHeader("Content-Type", selectedFile.type);
      xhr.send(selectedFile);

    } catch (error: any) {
      console.error(error);
      setUploading(false);
      setUploadError(error.message || "An error occurred during file processing.");
      toast.error("File processing failed.");
    }
  };

  // Drag and Drop handlers
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
    const selectedFile = e.dataTransfer.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  // Parsing tags helper
  const parseTags = (inputStr: string): string[] => {
    return inputStr
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  };

  useModalKeybinds(isOpen, () => {
    handleSubmit();
  });

  // Handle Form Submit
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitting(true);

    try {
      let materialId = "";
      let optimMaterial: any = null;

      if (activeTab === "text") {
        if (!textBody.trim()) {
          toast.error("Please enter note content.");
          setSubmitting(false);
          return;
        }

        const tags = parseTags(textTagsInput);
        const mat = await createTextMaterial.mutateAsync({
          body: textBody,
          title: textTitle.trim() || undefined,
          tags,
        });
        materialId = mat.id;
        optimMaterial = mat;

      } else if (activeTab === "link") {
        if (!linkUrl.trim() || !isValidUrl(linkUrl)) {
          toast.error("Please enter a valid URL.");
          setSubmitting(false);
          return;
        }

        const tags = parseTags(linkTagsInput);
        const mat = await createLinkMaterial.mutateAsync({
          url: linkUrl,
          tags,
        });
        materialId = mat.id;
        optimMaterial = mat;

      } else if (activeTab === "file") {
        if (!file || !fileHash) {
          toast.error("Please drop or select a file first.");
          setSubmitting(false);
          return;
        }
        if (uploading) {
          toast.error("Please wait for file upload to complete.");
          setSubmitting(false);
          return;
        }
        if (uploadError) {
          toast.error("File upload failed. Please try again.");
          setSubmitting(false);
          return;
        }

        const mat = await confirmFileUpload.mutateAsync({
          hash: fileHash,
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        });
        materialId = mat.id;
        optimMaterial = mat;
      }

      // 1. Cancel active shelf queries
      await utils.shelf.getShelfItems.cancel();

      // 2. Snapshot current desk shelf
      const previousShelf = utils.shelf.getShelfItems.getData();

      // 3. Optimistically prepend the new shelf item
      if (optimMaterial) {
        utils.shelf.getShelfItems.setData(undefined, (old) => {
          const tempShelfItem = {
            id: `temp-${Date.now()}`,
            materialId,
            userId: "current-user",
            createdAt: new Date().toISOString(),
            material: optimMaterial,
          };
          return old ? [tempShelfItem, ...old] : [tempShelfItem];
        });
      }

      // Close the modal and reset form immediately - feeling instant!
      toast.success("Captured to Desk successfully!");
      resetForm();
      close();

      // 4. Execute shelf creation mutation in the background
      createShelfItem.mutate({ materialId }, {
        onError: () => {
          // Roll back cache on mutation error
          if (previousShelf) {
            utils.shelf.getShelfItems.setData(undefined, previousShelf);
          }
          toast.error("Failed to save capture to desk shelf.");
        },
        onSuccess: () => {
          utils.shelf.getShelfItems.invalidate();
        }
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to capture resource.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTextBody("");
    setTextTitle("");
    setTextTagsInput("");
    setLinkUrl("");
    setDebouncedUrl("");
    setLinkTagsInput("");
    setFile(null);
    setFileHash(null);
    setIsDeduped(false);
    setUploading(false);
    setUploadProgress(0);
    setUploadError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { resetForm(); close(); } }}>
      <DialogContent className="w-full sm:max-w-[500px] gap-6 bg-card text-card-foreground border border-border p-6 rounded-2xl shadow-xl overflow-hidden min-w-0">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold tracking-tight">Quick Capture</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Save any study resource to your desk inbox instantly.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val) => { resetForm(); setActiveTab(val as any); }} className="w-full min-w-0">
          <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-xl mb-4">
            <TabsTrigger value="text" className="rounded-lg py-1.5 text-xs font-semibold cursor-pointer">
              Text / Note
            </TabsTrigger>
            <TabsTrigger value="link" className="rounded-lg py-1.5 text-xs font-semibold cursor-pointer">
              Link
            </TabsTrigger>
            <TabsTrigger value="file" className="rounded-lg py-1.5 text-xs font-semibold cursor-pointer">
              File
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-4 w-full min-w-0">
            {/* TEXT TAB */}
            <TabsContent value="text" className="space-y-4 outline-none">
              <div className="space-y-1.5">
                <Label htmlFor="text-title" className="text-xs font-medium">Title (optional)</Label>
                <Input
                  id="text-title"
                  placeholder="e.g. Lecture 1 Notes"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  className="rounded-xl border border-input text-sm h-10 px-3"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="text-body" className="text-xs font-medium">Content</Label>
                <Textarea
                  id="text-body"
                  placeholder="Write or paste your note here..."
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  className="min-h-[140px] rounded-xl border border-input text-sm p-3 resize-none focus-visible:ring-1 focus-visible:ring-primary"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="text-tags" className="text-xs font-medium">Tags (optional, comma-separated)</Label>
                <Input
                  id="text-tags"
                  placeholder="biology, chemistry, lecture"
                  value={textTagsInput}
                  onChange={(e) => setTextTagsInput(e.target.value)}
                  className="rounded-xl border border-input text-sm h-10 px-3"
                />
              </div>
            </TabsContent>

            {/* LINK TAB */}
            <TabsContent value="link" className="space-y-4 outline-none">
              <div className="space-y-1.5">
                <Label htmlFor="link-url" className="text-xs font-medium">URL</Label>
                <Input
                  id="link-url"
                  type="url"
                  placeholder="https://example.com/study-resource"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="rounded-xl border border-input text-sm h-10 px-3"
                  required
                />
              </div>

              {/* LIVE DEBOUNCED PREVIEW */}
              {debouncedUrl && isValidUrl(debouncedUrl) && (
                <div className="border border-border/80 rounded-2xl overflow-hidden bg-muted/20 p-3 shadow-inner space-y-2">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Live Preview</div>
                  
                  {linkMetaQuery.isLoading && (
                    <div className="flex items-center gap-3 py-2">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Scraping site metadata...</span>
                    </div>
                  )}

                  {linkMetaQuery.isError && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <AlertCircle className="size-4 text-muted-foreground shrink-0" />
                      <span>Could not retrieve details. Fallback URL will be used.</span>
                    </div>
                  )}

                  {linkMetaQuery.data && (
                    <div className="flex gap-3">
                      {linkMetaQuery.data.image && (
                        <img
                          src={linkMetaQuery.data.image}
                          alt="preview"
                          className="size-16 rounded-xl object-cover border border-border/50 bg-muted shrink-0"
                        />
                      )}
                      <div className="flex flex-col min-w-0 justify-center">
                        <span className="text-xs font-bold text-foreground truncate">
                          {linkMetaQuery.data.title || "No Title"}
                        </span>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                          {linkMetaQuery.data.description || "No description available."}
                        </p>
                        <span className="text-[10px] text-primary/70 font-semibold mt-1">
                          {linkMetaQuery.data.domain}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="link-tags" className="text-xs font-medium">Tags (optional, comma-separated)</Label>
                <Input
                  id="link-tags"
                  placeholder="video, article, wikipedia"
                  value={linkTagsInput}
                  onChange={(e) => setLinkTagsInput(e.target.value)}
                  className="rounded-xl border border-input text-sm h-10 px-3"
                />
              </div>
            </TabsContent>

            {/* FILE TAB */}
            <TabsContent value="file" className="space-y-4 outline-none">
              <Label className="text-xs font-medium">Upload File (PDF, DOCX, PPTX, Images - Max 50MB)</Label>
              
              <div
                ref={dragRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf,.docx,.pptx,image/*";
                  input.onchange = (e) => {
                    const selectedFile = (e.target as HTMLInputElement).files?.[0];
                    if (selectedFile) processFile(selectedFile);
                  };
                  input.click();
                }}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all min-h-[140px]",
                  isDragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground hover:bg-muted/10",
                  file ? "border-solid border-primary/40 bg-muted/10" : ""
                )}
              >
                {!file ? (
                  <>
                    <UploadCloud className="size-8 text-muted-foreground" />
                    <div className="text-sm font-semibold">Drag & drop here or click to browse</div>
                    <div className="text-[10px] text-muted-foreground">PDF, DOCX, PPTX, JPG, PNG, WEBP up to 50MB</div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 w-full text-center min-w-0">
                    <div className="flex items-center justify-center gap-2 font-semibold text-sm w-full min-w-0 px-4">
                      <FileText className="size-4 text-primary shrink-0" />
                      <span className="truncate block max-w-[280px]" title={file.name}>{file.name}</span>
                    </div>
                    
                    {/* Upload progress or dedup status */}
                    <div className="w-full max-w-[200px] mt-2">
                      {isDeduped ? (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-primary font-bold">
                          <CheckCircle2 className="size-4" /> Deduplicated ✓
                        </div>
                      ) : uploading ? (
                        <div className="space-y-1">
                          <Progress value={uploadProgress} className="h-1.5 rounded-full" />
                          <div className="text-[10px] text-muted-foreground">Uploading: {uploadProgress}%</div>
                        </div>
                      ) : uploadError ? (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-destructive font-semibold">
                          <AlertCircle className="size-4" /> Upload failed
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-primary font-bold">
                          <CheckCircle2 className="size-4" /> Ready to save
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border mt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { resetForm(); close(); }}
                className="rounded-xl px-4 py-2 cursor-pointer text-sm font-semibold"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl px-5 py-2 font-semibold shadow-sm cursor-pointer text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={
                  submitting ||
                  (activeTab === "file" && (!file || uploading || !!uploadError)) ||
                  (activeTab === "text" && !textBody.trim()) ||
                  (activeTab === "link" && (!linkUrl.trim() || !isValidUrl(linkUrl)))
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                    Capturing...
                  </>
                ) : (
                  "Capture to Desk"
                )}
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
