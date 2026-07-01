"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Users, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Brand } from "@/components/Brand";
import { api } from "@/lib/trpc/client";

interface PageProps {
  params: Promise<{ token: string }>;
}

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

  // Handle redirect if unauthenticated
  React.useEffect(() => {
    if (!isLoadingInvite && invite && !isLoadingMe && !me) {
      // Check if invite is invalid first
      const isExpired = invite.expiresAt ? new Date() > new Date(invite.expiresAt) : false;
      const isMaxedOut = invite.maxUses !== null && invite.useCount >= invite.maxUses;
      const isInvalid = invite.revokedAt || isExpired || isMaxedOut;

      if (!isInvalid) {
        const returnUrl = encodeURIComponent(`/invite/${token}`);
        router.push(`/login?returnUrl=${returnUrl}`);
      }
    }
  }, [isLoadingInvite, invite, isLoadingMe, me, token, router]);

  // Handle redirect if already a member
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
          <p className="text-sm text-muted-foreground animate-pulse">Loading invitation details...</p>
        </div>
      </div>
    );
  }

  // Check validity
  const isExpired = invite?.expiresAt ? new Date() > new Date(invite.expiresAt) : false;
  const isMaxedOut = invite?.maxUses !== null && invite && invite.useCount >= invite.maxUses;
  const isInvalid = !invite || inviteError || invite.revokedAt || isExpired || isMaxedOut;

  if (isInvalid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader className="flex flex-col items-center pb-2">
            <Brand className="mb-4" size="md" />
            <div className="rounded-full bg-destructive/10 p-3 text-destructive mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">Invalid Invitation</CardTitle>
            <CardDescription className="text-center">
              This invite link is invalid, has expired, or has been revoked.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground pt-4">
            Please ask the workspace administrator to generate a new invite link.
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => router.push("/dashboard")} variant="outline" className="w-full">
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Already a member (while redirecting)
  if (invite.isAlreadyMember) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Redirecting to hive overview...</p>
        </div>
      </div>
    );
  }

  // Render invite confirmation
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-border shadow-lg bg-card text-card-foreground">
        <CardHeader className="flex flex-col items-center pb-2">
          <Brand className="mb-6" size="md" />
          <div className="rounded-full bg-primary/10 p-4 text-primary mb-4 shadow-inner">
            <Users className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Join Hive</CardTitle>
          <CardDescription className="text-center text-base pt-1">
            You've been invited to join
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center pt-2 pb-6">
          <span className="text-xl font-extrabold text-foreground text-center bg-muted/60 px-4 py-2 rounded-lg border border-border">
            {invite.hiveName}
          </span>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            You will join as a <span className="font-semibold text-foreground capitalize">{invite.role}</span>.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={() => acceptInviteMutation.mutate({ token })}
            disabled={acceptInviteMutation.isPending}
            className="w-full font-semibold h-11"
          >
            {acceptInviteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining Hive...
              </>
            ) : (
              <>
                Accept and Join
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            variant="ghost"
            disabled={acceptInviteMutation.isPending}
            className="w-full h-11 text-muted-foreground"
          >
            Decline
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
