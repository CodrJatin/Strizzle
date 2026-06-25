"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Brand } from "@/components/Brand";

const registerSchema = z.object({
  name: z.string().min(1, "Full name is required").max(100),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterSchema = z.infer<typeof registerSchema>;

function GoogleIcon() {
  return (
    <svg className="size-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function RegisterForm() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/onboarding";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const passwordValue = watch("password", "");

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 4) score++;
    if (pass.length >= 8) score++;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    return score;
  };

  const passwordStrength = getPasswordStrength(passwordValue);

  const onSubmit = async (data: RegisterSchema) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.name,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        let friendlyError = "Something went wrong. Please try again.";
        if (error.message.includes("User already registered") || error.message.toLowerCase().includes("already exists")) {
          friendlyError = "An account with this email already exists";
        } else {
          friendlyError = error.message;
        }
        setAuthError(friendlyError);
        setIsLoading(false);
      } else {
        router.push(returnUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      setAuthError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const supabase = createClient();
      const redirectToUrl = new URL("/auth/callback", window.location.origin);
      redirectToUrl.searchParams.set("returnUrl", returnUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectToUrl.toString(),
        },
      });

      if (error) {
        setAuthError(error.message);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      setAuthError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  const hasNameError = !!errors.name;
  const hasEmailError = !!errors.email;
  const hasPasswordError = !!errors.password;

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

          {/* Intro Text */}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Start organizing your academic life today.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name" className={cn(hasNameError && "text-destructive")}>
                Full name
              </Label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <User className={cn("size-4 transition-colors", hasNameError ? "text-destructive" : "text-muted-foreground")} />
                </InputGroupAddon>
                <InputGroupInput
                  id="name"
                  type="text"
                  placeholder="Alex Rivers"
                  disabled={isLoading}
                  autoComplete="name"
                  aria-invalid={hasNameError}
                  {...register("name")}
                />
              </InputGroup>
              {errors.name && (
                <p className="text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1 duration-150">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className={cn(hasEmailError && "text-destructive")}>
                Email
              </Label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Mail className={cn("size-4 transition-colors", hasEmailError ? "text-destructive" : "text-muted-foreground")} />
                </InputGroupAddon>
                <InputGroupInput
                  id="email"
                  type="email"
                  placeholder="alex.rivers@example.com"
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

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className={cn(hasPasswordError && "text-destructive")}>
                Password
              </Label>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Lock className={cn("size-4 transition-colors", hasPasswordError ? "text-destructive" : "text-muted-foreground")} />
                </InputGroupAddon>
                <InputGroupInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  disabled={isLoading}
                  autoComplete="new-password"
                  aria-invalid={hasPasswordError}
                  {...register("password")}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    disabled={isLoading}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className={cn("size-4 transition-colors", hasPasswordError ? "text-destructive" : "text-muted-foreground")} />
                    ) : (
                      <Eye className={cn("size-4 transition-colors", hasPasswordError ? "text-destructive" : "text-muted-foreground")} />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>

              {/* Password Strength Segmented Bar */}
              {passwordValue && (
                <div className="space-y-1.5 pt-1">
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((index) => (
                      <div
                        key={index}
                        className={cn(
                          "h-1 rounded-full transition-colors duration-300",
                          index <= passwordStrength
                            ? passwordStrength <= 2
                              ? "bg-amber-500" // Weak/Medium
                              : "bg-emerald-500" // Strong
                            : "bg-border" // Empty
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {passwordStrength >= 3 ? (
                      <>
                        <CheckCircle className="size-3.5 text-emerald-500 fill-emerald-500/10" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Strong password. At least 8 characters.
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="size-3.5 text-amber-500 fill-amber-500/10" />
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {passwordValue.length < 8
                            ? "Must be at least 8 characters."
                            : "Try adding numbers, uppercase letters, or symbols."}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {errors.password && (
                <p className="text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1 duration-150">
                  {errors.password.message}
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
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <span className="relative bg-background px-3 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Or continue with
            </span>
          </div>

          {/* Google Sign Up */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 shadow-sm cursor-pointer"
            disabled={isLoading}
            onClick={handleGoogleSignup}
          >
            <GoogleIcon />
            Sign up with Google
          </Button>

          {/* Bottom links */}
          <div className="text-center pt-2">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <RegisterForm />
    </React.Suspense>
  );
}
