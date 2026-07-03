"use client";

import * as React from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { api } from "@/lib/trpc/client";
import { updateProfileSchema } from "@/types/user";
import { createClient } from "@/lib/supabase/client";

type ProfileFormValues = {
  fullName: string;
};

export default function ProfileSettingsPage() {
  const utils = api.useUtils();
  const supabase = createClient();

  const [avatarPreviewUrl, setAvatarPreviewUrl] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  // Fetch current user details
  const { data: me, isLoading: isLoadingUser } = api.user.getMe.useQuery(undefined, {
    staleTime: 900000, // 15 mins
  });

  const updateProfileMutation = api.user.updateProfile.useMutation({
    onMutate: async (updated) => {
      await utils.user.getMe.cancel();
      const previousMe = utils.user.getMe.getData();
      utils.user.getMe.setData(undefined, (old) => {
        if (!old) return old;
        return { ...old, fullName: updated.fullName };
      });
      return { previousMe };
    },
    onError: (err, _variables, context) => {
      if (context?.previousMe) {
        utils.user.getMe.setData(undefined, context.previousMe);
      }
      toast.error(err.message || "Something went wrong. Please try again.");
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
    },
    onSettled: () => {
      utils.user.getMe.invalidate();
    }
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(updateProfileSchema.pick({ fullName: true })),
    defaultValues: {
      fullName: "",
    },
  });

  // Sync profile data once loaded
  React.useEffect(() => {
    if (me) {
      setValue("fullName", me.fullName);
      setAvatarPreviewUrl(me.avatarUrl);
    }
  }, [me, setValue]);

  // Initials generator
  const getInitials = (name: string) => {
    if (!name) return "SH";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !me) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File exceeds recommended 2MB limit");
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid image (JPEG, PNG, GIF)");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${me.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setAvatarPreviewUrl(publicUrlData.publicUrl);
      
      // Update database profile
      await updateProfileMutation.mutateAsync({
        fullName: me.fullName,
        avatarUrl: publicUrlData.publicUrl,
      });

      toast.success("Profile picture updated!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Failed to upload profile photo");
    } finally {
      setIsUploading(false);
    }
  };

  const onProfileSubmit = (data: ProfileFormValues) => {
    updateProfileMutation.mutate({
      fullName: data.fullName,
    });
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-[50vh] flex flex-col justify-center items-center font-sans">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-4">Loading user profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans max-w-2xl">
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Public Profile
        </h1>
      </div>

      {/* Profile picture editor */}
      <div className="flex items-center gap-6">
        <div className="relative group size-20">
          {avatarPreviewUrl ? (
            <img
              src={avatarPreviewUrl}
              alt="Avatar Preview"
              className="size-20 rounded-full object-cover border border-border bg-muted shadow-sm"
            />
          ) : (
            <div className="size-20 rounded-full bg-primary/10 text-primary font-bold text-2xl flex items-center justify-center border border-primary/20 shadow-inner">
              {getInitials(me?.fullName || "")}
            </div>
          )}
          <label 
            htmlFor="avatar-upload" 
            className="absolute bottom-0 right-0 size-7 bg-card border border-border rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-muted transition-colors"
          >
            {isUploading ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : (
              <Camera className="size-3.5 text-muted-foreground" />
            )}
            <input
              id="avatar-upload"
              type="file"
              accept="image/jpeg,image/png,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
              disabled={isUploading}
            />
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">Profile Picture</span>
          <span className="text-xs text-muted-foreground">
            Recommended size: 256&times;256px. Formats: JPG, PNG, GIF.
          </span>
        </div>
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="fullName" className="text-sm font-semibold text-foreground">Full Name</Label>
          <InputGroup className={errors.fullName ? "border-destructive h-11" : "h-11"}>
            <InputGroupInput
              id="fullName"
              type="text"
              placeholder="Jane Doe"
              disabled={updateProfileMutation.isPending}
              {...register("fullName")}
              className="px-4 text-foreground placeholder:text-muted-foreground"
            />
          </InputGroup>
          <span className="text-xs text-muted-foreground">
            This name will be displayed to other students in your Hives.
          </span>
          {errors.fullName && (
            <p className="text-xs text-destructive mt-1 font-medium">{errors.fullName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-semibold text-foreground">Email Address</Label>
          <InputGroup className="bg-muted/10 border-border/80 h-11 opacity-90 select-none">
            <InputGroupInput
              id="email"
              type="email"
              value={me?.email || ""}
              disabled
              className="cursor-not-allowed px-4 text-muted-foreground"
            />
          </InputGroup>
        </div>

        <div className="pt-2 border-t border-border flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setValue("fullName", me?.fullName || "")}
            className="h-10 rounded-xl px-5 text-muted-foreground font-semibold hover:bg-muted/30"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateProfileMutation.isPending}
            className="h-10 rounded-xl px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm cursor-pointer shadow-sm"
          >
            {updateProfileMutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
