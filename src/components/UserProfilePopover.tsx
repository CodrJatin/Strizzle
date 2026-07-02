"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User, ChevronRight, Palette } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { useThemeStore } from "@/store/themeStore";

interface UserProfilePopoverProps {
  fullName?: string | null;
  avatarUrl?: string | null;
}

export function UserProfilePopover({ fullName, avatarUrl }: UserProfilePopoverProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState<string | null>(null);

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
  };

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getInitials = () => {
    if (!fullName) return "U";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to log out";
      toast.error(message);
      setIsLoggingOut(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="rounded-full cursor-pointer ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Open profile menu"
        >
          <Avatar className="size-8 border border-border hover:opacity-85 transition-opacity">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? "Profile"} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold shadow-inner">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-64 p-0 border border-border bg-card shadow-xl rounded-2xl overflow-hidden"
      >
        {/* Profile Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border/60 flex items-center gap-3">
          <Avatar className="size-11 border-2 border-border/80 shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName ?? "Profile"} />}
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground truncate leading-tight">
              {fullName || "User"}
            </p>
            {email && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">
                {email}
              </p>
            )}
            <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wide bg-primary/10 text-primary uppercase">
              Student
            </span>
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-1.5 space-y-0.5">
          <div className="px-3 py-2 flex flex-col gap-1 border-b border-border/40 pb-2.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Palette className="size-3 text-primary" /> Color Theme
            </span>
            <div className="relative mt-1">
              <select
                value={theme}
                onChange={(e) => handleThemeChange(e.target.value)}
                className="w-full appearance-none bg-muted/50 hover:bg-muted border border-border rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-sm pr-8"
              >
                <option value="system">System</option>
                <option value="default">Light</option>
                <option value="dark">Dark</option>
                <option value="ocean">Ocean</option>
                <option value="forest">Forest</option>
                <option value="sunset">Sunset</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <svg className="size-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted/60 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-muted/80 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                <User className="size-3.5 text-muted-foreground" />
              </div>
              <span className="text-xs font-semibold">Edit Profile</span>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
          </Link>
        </div>

        {/* Divider + Logout */}
        <div className="p-1.5 pt-0 border-t border-border/50 mt-1">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group mt-1"
          >
            <div className="size-7 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 group-hover:bg-destructive/15 transition-colors">
              <LogOut className="size-3.5 text-destructive" />
            </div>
            <span className="text-xs font-semibold">
              {isLoggingOut ? "Signing out..." : "Log Out"}
            </span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
