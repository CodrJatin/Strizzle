"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
  Settings, Users, Share2, ToggleLeft, ToggleRight, Trash2, 
  Loader2, AlertTriangle, ShieldCheck, Check, Search, Calendar,
  ArrowRight, ShieldAlert, Sparkles, FolderOpen, MoreVertical, X,
  Crown, Copy
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useConfirmStore } from "@/store/confirmStore";

interface PageProps {
  params: Promise<{ hiveId: string }>;
}

type TabType = "general" | "members" | "sharing" | "feed" | "danger";

const colorThemes = [
  { name: "blue", hex: "bg-blue-600 hover:bg-blue-700" },
  { name: "green", hex: "bg-emerald-600 hover:bg-emerald-700" },
  { name: "indigo", hex: "bg-indigo-600 hover:bg-indigo-700" },
  { name: "rose", hex: "bg-rose-600 hover:bg-rose-700" },
  { name: "amber", hex: "bg-amber-600 hover:bg-amber-700" },
];

export default function HiveSettingsPage({ params }: PageProps) {
  const { hiveId } = React.use(params);
  const router = useRouter();
  const utils = api.useUtils();
  const confirm = useConfirmStore((s) => s.confirm);

  const [activeTab, setActiveTab] = React.useState<TabType>("general");

  // Queries
  const { data: hive, isLoading: isLoadingHive } = api.hive.getHive.useQuery(
    { hiveId },
    { staleTime: 300000 } // Slow-changing hive details: 5 minutes
  );
  const { data: members, isLoading: isLoadingMembers } = api.member.getHiveMembers.useQuery(
    { hiveId },
    { staleTime: 120000 } // Standard hive members list: 2 minutes
  );
  const { data: invites, isLoading: isLoadingInvites } = api.invite.listInvites.useQuery(
    { hiveId },
    {
      enabled: activeTab === "sharing",
      staleTime: 120000, // Standard invite list: 2 minutes
    }
  );

  // Mutations
  const updateHiveMutation = api.hive.updateHive.useMutation({
    onSuccess: (updated) => {
      toast.success("Settings saved successfully!");
      utils.hive.getHive.invalidate({ hiveId });
      utils.hive.getUserHives.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save settings.");
    },
  });

  const deleteHiveMutation = api.hive.deleteHive.useMutation({
    onSuccess: () => {
      toast.success("Hive deleted successfully.");
      utils.hive.getUserHives.invalidate();
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete hive.");
    },
  });

  const changeRoleMutation = api.member.changeRole.useMutation({
    onMutate: async (variables) => {
      await utils.member.getHiveMembers.cancel({ hiveId });
      const previousMembers = utils.member.getHiveMembers.getData({ hiveId });

      utils.member.getHiveMembers.setData({ hiveId }, (old) => {
        if (!old) return old;
        return old.map((m) => m.userId === variables.userId ? { ...m, role: variables.role } : m);
      });

      return { previousMembers };
    },
    onError: (error, _variables, context) => {
      if (context?.previousMembers) {
        utils.member.getHiveMembers.setData({ hiveId }, context.previousMembers);
      }
      toast.error(error.message || "Something went wrong. Failed to change role.");
    },
    onSuccess: () => {
      toast.success("Member role updated successfully.");
    },
    onSettled: () => {
      utils.member.getHiveMembers.invalidate({ hiveId });
    }
  });

  const removeMemberMutation = api.member.removeMember.useMutation({
    onMutate: async (variables) => {
      await utils.member.getHiveMembers.cancel({ hiveId });
      const previousMembers = utils.member.getHiveMembers.getData({ hiveId });

      utils.member.getHiveMembers.setData({ hiveId }, (old) => {
        if (!old) return old;
        return old.filter((m) => m.userId !== variables.userId);
      });

      return { previousMembers };
    },
    onError: (error, _variables, context) => {
      if (context?.previousMembers) {
        utils.member.getHiveMembers.setData({ hiveId }, context.previousMembers);
      }
      toast.error(error.message || "Something went wrong. Failed to remove member.");
    },
    onSuccess: () => {
      toast.success("Member removed from hive.");
    },
    onSettled: () => {
      utils.member.getHiveMembers.invalidate({ hiveId });
      utils.hive.getHiveOverview.invalidate({ hiveId });
    }
  });

  const generateInviteMutation = api.invite.generateInviteLink.useMutation({
    onSuccess: () => {
      toast.success("Invite link generated!");
      utils.invite.listInvites.invalidate({ hiveId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate link.");
    },
  });

  const revokeInviteMutation = api.invite.revokeInvite.useMutation({
    onMutate: async (variables) => {
      await utils.invite.listInvites.cancel({ hiveId });
      const previousInvites = utils.invite.listInvites.getData({ hiveId });

      utils.invite.listInvites.setData({ hiveId }, (old) => {
        if (!old) return old;
        return old.filter((i) => i.id !== variables.inviteId);
      });

      return { previousInvites };
    },
    onError: (error, _variables, context) => {
      if (context?.previousInvites) {
        utils.invite.listInvites.setData({ hiveId }, context.previousInvites);
      }
      toast.error(error.message || "Something went wrong. Failed to revoke link.");
    },
    onSuccess: () => {
      toast.success("Invite link revoked.");
    },
    onSettled: () => {
      utils.invite.listInvites.invalidate({ hiveId });
    }
  });

  // General details Form state
  const [name, setName] = React.useState("");
  const [courseCode, setCourseCode] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [colorTheme, setColorTheme] = React.useState<string>("blue");

  // Sync Form State with Query Data
  React.useEffect(() => {
    if (hive) {
      setName(hive.name);
      setCourseCode(hive.courseCode || "");
      setDescription(hive.description || "");
      setColorTheme(hive.colorTheme);
    }
  }, [hive]);

  // Dirty-state check: true only when something has changed from the server data
  const generalHasChanges = hive
    ? name !== hive.name ||
      courseCode !== (hive.courseCode || "") ||
      description !== (hive.description || "") ||
      colorTheme !== hive.colorTheme
    : false;

  // Invite link generator state
  const [inviteRole, setInviteRole] = React.useState<"admin" | "member" | "viewer">("member");
  const [inviteExpiry, setInviteExpiry] = React.useState<string>("7d");
  const [inviteMaxUses, setInviteMaxUses] = React.useState<string>("unlimited");

  // Members search state
  const [memberSearchQuery, setMemberSearchQuery] = React.useState("");

  // Deletion confirm state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("");
  const [updatingFeedKey, setUpdatingFeedKey] = React.useState<string | null>(null);

  // Filtered members list
  const filteredMembers = React.useMemo(() => {
    if (!members) return [];
    const query = memberSearchQuery.toLowerCase().trim();
    if (!query) return members;
    return members.filter((m) =>
      m.user.fullName.toLowerCase().includes(query) ||
      m.userId.toLowerCase().includes(query)
    );
  }, [members, memberSearchQuery]);

  if (isLoadingHive) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!hive) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-2xl bg-card">
        <AlertTriangle className="size-12 text-destructive mb-3" />
        <h2 className="text-lg font-bold">Failed to load settings</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">
          Make sure you are a member of this workspace and have sufficient permissions.
        </p>
        <Button onClick={() => router.push("/dashboard")} variant="outline" className="mt-4">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const isOwner = hive.role === "owner";
  const isAdminOrOwner = hive.role === "admin" || hive.role === "owner";

  // If user is not admin/owner, restrict settings access
  if (!isAdminOrOwner) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border/80 rounded-2xl bg-card text-center">
        <ShieldAlert className="size-12 text-destructive mb-3" />
        <h2 className="text-lg font-bold">Unauthorized Settings Access</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
          Only administrators and owners possess permissions to access or edit hive configurations.
        </p>
        <Button onClick={() => router.push(`/hive/${hiveId}/overview`)} variant="outline" className="mt-4 rounded-xl text-xs font-semibold px-4 h-9">
          Return to Hive
        </Button>
      </div>
    );
  }

  const handleSaveGeneral = () => {
    if (!name.trim()) {
      toast.error("Hive name is required.");
      return;
    }
    updateHiveMutation.mutate({
      hiveId,
      name,
      courseCode: courseCode.trim() || null,
      description: description.trim() || null,
      colorTheme: colorTheme as any,
    });
  };

  const handleCancelGeneral = () => {
    setName(hive.name);
    setCourseCode(hive.courseCode || "");
    setDescription(hive.description || "");
    setColorTheme(hive.colorTheme);
  };

  const handleGenerateLink = () => {
    let expiresAt: string | null = null;
    if (inviteExpiry === "24h") {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    } else if (inviteExpiry === "7d") {
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    const maxUses = inviteMaxUses === "unlimited" ? null : parseInt(inviteMaxUses, 10);

    generateInviteMutation.mutate({
      hiveId,
      role: inviteRole,
      expiresAt,
      maxUses,
    });
  };

  const handleToggleFeedSetting = (key: string, enabled: boolean) => {
    setUpdatingFeedKey(key);
    const currentSettings = hive.feedSettings as Record<string, boolean>;
    const newSettings = {
      ...currentSettings,
      [key]: enabled,
    };
    updateHiveMutation.mutate({
      hiveId,
      feedSettings: newSettings,
    }, {
      onSettled: () => {
        setUpdatingFeedKey(null);
      }
    });
  };

  const handleDeleteHiveSubmit = () => {
    if (deleteConfirmName !== hive.name) {
      toast.error("Hive name does not match.");
      return;
    }
    deleteHiveMutation.mutate({ hiveId });
  };

  return (
    <div className="space-y-6">
      
      {/* Header identity */}
      <div className="border-b border-border/40 pb-4 select-none">
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="size-6 text-muted-foreground" />
          Hive Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage the details, members, invites, and appearance of {hive.name} study workspace.
        </p>
      </div>

      {/* Main Settings Grid Layout */}
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* RESPONSIVE NAVIGATION TABS (Col on desktop, Row on mobile) */}
        <div className="flex flex-row md:flex-col overflow-x-auto gap-2 md:w-52 shrink-0 md:border-r md:border-border/40 md:pr-4 pb-3 border-b border-border/20 md:border-b-0 md:pb-0 scrollbar-none select-none">
          <button
            onClick={() => setActiveTab("general")}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap text-left transition-all cursor-pointer w-full",
              activeTab === "general"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap text-left transition-all cursor-pointer w-full",
              activeTab === "members"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            Members & Access
          </button>
          <button
            onClick={() => setActiveTab("sharing")}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap text-left transition-all cursor-pointer w-full",
              activeTab === "sharing"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            Sharing & Invites
          </button>
          <button
            onClick={() => setActiveTab("feed")}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap text-left transition-all cursor-pointer w-full",
              activeTab === "feed"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            Feed Settings
          </button>
          {isOwner && (
            <button
              onClick={() => setActiveTab("danger")}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap text-left transition-all cursor-pointer w-full",
                activeTab === "danger"
                  ? "bg-destructive/10 text-destructive"
                  : "text-muted-foreground hover:bg-destructive/5 hover:text-destructive/80"
              )}
            >
              Danger Zone
            </button>
          )}
        </div>

        {/* ACTIVE TAB DETAILS CONTAINER */}
        <div className="flex-1 min-w-0">
          
          {/* TAB 1: GENERAL DETAILS */}
          {activeTab === "general" && (
            <Card className="border-border shadow-xs bg-card rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-border/40">
                <h3 className="text-sm font-bold text-foreground">General Details</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Update the core identity of this Hive.</p>
              </div>

              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  {/* Hive Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Hive Name</label>
                    <Input 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="Biology 101" 
                      className="rounded-xl border-border bg-card"
                    />
                  </div>

                  {/* Course Code */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Course Code (Optional)</label>
                    <Input 
                      value={courseCode} 
                      onChange={(e) => setCourseCode(e.target.value)} 
                      placeholder="BIO 201" 
                      className="rounded-xl border-border bg-card max-w-sm"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-muted-foreground">Description</label>
                      <span className="text-[10px] text-muted-foreground font-medium">{description.length}/250</span>
                    </div>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, 250))}
                      placeholder="Group description..."
                      rows={3}
                      className="w-full text-xs p-3 rounded-xl border border-border bg-card focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-muted-foreground/60 transition-all"
                    />
                  </div>

                  {/* Appearance Color Theme */}
                  <div className="space-y-2 border-t border-border/25 pt-4">
                    <h4 className="text-xs font-bold text-foreground">Appearance</h4>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      Select a color theme to help distinguish this Hive in your workspace.
                    </p>
                    <div className="flex items-center gap-3 pt-2">
                      {colorThemes.map((theme) => {
                        const isSelected = colorTheme === theme.name;
                        return (
                          <button
                            key={theme.name}
                            onClick={() => setColorTheme(theme.name)}
                            className={cn(
                              "size-9 rounded-full flex items-center justify-center transition-transform cursor-pointer relative shadow-sm border border-black/10 text-white shrink-0 hover:scale-105",
                              theme.hex
                            )}
                          >
                            {isSelected && <Check className="size-4.5 stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/30">
                  {generalHasChanges && (
                    <Button variant="ghost" onClick={handleCancelGeneral} className="rounded-xl text-xs font-semibold px-4 h-9">
                      Cancel
                    </Button>
                  )}
                  <Button 
                    onClick={handleSaveGeneral} 
                    disabled={updateHiveMutation.isPending || !generalHasChanges} 
                    className="rounded-xl text-xs font-semibold px-5 h-9 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateHiveMutation.isPending ? <Loader2 className="animate-spin size-3.5" /> : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: MEMBERS & ACCESS */}
          {activeTab === "members" && (
            <Card className="border-border shadow-xs bg-card rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Members & Access</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage permissions and participants in this hive.</p>
                </div>
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground/60" />
                  <Input
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Search members..."
                    className="h-9 text-xs pl-9 rounded-xl bg-card border-border/80"
                  />
                </div>
              </div>

              <CardContent className="p-4 space-y-1">
                {isLoadingMembers ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="animate-spin size-6 text-primary" />
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="size-10 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-muted-foreground">No members found.</p>
                  </div>
                ) : (
                  filteredMembers.map((member) => {
                    const isSelf = member.userId === hive.ownerId; // simplfy self-access check
                    const isOwnerRow = member.role === "owner";
                    const isCurrentUserRow = member.userId === hive.ownerId; // or simple match

                    return (
                      <div key={member.userId} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-all select-none">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Avatar Initials mock */}
                          <div className="size-9 rounded-full bg-primary/10 border border-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 select-none">
                            {member.user.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-foreground truncate">{member.user.fullName}</span>
                              {isOwnerRow && (
                                <span title="Workspace Owner">
                                  <Crown className="size-3.5 text-amber-500 fill-amber-500/20 shrink-0" />
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">user id &bull; {member.userId}</p>
                          </div>
                        </div>

                        {/* Action buttons (Dropdown roles or leave button) */}
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          {isOwnerRow ? (
                            <span className="text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase px-2 py-0.5 bg-muted/40 rounded-lg">
                              Owner
                            </span>
                          ) : (
                            <>
                              {/* Role Selector dropdown */}
                              <Select
                                value={member.role}
                                onValueChange={(val) => changeRoleMutation.mutate({ hiveId, userId: member.userId, role: val as any })}
                                disabled={changeRoleMutation.isPending}
                              >
                                <SelectTrigger className="h-8 text-xs w-28 rounded-lg bg-card">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>

                              {/* Remove participant button */}
                              <Button
                                onClick={async () => {
                                  const confirmed = await confirm({
                                    title: "Remove Member",
                                    description: `Are you sure you want to remove ${member.user.fullName} from the study group? They will lose all access to materials and tasks.`,
                                    confirmText: "Remove",
                                    variant: "destructive",
                                  });
                                  if (confirmed) {
                                    removeMemberMutation.mutate({ hiveId, userId: member.userId });
                                  }
                                }}
                                disabled={removeMemberMutation.isPending}
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0 cursor-pointer"
                                title="Remove member"
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 3: SHARING & INVITES */}
          {activeTab === "sharing" && (
            <div className="space-y-6">
              {/* Invite link generator */}
              <Card className="border-border shadow-xs bg-card rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border/40 pb-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Share2 className="size-4.5 text-primary" />
                    Generate Invite Link
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Onboard new collaborators to this hive.</p>
                </div>

                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                    {/* Role Choice */}
                    <div className="flex-1 space-y-1.5 min-w-[120px]">
                      <label className="text-xs font-semibold text-muted-foreground">Role</label>
                      <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as any)}>
                        <SelectTrigger className="h-9.5 text-xs rounded-xl bg-card border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Expiry Choice */}
                    <div className="flex-1 space-y-1.5 min-w-[120px]">
                      <label className="text-xs font-semibold text-muted-foreground">Expires After</label>
                      <Select value={inviteExpiry} onValueChange={setInviteExpiry}>
                        <SelectTrigger className="h-9.5 text-xs rounded-xl bg-card border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="7d">7 days</SelectItem>
                          <SelectItem value="24h">24 hours</SelectItem>
                          <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Max Uses Choice */}
                    <div className="flex-1 space-y-1.5 min-w-[120px]">
                      <label className="text-xs font-semibold text-muted-foreground">Max Uses</label>
                      <Select value={inviteMaxUses} onValueChange={setInviteMaxUses}>
                        <SelectTrigger className="h-9.5 text-xs rounded-xl bg-card border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="unlimited">Unlimited</SelectItem>
                          <SelectItem value="1">1 use</SelectItem>
                          <SelectItem value="10">10 uses</SelectItem>
                          <SelectItem value="50">50 uses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Generate Button */}
                    <Button 
                      onClick={handleGenerateLink} 
                      disabled={generateInviteMutation.isPending}
                      className="rounded-xl text-xs font-semibold h-9.5 px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shrink-0 sm:ml-auto"
                    >
                      {generateInviteMutation.isPending ? <Loader2 className="animate-spin size-3.5" /> : "Generate Link"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Active Links list */}
              <Card className="border-border shadow-xs bg-card rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border/40 pb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Active Links</h3>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase px-2 py-0.5 bg-muted/40 rounded-lg">
                    {invites?.length || 0} active
                  </span>
                </div>

                <CardContent className="p-4 space-y-1 select-none">
                  {isLoadingInvites ? (
                    <div className="py-8 flex justify-center">
                      <Loader2 className="animate-spin size-5 text-primary" />
                    </div>
                  ) : !invites || invites.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No active invite links generated.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {invites.map((invite) => {
                        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
                        const fullUrl = `${baseUrl}/invite/${invite.token}`;
                        const isExpired = invite.expiresAt && new Date() > new Date(invite.expiresAt);
                        const isRevoked = !!invite.revokedAt;
                        const isInvalid = isExpired || isRevoked;

                        return (
                          <div key={invite.id} className={cn("py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 first:pt-0 last:pb-0", isInvalid && "opacity-50")}>
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground truncate max-w-xs">{fullUrl}</span>
                                <Button
                                  onClick={() => {
                                    navigator.clipboard.writeText(fullUrl);
                                    toast.success("Link URL copied to clipboard!");
                                  }}
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 rounded hover:bg-muted text-muted-foreground shrink-0 cursor-pointer"
                                >
                                  <Copy className="size-3.5" />
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground font-medium">
                                Role: <span className="font-bold text-foreground capitalize">{invite.role}</span> &bull; 
                                Expiry: <span className="font-bold text-foreground">{invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : "Never"}</span> &bull; 
                                Uses: <span className="font-bold text-foreground">{invite.useCount} / {invite.maxUses ?? "∞"}</span>
                              </p>
                            </div>

                            {/* Revoke action */}
                            {!isInvalid && (
                              <Button
                                onClick={async () => {
                                  const confirmed = await confirm({
                                    title: "Revoke Invite Link",
                                    description: "Are you sure you want to revoke this invite link? Anyone who tries to use it will no longer be able to join.",
                                    confirmText: "Revoke",
                                    variant: "destructive",
                                  });
                                  if (confirmed) {
                                    revokeInviteMutation.mutate({ inviteId: invite.id });
                                  }
                                }}
                                disabled={revokeInviteMutation.isPending}
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-semibold rounded-lg hover:text-destructive hover:border-destructive/20 shrink-0 cursor-pointer"
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 4: FEED SETTINGS */}
          {activeTab === "feed" && (
            <Card className="border-border shadow-xs bg-card rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-border/40 pb-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <ToggleRight className="size-4.5 text-primary" />
                  Feed Settings
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure what events are registered inside the workspace activity feed.</p>
              </div>

              <CardContent className="p-6 space-y-6 select-none">
                <div className="space-y-5">
                  {/* Toggle: Member Joins */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-muted/10 transition-all">
                    <div className="space-y-0.5 pr-4">
                      <h4 className="text-xs font-bold text-foreground">Member Joins</h4>
                      <p className="text-[10px] text-muted-foreground leading-normal">Log announcements when new classmates accept invites.</p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {updatingFeedKey === "show_member_joins" && (
                        <Loader2 className="animate-spin size-3.5 text-primary" />
                      )}
                      <Switch
                        checked={!!(hive.feedSettings as any)?.show_member_joins}
                        onCheckedChange={(checked: boolean) => handleToggleFeedSetting("show_member_joins", checked)}
                        disabled={updateHiveMutation.isPending}
                      />
                    </div>
                  </div>

                  {/* Toggle: Material Uploads */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-muted/10 transition-all">
                    <div className="space-y-0.5 pr-4">
                      <h4 className="text-xs font-bold text-foreground">Material Uploads</h4>
                      <p className="text-[10px] text-muted-foreground leading-normal">Register updates when files or URLs are shared to folders.</p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {updatingFeedKey === "show_material_uploads" && (
                        <Loader2 className="animate-spin size-3.5 text-primary" />
                      )}
                      <Switch
                        checked={!!(hive.feedSettings as any)?.show_material_uploads}
                        onCheckedChange={(checked: boolean) => handleToggleFeedSetting("show_material_uploads", checked)}
                        disabled={updateHiveMutation.isPending}
                      />
                    </div>
                  </div>

                  {/* Toggle: Announcement Posts */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-muted/10 transition-all">
                    <div className="space-y-0.5 pr-4">
                      <h4 className="text-xs font-bold text-foreground">Announcements</h4>
                      <p className="text-[10px] text-muted-foreground leading-normal">Register feeds when admins or owners publish pinned updates.</p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {updatingFeedKey === "show_announcement_posts" && (
                        <Loader2 className="animate-spin size-3.5 text-primary" />
                      )}
                      <Switch
                        checked={!!(hive.feedSettings as any)?.show_announcement_posts}
                        onCheckedChange={(checked: boolean) => handleToggleFeedSetting("show_announcement_posts", checked)}
                        disabled={updateHiveMutation.isPending}
                      />
                    </div>
                  </div>

                  {/* Toggle: Task Deadlines */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-muted/10 transition-all">
                    <div className="space-y-0.5 pr-4">
                      <h4 className="text-xs font-bold text-foreground">Tasks & Deadlines</h4>
                      <p className="text-[10px] text-muted-foreground leading-normal">Post activity nodes when calendar tasks are generated.</p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {updatingFeedKey === "show_task_deadlines" && (
                        <Loader2 className="animate-spin size-3.5 text-primary" />
                      )}
                      <Switch
                        checked={!!(hive.feedSettings as any)?.show_task_deadlines}
                        onCheckedChange={(checked: boolean) => handleToggleFeedSetting("show_task_deadlines", checked)}
                        disabled={updateHiveMutation.isPending}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 5: DANGER ZONE */}
          {activeTab === "danger" && isOwner && (
            <Card className="border-destructive/30 shadow-xs bg-card rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-destructive/20 bg-destructive/[0.02]">
                <h3 className="text-sm font-bold text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="size-4.5 stroke-[2]" />
                  Advanced Settings (Danger Zone)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Destructive actions can cause permanent data loss.</p>
              </div>

              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-destructive/20 p-5 rounded-xl bg-destructive/[0.01] gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-destructive">Delete this hive</h4>
                    <p className="text-[11px] text-muted-foreground leading-normal max-w-md">
                      Once you delete a hive, there is no going back. This action will permanently remove all associated materials, tasks, and notes within <span className="font-semibold text-foreground">"{hive.name}"</span>. Please be certain.
                    </p>
                  </div>
                  <Button 
                    onClick={() => { setDeleteConfirmName(""); setDeleteDialogOpen(true); }}
                    variant="destructive"
                    className="rounded-xl text-xs font-semibold px-4 h-9 shrink-0 cursor-pointer"
                  >
                    Delete Hive
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* DELETE HIVE CONFIRMATION DIALOG */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5" />
              Delete Hive Permanently?
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All shared notes, uploads, members, and resources will be deleted forever.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2 select-none">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Please type the name of the hive <span className="font-bold text-foreground">"{hive.name}"</span> to confirm.
            </p>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Type hive name exactly"
              className="rounded-xl border-border bg-card text-xs h-9.5"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} className="rounded-xl text-xs font-semibold h-9.5 px-4">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteHiveSubmit}
              disabled={deleteHiveMutation.isPending || deleteConfirmName !== hive.name}
              className="rounded-xl text-xs font-semibold h-9.5 px-5 cursor-pointer"
            >
              {deleteHiveMutation.isPending ? <Loader2 className="animate-spin size-4" /> : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
