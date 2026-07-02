"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Search, Bell, Settings, Menu, Plus, Calendar,
  Home, Layers, FileText, Users, Archive, BookOpen, 
  FolderOpen, Star, Folder, Rss, CheckSquare, 
  GitPullRequest, Palette, Shield, User, Loader2, AlertCircle
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { api } from "@/lib/trpc/client";
import { useQuickAddStore } from "@/store/quickAddStore";
import { QuickAddModal } from "@/components/QuickAddModal";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserProfilePopover } from "@/components/UserProfilePopover";

// Define navigation item interface
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<any>;
}

// Define context configuration interface
interface SidebarContextConfig {
  title: string;
  subtitle: string;
  icon: React.ComponentType<any>;
  links: NavItem[];
  actionLabel: string;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  // Fetch authenticated user profile
  const { data: me, isLoading: isLoadingMe } = api.user.getMe.useQuery(undefined, {
    staleTime: 900000, // 15 mins
    retry: false,
  });


  // Determine path context
  const getContext = (): { type: "workspace" | "library" | "desk" | "hive" | "calendar" | "settings" | "community"; id?: string } => {
    if (pathname.startsWith("/hive/")) {
      const parts = pathname.split("/");
      // Path shape: /hive/[hiveId]/...
      return { type: "hive", id: parts[2] };
    }
    if (pathname.startsWith("/library")) {
      return { type: "library" };
    }
    if (pathname.startsWith("/desk")) {
      return { type: "desk" };
    }
    if (pathname.startsWith("/settings")) {
      return { type: "settings" };
    }
    if (pathname.startsWith("/feed") || pathname.startsWith("/hives")) {
      return { type: "community" };
    }
    return { type: "workspace" };
  };

  const context = getContext();

  // Fetch hive details if in a hive context
  const { data: currentHive } = api.hive.getHive.useQuery(
    { hiveId: context.type === "hive" && context.id ? context.id : "" },
    { enabled: context.type === "hive" && !!context.id, staleTime: 300000 }
  );

  // Define sidebar context configurations
  const contextConfigs: Record<string, SidebarContextConfig> = {
    workspace: {
      title: "Workspace",
      subtitle: "Spring 2026",
      icon: Layers,
      links: [
        { label: "Home", href: "/dashboard", icon: Home },
        { label: "Calendar", href: "/calendar", icon: Calendar },
        { label: "Deadlines", href: "/calendar/deadlines", icon: CheckSquare },
        { label: "My Workspace", href: "/desk", icon: Layers },
        { label: "Course Notes", href: "/notes", icon: FileText },
        { label: "Archive", href: "/archive", icon: Archive },
      ],
      actionLabel: "New Entry",
    },
    desk: {
      title: "Desk",
      subtitle: "Temporary captures",
      icon: Layers,
      links: [
        { label: "Desk Shelf", href: "/desk", icon: Layers },
        { label: "Captured Links", href: "/desk/links", icon: Rss },
        { label: "Files & Notes", href: "/desk/files", icon: FileText },
        { label: "Bin", href: "/desk/bin", icon: Archive },
      ],
      actionLabel: "Quick Capture",
    },
    library: {
      title: "Library",
      subtitle: "Study Studio",
      icon: BookOpen,
      links: [
        { label: "My Materials", href: "/library", icon: FolderOpen },
        { label: "Starred Materials", href: "/library?starred=true", icon: Star },
        { label: "Folders", href: "/library/folders", icon: Folder },
      ],
      actionLabel: "Add Material",
    },
    hive: {
      title: "Biology 101", // Default placeholder for hive name
      subtitle: "Hive Workspace",
      icon: Users,
      links: [
        { label: "Overview", href: `/hive/${context.id || "placeholder"}/overview`, icon: Home },
        { label: "Syllabus", href: `/hive/${context.id || "placeholder"}/syllabus`, icon: GitPullRequest },
        { label: "Material", href: `/hive/${context.id || "placeholder"}/materials`, icon: FolderOpen },
        { label: "Tasks", href: `/hive/${context.id || "placeholder"}/tasks`, icon: CheckSquare },
        { label: "Settings", href: `/hive/${context.id || "placeholder"}/settings`, icon: Settings },
      ],
      actionLabel: "Share Material",
    },
    calendar: {
      title: "Calendar",
      subtitle: "Schedule Studio",
      icon: CalendarIconReplacement(), // Custom Calendar icon helper below
      links: [
        { label: "Month View", href: "/calendar", icon: Home },
        { label: "Week View", href: "/calendar/week", icon: Layers },
        { label: "Day View", href: "/calendar/day", icon: FileText },
        { label: "Deadlines", href: "/calendar/deadlines", icon: CheckSquare },
      ],
      actionLabel: "New Event",
    },
    settings: {
      title: "Settings",
      subtitle: "Preferences",
      icon: Settings,
      links: [
        { label: "Profile", href: "/settings", icon: User },
        { label: "Preferences", href: "/settings/preferences", icon: Palette },
        { label: "Notifications", href: "/settings/notifications", icon: Bell },
        { label: "Offline Storage", href: "/settings/offline", icon: Archive },
        { label: "Danger Zone", href: "/settings/danger", icon: AlertCircle },
      ],
      actionLabel: "Save Config",
    },
    community: {
      title: "Community",
      subtitle: "Study Hub",
      icon: Rss,
      links: [
        { label: "Shared Feed", href: "/feed", icon: Rss },
        { label: "Hives", href: "/hives", icon: Layers },
      ],
      actionLabel: "New Post",
    },
  };

  // If in hive context, dynamically set the title and filter links
  if (context.type === "hive" && currentHive) {
    contextConfigs.hive.title = currentHive.name;
    const isAdminOrOwner = currentHive.role === "admin" || currentHive.role === "owner";
    if (!isAdminOrOwner) {
      contextConfigs.hive.links = contextConfigs.hive.links.filter(
        (link) => !link.href.endsWith("/settings")
      );
    }
  }

  function CalendarIconReplacement() {
    return function CalendarIcon(props: any) {
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...props}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    };
  }

  const activeConfig = contextConfigs[context.type] || contextConfigs.workspace;

  // Handle Dynamic Action Button Click
  const openQuickAdd = useQuickAddStore((s) => s.open);

  const handleActionClick = () => {
    openQuickAdd();
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Toggle Quick Add on Ctrl+Shift+A
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        openQuickAdd();
        return;
      }

      // 2. Toggle Search on '/' key press
      if (e.key === '/') {
        // Ignore if user is inside an input, textarea, or contenteditable element
        const activeEl = document.activeElement;
        if (
          activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.hasAttribute('contenteditable'))
        ) {
          return;
        }

        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openQuickAdd]);


  // Check top link active states
  const isTopLinkActive = (pathPrefix: string) => {
    if (pathPrefix === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/" || pathname.startsWith("/calendar");
    }
    return pathname.startsWith(pathPrefix);
  };

  // Sidebar component template for reuse in Sheet & Desktop
  const renderSidebarContents = () => (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      {/* Title Tile */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-2xl border border-border/50">
          <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary border border-primary/10 shadow-sm">
            <activeConfig.icon className="size-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold tracking-tight text-foreground truncate">
              {activeConfig.title}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {activeConfig.subtitle}
            </span>
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {activeConfig.links.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/dashboard" &&
              link.href !== "/" &&
              link.href !== "/settings" &&
              pathname.startsWith(link.href));
          return (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <link.icon className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Action Button (Desktop Only Layout Slot - inside desktop sidebar) */}
      <div className="hidden lg:block p-4 border-t border-border">
        <Button
          onClick={handleActionClick}
          className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <Plus className="size-4" />
          {activeConfig.actionLabel}
        </Button>
      </div>

      {/* Bottom Secondary Links & Logout removed per request */}
    </div>
  );

  return (
    <div className="h-screen bg-background flex flex-col font-sans overflow-hidden">
      
      {/* Top Navbar: taking full width */}
      <header className="sticky top-0 z-40 w-full h-14 border-b border-border bg-card text-card-foreground flex items-center justify-between px-4 md:px-6 shadow-sm">
        
        {/* Left Branding */}
        <div className="flex items-center gap-4">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden cursor-pointer size-9">
                <Menu className="size-5 text-foreground" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r border-border">
              {renderSidebarContents()}
            </SheetContent>
          </Sheet>
          <Link href="/dashboard" className="flex items-center">
            <Brand size="sm" />
          </Link>
        </div>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 h-full">
          <Link
            href="/dashboard"
            className={cn(
              "relative px-4 h-full flex items-center text-sm font-medium transition-colors hover:text-foreground",
              isTopLinkActive("/dashboard")
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            )}
          >
            Dashboard
          </Link>
          <Link
            href="/desk"
            className={cn(
              "relative px-4 h-full flex items-center text-sm font-medium transition-colors hover:text-foreground",
              isTopLinkActive("/desk") || isTopLinkActive("/notes") || isTopLinkActive("/groups") || isTopLinkActive("/archive")
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            )}
          >
            Workspace
          </Link>
          <Link
            href="/library"
            className={cn(
              "relative px-4 h-full flex items-center text-sm font-medium transition-colors hover:text-foreground",
              isTopLinkActive("/library")
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            )}
          >
            Library
          </Link>
          <Link
            href="/feed"
            className={cn(
              "relative px-4 h-full flex items-center text-sm font-medium transition-colors hover:text-foreground",
              isTopLinkActive("/feed") || isTopLinkActive("/hive") || isTopLinkActive("/hives")
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            )}
          >
            Community
          </Link>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2 lg:gap-3">
          
          {/* Search bar */}
          <div 
            onClick={() => setSearchOpen(true)}
            className="hidden sm:block w-48 lg:w-64 cursor-pointer"
          >
            <InputGroup className="h-8.5 rounded-lg border-input bg-muted/30 pointer-events-none">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                placeholder="Search (press /)..."
                readOnly
                className="text-xs text-foreground placeholder:text-muted-foreground cursor-pointer"
              />
            </InputGroup>
          </div>



          {/* Notification bell */}
          <Button variant="ghost" size="icon" className="size-8.5 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground">
            <Bell className="size-4.5" />
            <span className="sr-only">Notifications</span>
          </Button>

          {/* Settings icon */}
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="size-8.5 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground">
              <Settings className="size-4.5" />
              <span className="sr-only">Settings</span>
            </Button>
          </Link>

          {/* Profile Avatar — opens profile popover */}
          {isLoadingMe ? (
            <div className="size-8 rounded-full bg-muted animate-pulse border border-border" />
          ) : (
            <UserProfilePopover
              fullName={me?.fullName}
              avatarUrl={me?.avatarUrl}
            />
          )}

        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: visible only on desktop */}
        <aside className="hidden lg:block w-64 border-r border-border shrink-0">
          {renderSidebarContents()}
        </aside>

        {/* Content Pane */}
        <main className="flex-1 overflow-y-auto relative p-6 md:p-8 bg-background/50">
          {children}

          {/* Mobile-only Floating Action Button (FAB) */}
          <button
            onClick={handleActionClick}
            className="lg:hidden fixed bottom-6 right-6 size-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all active:scale-95 cursor-pointer z-50 border border-primary/20"
          >
            <Plus className="size-5" />
            <span className="sr-only">Action</span>
          </button>
          
          <QuickAddModal />
          <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </main>

      </div>
    </div>
  );
}
