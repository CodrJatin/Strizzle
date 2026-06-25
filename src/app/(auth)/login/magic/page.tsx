"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, ArrowLeft, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Brand } from "@/components/Brand";

const magicLinkSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
});

type MagicLinkSchema = z.infer<typeof magicLinkSchema>;

function MagicLinkForm() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [isSent, setIsSent] = React.useState(false);
  const [sentEmail, setSentEmail] = React.useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MagicLinkSchema>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: MagicLinkSchema) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      // Set cookie for returnUrl so /auth/callback can read it
      document.cookie = `sb-return-url=${encodeURIComponent(returnUrl)}; path=/; max-age=600; SameSite=Lax; Secure`;

      const supabase = createClient();
      const redirectToUrl = new URL("/auth/callback", window.location.origin);
      // Also pass it in URL search params as a robust fallback
      redirectToUrl.searchParams.set("returnUrl", returnUrl);

      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          emailRedirectTo: redirectToUrl.toString(),
        },
      });

      if (error) {
        setAuthError(error.message);
        setIsLoading(false);
      } else {
        setSentEmail(data.email);
        setIsSent(true);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      setAuthError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  const hasEmailError = !!errors.email || !!authError;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 min-h-screen w-full bg-background font-sans">
      {/* Left Brand Panel */}
      <div className="hidden md:flex md:col-span-5 lg:col-span-6 bg-slate-950 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Glow overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_75%,rgba(6,182,212,0.1),transparent_60%)] pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10">
          <Brand size="lg" textClassName="text-white" />
        </div>

        {/* Centered Graphic */}
        <div className="relative flex-1 flex items-center justify-center my-8 max-w-lg mx-auto w-full">
          <div className="absolute size-72 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute size-48 bg-cyan-500/10 rounded-full blur-[60px] pointer-events-none" />
          <Image
            src="/login-graphic.png"
            alt="strizzle Network"
            width={400}
            height={400}
            priority
            className="relative max-w-full h-auto object-contain drop-shadow-[0_0_35px_rgba(99,102,241,0.25)]"
          />
        </div>

        {/* Brand Footer */}
        <div className="space-y-2 relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Your study world, all in one place
          </h2>
          <p className="text-sm text-slate-400 max-w-md">
            Organize study materials, track deadlines, and collaborate seamlessly with your study hives.
          </p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="col-span-1 md:col-span-7 lg:col-span-6 flex flex-col justify-center items-center p-6 sm:p-12 md:p-16 lg:p-20 relative">
        <div className="w-full max-w-[400px] flex flex-col justify-center space-y-6">
          {/* Mobile Brand Header */}
          <div className="flex md:hidden mb-4 self-start">
            <Brand size="md" />
          </div>

          {!isSent ? (
            <>
              {/* Back to Login Link */}
              <Link
                href="/login"
                className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group self-start"
              >
                <ArrowLeft className="mr-2 size-4 transition-transform group-hover:-translate-x-1" />
                Back to sign in
              </Link>

              {/* Intro Text */}
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Sign in with magic link
                </h1>
                <p className="text-sm text-muted-foreground">
                  Enter your email address and we&apos;ll send you a passwordless sign-in link.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className={cn(hasEmailError && "text-destructive")}>
                    Email address
                  </Label>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <Mail className={cn("size-4 transition-colors", hasEmailError ? "text-destructive" : "text-muted-foreground")} />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="email"
                      type="email"
                      placeholder="student@university.edu"
                      disabled={isLoading}
                      autoComplete="email"
                      aria-invalid={hasEmailError}
                      {...register("email")}
                    />
                  </InputGroup>
                  {errors.email && (
                    <p className="text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1 duration-150">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Auth Error Display */}
                {authError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-1 duration-150">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-10 cursor-pointer"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Sending link...
                    </>
                  ) : (
                    "Send magic link"
                  )}
                </Button>
              </form>
            </>
          ) : (
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="size-6" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Check your email
                </h1>
                <p className="text-sm text-muted-foreground animate-in fade-in duration-300">
                  We&apos;ve sent a passwordless sign-in link to <span className="font-semibold text-foreground">{sentEmail}</span>.
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Click the link in the email to sign in instantly. The link will expire in 10 minutes.
              </p>

              <div className="pt-4 flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsSent(false)}
                  className="w-full h-10 cursor-pointer"
                >
                  Resend email
                </Button>
                <Link href="/login" className="w-full">
                  <Button variant="ghost" className="w-full h-10 cursor-pointer">
                    Back to sign in
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MagicLoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <MagicLinkForm />
    </React.Suspense>
  );
}
