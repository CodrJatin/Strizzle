"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { User, Upload, Check, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Brand } from "@/components/Brand";
import { api } from "@/lib/trpc/client";
import { useThemeStore } from "@/store/themeStore";

// Step 1 schema
const nameSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100, "Full name is too long"),
});

type NameSchema = z.infer<typeof nameSchema>;

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/dashboard";

  // State
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [direction, setDirection] = React.useState<number>(0);
  const [dragActive, setDragActive] = React.useState(false);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = React.useState<string | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [selectedTheme, setSelectedTheme] = React.useState<string>("default");
  const [matchSystem, setMatchSystem] = React.useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = React.useState(true);

  const setTheme = useThemeStore((s) => s.setTheme);

  // tRPC calls
  const utils = api.useUtils();
  const { data: me, isLoading: isLoadingMe } = api.user.getMe.useQuery(undefined, {
    staleTime: 900000, // 15 mins
    retry: false,
  });

  const completeOnboardingMutation = api.user.completeOnboarding.useMutation({
    onSuccess: () => {
      utils.user.getMe.invalidate();
      toast.success("Profile setup complete!");
      router.push(returnUrl);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to complete setup. Please try again.");
    },
  });

  // Supabase browser client
  const supabase = createClient();

  // Redirect if already onboarded
  React.useEffect(() => {
    if (!isLoadingMe) {
      if (me) {
        // User already onboarded, send to returnUrl or dashboard
        router.push(returnUrl);
      } else {
        setIsAuthChecking(false);
      }
    }
  }, [me, isLoadingMe, router, returnUrl]);

  // Handle case where user is not logged in at all (auth middleware will handle this, but double check)
  React.useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !isLoadingMe) {
        router.push(`/login?returnUrl=/onboarding`);
      }
    };
    checkSession();
  }, [router, supabase, isLoadingMe]);

  // Step 1: Form
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<NameSchema>({
    resolver: zodResolver(nameSchema),
    defaultValues: {
      fullName: "",
    },
  });

  const fullNameValue = watch("fullName", "");

  const onNameSubmit = (data: NameSchema) => {
    setDirection(1);
    setStep(2);
  };

  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    if (!name) return "SH";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Step 2: Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    validateAndSetAvatar(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    validateAndSetAvatar(file);
  };

  const validateAndSetAvatar = (file: File | undefined) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File exceeds 5MB limit");
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid image (JPEG, PNG, GIF, SVG)");
      return;
    }

    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  // Step 2: Upload logic
  const handleStep2Submit = async () => {
    if (!avatarFile) {
      setDirection(1);
      setStep(3);
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User session not found. Please log in.");
        setIsUploading(false);
        return;
      }

      const fileExt = avatarFile.name.split(".").pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, avatarFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setUploadedAvatarUrl(publicUrlData.publicUrl);
      setDirection(1);
      setStep(3);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload profile photo");
    } finally {
      setIsUploading(false);
    }
  };

  // Step 3: Complete Setup
  const handleCompleteSetup = () => {
    completeOnboardingMutation.mutate({
      fullName: fullNameValue,
      avatarUrl: uploadedAvatarUrl,
      theme: matchSystem ? "system" : selectedTheme,
    });
  };

  // Animation variants
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut" as const,
      },
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 50 : -50,
      opacity: 0,
      transition: {
        duration: 0.25,
        ease: "easeIn" as const,
      },
    }),
  };

  if (isAuthChecking || isLoadingMe) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center font-sans">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-4">Loading setup details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between items-center p-6 md:p-12 relative overflow-hidden font-sans">
      {/* Background glow effects - strictly CSS variables */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,var(--primary),transparent_50%)] opacity-[0.03] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,var(--primary),transparent_50%)] opacity-[0.02] pointer-events-none" />

      {/* Top Header */}
      <div className="w-full flex justify-center py-4 z-10">
        {step === 2 ? (
          <Brand size="lg" />
        ) : (
          <Brand size="lg" textClassName="hidden" />
        )}
      </div>

      {/* Main card */}
      <main className="w-full max-w-[480px] my-auto z-10 flex flex-col items-center">
        <div className="w-full bg-card text-card-foreground border border-border rounded-3xl shadow-xl p-8 md:p-10 flex flex-col relative overflow-hidden">
          
          {/* Progress Indicator */}
          <div className="flex gap-2 justify-center items-center w-full max-w-[160px] mx-auto mb-8">
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-300", step >= 1 ? "bg-primary" : "bg-muted")} />
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-300", step >= 2 ? "bg-primary" : "bg-muted")} />
            <div className={cn("h-1 flex-1 rounded-full transition-all duration-300", step >= 3 ? "bg-primary" : "bg-muted")} />
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="flex flex-col w-full"
              >
                <div className="text-center space-y-2 mb-8">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    What should we call you?
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Step 1 of 3
                  </p>
                </div>

                <form onSubmit={handleSubmit(onNameSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-sm font-medium text-foreground">
                      Full name
                    </Label>
                    <InputGroup className={cn("h-10 transition-all", errors.fullName && "border-destructive")}>
                      <InputGroupAddon align="inline-start">
                        <User className="size-4 text-muted-foreground" />
                      </InputGroupAddon>
                      <InputGroupInput
                        id="fullName"
                        type="text"
                        placeholder="e.g. Jane Doe"
                        {...register("fullName")}
                        className="text-foreground placeholder:text-muted-foreground"
                      />
                    </InputGroup>
                    {errors.fullName && (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                        <Info className="size-3" />
                        {errors.fullName.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 mt-6 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    Continue
                  </Button>
                </form>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="flex flex-col w-full"
              >
                <div className="text-center space-y-2 mb-6">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Add a profile photo
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Help your classmates recognize you
                  </p>
                </div>

                <div className="flex flex-col items-center">
                  {/* Photo Preview Container */}
                  <div className="relative mb-6">
                    {avatarPreviewUrl ? (
                      <img
                        src={avatarPreviewUrl}
                        alt="Avatar Preview"
                        className="size-24 rounded-full object-cover border border-border bg-muted shadow-sm"
                      />
                    ) : (
                      <div className="size-24 rounded-full bg-primary/10 text-primary font-bold text-3xl flex items-center justify-center border border-primary/20 shadow-inner">
                        {getInitials(fullNameValue)}
                      </div>
                    )}
                  </div>

                  {/* Drag and drop zone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={cn(
                      "w-full rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 select-none flex flex-col items-center justify-center min-h-[140px]",
                      dragActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30 bg-muted/20"
                    )}
                    onClick={() => document.getElementById("avatar-file-input")?.click()}
                  >
                    <input
                      id="avatar-file-input"
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/gif,image/svg+xml"
                      onChange={handleFileChange}
                    />
                    <Upload className="size-6 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-primary">
                      Click to upload <span className="text-muted-foreground font-normal">or drag a photo</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      SVG, PNG, JPG or GIF (max. 5MB)
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  <Button
                    onClick={handleStep2Submit}
                    disabled={isUploading}
                    className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isUploading && <Loader2 className="size-4 animate-spin" />}
                    Continue
                  </Button>
                  <button
                    onClick={() => {
                      setDirection(1);
                      setStep(3);
                    }}
                    disabled={isUploading}
                    className="w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground py-2 transition-colors cursor-pointer"
                  >
                    Skip for now
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="flex flex-col w-full"
              >
                <div className="text-center space-y-2 mb-6">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Pick your look
                  </h1>
                  <p className="text-sm text-muted-foreground px-2">
                    Step 3 of 3: Choose a theme that suits your study environment.
                  </p>
                </div>

                {/* Theme Selector Cards */}
                <div className="grid grid-cols-2 gap-4 my-2">
                  {/* Theme 1: Light */}
                  <div
                    onClick={() => {
                      if (!matchSystem) {
                        setSelectedTheme("default");
                        setTheme("default");
                      }
                    }}
                    className={cn(
                      "group flex flex-col gap-2 cursor-pointer rounded-2xl border p-2 transition-all",
                      matchSystem && "opacity-50 cursor-not-allowed",
                      !matchSystem && selectedTheme === "default"
                        ? "border-primary ring-2 ring-primary/20 shadow-sm"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="relative aspect-[4/3] rounded-lg border border-slate-200 bg-white p-2.5 flex flex-col gap-1.5 overflow-hidden">
                      {/* Visual representations */}
                      <div className="h-2 w-full bg-blue-600 rounded" />
                      <div className="h-1.5 w-3/4 bg-slate-200 rounded" />
                      <div className="h-1.5 w-1/2 bg-slate-200 rounded" />
                      {!matchSystem && selectedTheme === "default" && (
                        <div className="absolute top-1.5 right-1.5 size-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center border border-background shadow">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-center text-foreground py-0.5">
                      Light Mode
                    </span>
                  </div>

                  {/* Theme 2: Dark */}
                  <div
                    onClick={() => {
                      if (!matchSystem) {
                        setSelectedTheme("dark");
                        setTheme("dark");
                      }
                    }}
                    className={cn(
                      "group flex flex-col gap-2 cursor-pointer rounded-2xl border p-2 transition-all",
                      matchSystem && "opacity-50 cursor-not-allowed",
                      !matchSystem && selectedTheme === "dark"
                        ? "border-primary ring-2 ring-primary/20 shadow-sm"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="relative aspect-[4/3] rounded-lg border border-slate-800 bg-slate-900 p-2.5 flex flex-col gap-1.5 overflow-hidden">
                      <div className="h-2 w-full bg-indigo-500 rounded" />
                      <div className="h-1.5 w-3/4 bg-slate-700 rounded" />
                      <div className="h-1.5 w-1/2 bg-slate-700 rounded" />
                      {!matchSystem && selectedTheme === "dark" && (
                        <div className="absolute top-1.5 right-1.5 size-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center border border-background shadow">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-center text-foreground py-0.5">
                      Dark Mode
                    </span>
                  </div>

                  {/* Theme 3: Sepia */}
                  <div
                    onClick={() => {
                      if (!matchSystem) {
                        setSelectedTheme("sepia");
                        setTheme("sepia");
                      }
                    }}
                    className={cn(
                      "group flex flex-col gap-2 cursor-pointer rounded-2xl border p-2 transition-all",
                      matchSystem && "opacity-50 cursor-not-allowed",
                      !matchSystem && selectedTheme === "sepia"
                        ? "border-primary ring-2 ring-primary/20 shadow-sm"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="relative aspect-[4/3] rounded-lg border border-amber-200/50 bg-[#faf6ef] p-2.5 flex flex-col gap-1.5 overflow-hidden">
                      <div className="h-2 w-full bg-[#a0522d] rounded" />
                      <div className="h-1.5 w-3/4 bg-amber-100/80 rounded" />
                      <div className="h-1.5 w-1/2 bg-amber-100/80 rounded" />
                      {!matchSystem && selectedTheme === "sepia" && (
                        <div className="absolute top-1.5 right-1.5 size-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center border border-background shadow">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-center text-foreground py-0.5">
                      Sepia
                    </span>
                  </div>

                  {/* Theme 4: High Contrast */}
                  <div
                    onClick={() => {
                      if (!matchSystem) {
                        setSelectedTheme("high-contrast");
                        setTheme("high-contrast");
                      }
                    }}
                    className={cn(
                      "group flex flex-col gap-2 cursor-pointer rounded-2xl border p-2 transition-all",
                      matchSystem && "opacity-50 cursor-not-allowed",
                      !matchSystem && selectedTheme === "high-contrast"
                        ? "border-primary ring-2 ring-primary/20 shadow-sm"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="relative aspect-[4/3] rounded-lg border-2 border-white bg-black p-2.5 flex flex-col gap-1.5 overflow-hidden">
                      <div className="h-2 w-full bg-yellow-400 rounded" />
                      <div className="h-1.5 w-3/4 bg-white rounded" />
                      <div className="h-1.5 w-1/2 bg-white rounded" />
                      {!matchSystem && selectedTheme === "high-contrast" && (
                        <div className="absolute top-1.5 right-1.5 size-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center border border-background shadow">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-center text-foreground py-0.5">
                      High Contrast
                    </span>
                  </div>
                </div>

                {/* Match system settings toggle */}
                <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-2xl mt-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-foreground">
                      Match system settings
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Automatically switch based on device
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={matchSystem}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setMatchSystem(checked);
                        setTheme(checked ? "system" : selectedTheme);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                  </label>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setDirection(-1);
                      setStep(2);
                    }}
                    className="w-1/3 h-10 border border-border hover:bg-muted/30 font-medium rounded-xl transition-colors cursor-pointer text-sm text-foreground"
                  >
                    Back
                  </button>
                  <Button
                    onClick={handleCompleteSetup}
                    disabled={completeOnboardingMutation.isPending}
                    className="flex-1 h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {completeOnboardingMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                    Complete Setup
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="w-full text-center py-4 z-10">
        <p className="text-xs text-muted-foreground">
          &copy; 2024 StudySphere Inc. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col justify-center items-center font-sans">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground mt-4">Loading setup...</p>
        </div>
      }
    >
      <OnboardingContent />
    </React.Suspense>
  );
}
