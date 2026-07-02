"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
  Users, Loader2, AlertTriangle, ArrowRight, Beaker, Mail, Check, 
  XCircle, LogIn, Compass, ShieldAlert, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Brand } from "@/components/Brand";
import { api } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ token: string }>;
}

// Google SVG Icon Component
const GoogleIcon = () => (
  <svg className="size-4 mr-2" viewBox="0 0 24 24">
    <path
      fill="#EA4335"
      d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3A11.966 11.966 0 0 0 12 0C7.27 0 3.197 2.573 1.055 6.377l4.21 3.388z"
    />
    <path
      fill="#34A853"
      d="M16.04 15.345c-1.077.733-2.459 1.164-4.04 1.164-2.955 0-5.46-1.996-6.355-4.686L1.41 15.19A11.966 11.966 0 0 0 12 24c3.245 0 6.18-1.086 8.41-2.945l-4.37-3.71z"
    />
    <path
      fill="#4285F4"
      d="M23.755 12.273c0-.818-.073-1.609-.205-2.373H12v4.5h6.6c-.286 1.486-1.127 2.745-2.39 3.595l4.37 3.71c2.555-2.355 4.175-5.823 4.175-9.432z"
    />
    <path
      fill="#FBBC05"
      d="M5.645 11.823c0-.605.105-1.19.29-1.745l-4.21-3.387A11.922 11.922 0 0 0 0 12c0 1.873.432 3.645 1.205 5.223l4.35-3.682a7.11 7.11 0 0 1-.225-1.718z"
    />
  </svg>
);

export default function InvitePage({ params }: PageProps) {
  const { token } = React.use(params);
  const router = useRouter();

  // Fetch authenticated user profile
  const { data: me, isLoading: isLoadingMe } = api.user.getMe.useQuery(undefined, {
    retry: false,
    staleTime: 900000,
  });

  // Fetch invite details
  const { data: invite, isLoading: isLoadingInvite, error: inviteError } = api.invite.getInviteByToken.useQuery(
    { token },
    { retry: false }
  );

  // Mutation to accept the invite
  const acceptInviteMutation = api.invite.acceptInvite.useMutation({
    onSuccess: (data) => {
      if (data.alreadyMember) {
        toast.info("You are already a member of this hive.");
      } else {
        toast.success("Successfully joined the hive!");
      }
      router.push(`/hive/${data.hiveId}/overview`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to accept invite.");
    },
  });

  // Handle OAuth Google Login
  const handleGoogleLogin = async () => {
    try {
      const supabase = createClient();
      const redirectToUrl = new URL("/auth/callback", window.location.origin);
      redirectToUrl.searchParams.set("returnUrl", `/invite/${token}`);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectToUrl.toString(),
        },
      });

      if (error) {
        toast.error(error.message);
      }
    } catch (err) {
      toast.error("Something went wrong with Google Sign In.");
    }
  };

  // Redirect to Email Sign in with returnUrl
  const handleEmailSignIn = () => {
    const returnUrl = encodeURIComponent(`/invite/${token}`);
    router.push(`/login?returnUrl=${returnUrl}`);
  };

  // Redirect to Register with returnUrl
  const handleRegisterRedirect = () => {
    const returnUrl = encodeURIComponent(`/invite/${token}`);
    router.push(`/register?returnUrl=${returnUrl}`);
  };

  // Redirect to Hive Overview if already a member
  React.useEffect(() => {
    if (invite?.isAlreadyMember) {
      router.push(`/hive/${invite.hiveId}/overview`);
    }
  }, [invite, router]);

  // Loading state
  const isLoading = isLoadingInvite || isLoadingMe;
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-semibold animate-pulse">Loading invitation details...</p>
        </div>
      </div>
    );
  }

  // Already a member (while redirecting)
  if (invite?.isAlreadyMember) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-semibold">Redirecting to hive overview...</p>
        </div>
      </div>
    );
  }

  // Validate Invite
  const isExpired = invite?.expiresAt ? new Date() > new Date(invite.expiresAt) : false;
  const isMaxedOut = invite?.maxUses !== null && invite && invite.useCount >= invite.maxUses;
  const isInvalid = !invite || inviteError || invite.revokedAt || isExpired || isMaxedOut;

  // 1. INVALID / EXPIRED STATE (Design 3)
  if (isInvalid) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-zinc-50/50 dark:bg-zinc-950">
        {/* Top brand bar */}
        <header className="p-6 flex justify-center w-full">
          <div className="opacity-80">
            <Brand size="sm" />
          </div>
        </header>

        {/* Center error box */}
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border border-border/80 bg-card rounded-2xl shadow-md overflow-hidden flex flex-col items-center p-6 text-center select-none animate-in fade-in zoom-in-95 duration-200">
            <div className="size-14 rounded-full bg-red-500/10 dark:bg-red-500/15 border border-red-500/25 flex items-center justify-center mb-5 shadow-inner">
              <XCircle className="size-7 text-red-500" />
            </div>
            
            <CardHeader className="p-0 space-y-2">
              <CardTitle className="text-lg md:text-xl font-black tracking-tight text-foreground leading-tight">
                This invite has expired or is no longer valid
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground max-w-[320px] mx-auto leading-normal">
                The link you followed may have reached its usage limit or been manually deactivated by the hive owner.
              </CardDescription>
            </CardHeader>

            <CardFooter className="w-full p-0 pt-6 mt-2 border-t border-border/40">
              <Button 
                onClick={() => router.push("/dashboard")} 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/95 font-bold h-10.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                Go to Strizzle
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Footer */}
        <footer className="p-6 text-center text-[10px] text-muted-foreground/60">
          Strizzle personal study hives • © 2026
        </footer>
      </div>
    );
  }

  // 2. UNAUTHENTICATED STATE: Render login in context (Design 1)
  if (!me) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-zinc-50/50 dark:bg-zinc-950">
        <header className="p-6 flex justify-center w-full">
          <div className="opacity-80">
            <Brand size="sm" />
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border-t-[4px] border-t-emerald-500 border-x border-b border-border/80 bg-card rounded-2xl shadow-md overflow-hidden flex flex-col p-6 select-none animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex flex-col items-center text-center">
              {/* Chemistry/Flask icon container */}
              <div className="size-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-500">
                <Beaker className="size-8" />
              </div>

              {/* Hive Header details */}
              <h2 className="text-xl font-bold text-foreground text-center tracking-tight">{invite.hiveName}</h2>
              {invite.courseCode && (
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-1">
                  {invite.courseCode}
                </p>
              )}

              {/* Invited badge */}
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full mt-4 uppercase tracking-wider">
                <Users className="size-3.5 shrink-0" />
                <span>You are invited as a <span className="font-extrabold capitalize">{invite.role}</span></span>
              </div>
            </div>

            <div className="w-full border-t border-border/60 my-6" />

            <div className="space-y-4 text-center">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Sign in to join this hive</h3>
                <p className="text-xs text-muted-foreground leading-normal max-w-[280px] mx-auto">
                  Choose a sign-in method to accept your invitation and access course materials.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <Button 
                  onClick={handleGoogleLogin}
                  variant="outline" 
                  className="w-full bg-card hover:bg-muted border-border/80 font-bold h-11 rounded-xl flex items-center justify-center text-xs shadow-xs cursor-pointer text-foreground"
                >
                  <GoogleIcon />
                  Sign in with Google
                </Button>

                <Button 
                  onClick={handleEmailSignIn}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/95 font-bold h-11 rounded-xl flex items-center justify-center text-xs gap-2 shadow-xs cursor-pointer"
                >
                  <Mail className="size-4" />
                  Sign in with email
                </Button>
              </div>

              <div className="pt-2">
                <p className="text-xs text-muted-foreground font-semibold">
                  Don't have an account?{" "}
                  <button 
                    onClick={handleRegisterRedirect}
                    className="text-primary hover:underline font-extrabold cursor-pointer"
                  >
                    Register
                  </button>
                </p>
              </div>
            </div>

          </Card>
        </div>

        <footer className="p-6 text-center text-[10px] text-muted-foreground/60">
          Strizzle personal study hives • © 2026
        </footer>
      </div>
    );
  }

  // 3. AUTHENTICATED STATE: Render accept dialog (Design 2)
  return (
    <div className="min-h-screen flex flex-col justify-between bg-zinc-50/50 dark:bg-zinc-950">
      <header className="p-6 flex justify-center w-full">
        <div className="opacity-80">
          <Brand size="sm" />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border border-border/80 bg-card rounded-2xl shadow-md overflow-hidden select-none animate-in fade-in zoom-in-95 duration-200">
          {/* Top Section */}
          <div className="p-6 pb-5 flex flex-col items-center text-center">
            {/* Hexagon style icon container */}
            <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary">
              <Compass className="size-4.5" />
            </div>

            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Invited to Join</p>
            <h2 className="text-xl font-bold text-foreground tracking-tight mt-1">{invite.hiveName}</h2>
            {invite.courseCode && (
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                {invite.courseCode}
              </p>
            )}
          </div>

          {/* Full-width emerald green horizontal bar divider */}
          <div className="h-[3px] bg-emerald-500 w-full" />

          {/* Bottom Section */}
          <div className="p-6 pt-5 space-y-5">
            <div className="bg-muted/40 border border-border/50 rounded-xl p-3 flex items-center gap-3.5">
              <div className="size-9 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Users className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground font-bold leading-normal">
                  You'll join as <span className="text-emerald-500 font-extrabold capitalize">{invite.role}</span>
                </p>
              </div>
            </div>

            {/* Members already counter */}
            {invite.memberCount !== undefined && invite.memberCount > 0 && (
              <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground font-bold bg-muted/10 border border-border/40 py-1.5 px-3 rounded-lg w-fit mx-auto">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{invite.memberCount} {invite.memberCount === 1 ? "member" : "members"} already joined</span>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Button 
                onClick={() => acceptInviteMutation.mutate({ token })}
                disabled={acceptInviteMutation.isPending}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/95 font-bold h-11 rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                {acceptInviteMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Join {invite.hiveName}
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <Button 
                onClick={() => router.push("/dashboard")}
                variant="ghost"
                disabled={acceptInviteMutation.isPending}
                className="w-full text-muted-foreground hover:text-foreground font-bold h-10 rounded-xl flex items-center justify-center text-xs cursor-pointer"
              >
                Decline
              </Button>
            </div>
          </div>

        </Card>
      </div>

      <footer className="p-6 text-center text-[10px] text-muted-foreground/60">
        Strizzle personal study hives • © 2026
      </footer>
    </div>
  );
}
