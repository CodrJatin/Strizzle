"use client";

import * as React from "react";
import { Check, Palette, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";

import { useThemeStore } from "@/store/themeStore";
import { api } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PreferencesPage() {
  const currentTheme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const utils = api.useUtils();

  // Fetch current database preferences
  const { data: preferences, isLoading: isLoadingPrefs } = api.user.getPreferences.useQuery(
    undefined,
    {
      staleTime: 900000, // 15 mins
    }
  );

  // mutation
  const updatePreferencesMutation = api.user.updatePreferences.useMutation({
    onSuccess: () => {
      utils.user.getPreferences.invalidate();
      toast.success("Preferences updated successfully");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save settings. Please try again.");
    },
  });

  const [selectedTheme, setSelectedTheme] = React.useState("default");
  const [matchSystem, setMatchSystem] = React.useState(false);
  const [defaultCalView, setDefaultCalView] = React.useState<"week" | "day" | "month">("week");

  // Sync state once preferences load
  React.useEffect(() => {
    if (preferences) {
      if (preferences.theme === "system") {
        setMatchSystem(true);
        setSelectedTheme("default");
      } else {
        setMatchSystem(false);
        setSelectedTheme(preferences.theme);
      }
      setDefaultCalView(preferences.defaultCalView as "week" | "day" | "month");
    }
  }, [preferences]);

  const handleThemeSelect = (themeName: string) => {
    if (matchSystem) return;
    setSelectedTheme(themeName);
    setTheme(themeName);
  };

  const handleSystemToggle = (checked: boolean) => {
    setMatchSystem(checked);
    const newThemeValue = checked ? "system" : selectedTheme;
    setTheme(newThemeValue);
  };

  const handleSave = () => {
    updatePreferencesMutation.mutate({
      theme: matchSystem ? "system" : selectedTheme,
      defaultCalView,
    });
  };

  if (isLoadingPrefs) {
    return (
      <div className="min-h-[50vh] flex flex-col justify-center items-center font-sans">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-4">Loading preferences...</p>
      </div>
    );
  }

  const themesList = [
    {
      id: "system-preset", // helper id for UI check
      name: "system",
      label: "System",
      className: "border-border hover:border-muted-foreground/30",
      preview: (
        <div className="relative aspect-[4/3] rounded-lg border border-border flex overflow-hidden">
          <div className="w-1/2 bg-white" />
          <div className="w-1/2 bg-slate-900" />
          {/* Half-light-half-dark circle representation */}
          <div className="absolute inset-0 m-auto size-5 rounded-full border border-border bg-gradient-to-r from-white to-slate-900" />
        </div>
      )
    },
    {
      id: "default",
      name: "default",
      label: "Light",
      preview: (
        <div className="aspect-[4/3] rounded-lg border border-slate-200 bg-white p-2.5 flex flex-col gap-1.5 overflow-hidden">
          <div className="h-1.5 w-full bg-slate-100 rounded" />
          <div className="h-1.5 w-3/4 bg-slate-100 rounded" />
          <div className="h-1.5 w-1/2 bg-slate-100 rounded" />
        </div>
      )
    },
    {
      id: "dark",
      name: "dark",
      label: "Dark",
      preview: (
        <div className="aspect-[4/3] rounded-lg border border-slate-800 bg-slate-950 p-2.5 flex flex-col gap-1.5 overflow-hidden">
          <div className="h-1.5 w-full bg-slate-850 bg-opacity-40 bg-zinc-900 rounded" />
          <div className="h-1.5 w-3/4 bg-slate-850 bg-opacity-40 bg-zinc-900 rounded" />
          <div className="h-1.5 w-1/2 bg-slate-850 bg-opacity-40 bg-zinc-900 rounded" />
        </div>
      )
    },
    {
      id: "ocean",
      name: "ocean",
      label: "Ocean",
      preview: (
        <div className="aspect-[4/3] rounded-lg border border-blue-200/60 bg-sky-50 p-2.5 flex flex-col gap-1.5 overflow-hidden">
          <div className="h-2 w-full bg-sky-400 rounded-sm" />
          <div className="h-1.5 w-full bg-sky-200 rounded-sm" />
          <div className="h-1.5 w-3/4 bg-sky-200 rounded-sm" />
        </div>
      )
    },
    {
      id: "forest",
      name: "forest",
      label: "Forest",
      preview: (
        <div className="aspect-[4/3] rounded-lg border border-green-200/65 bg-emerald-50/60 p-2.5 flex flex-col gap-1.5 overflow-hidden">
          <div className="h-2 w-full bg-emerald-400 rounded-sm" />
          <div className="h-1.5 w-full bg-emerald-200 rounded-sm" />
          <div className="h-1.5 w-3/4 bg-emerald-200 rounded-sm" />
        </div>
      )
    },
    {
      id: "sunset",
      name: "sunset",
      label: "Sunset",
      preview: (
        <div className="aspect-[4/3] rounded-lg border border-orange-200/50 bg-[#faf6ef] p-2.5 flex flex-col gap-1.5 overflow-hidden">
          <div className="h-2 w-full bg-orange-400 rounded-sm" />
          <div className="h-1.5 w-full bg-orange-200/60 rounded-sm" />
          <div className="h-1.5 w-3/4 bg-orange-200/60 rounded-sm" />
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8 font-sans max-w-2xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Color Theme
        </h1>
      </div>

      {/* Grid containing themes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {themesList.map((t) => {
          // Determine selection state
          let isSelected = false;
          if (t.name === "system") {
            isSelected = matchSystem;
          } else {
            isSelected = !matchSystem && selectedTheme === t.name;
          }

          return (
            <div
              key={t.name}
              onClick={() => {
                if (t.name === "system") {
                  handleSystemToggle(true);
                } else {
                  handleSystemToggle(false);
                  handleThemeSelect(t.name);
                }
              }}
              className={cn(
                "group flex flex-col gap-2 cursor-pointer rounded-2xl border p-2 transition-all relative",
                isSelected
                  ? "border-primary ring-2 ring-primary/20 shadow-sm"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              {t.preview}
              
              <div className="flex items-center gap-2 mt-1 px-1 py-0.5">
                <span className={cn(
                  "size-3.5 rounded-full border border-border flex items-center justify-center",
                  t.name === "system" && "bg-gradient-to-r from-gray-400 to-gray-700",
                  t.name === "default" && "bg-slate-200",
                  t.name === "dark" && "bg-slate-900",
                  t.name === "ocean" && "bg-sky-500",
                  t.name === "forest" && "bg-emerald-500",
                  t.name === "sunset" && "bg-orange-500"
                )} />
                <span className="text-xs font-semibold text-foreground capitalize">
                  {t.label}
                </span>
              </div>

              {isSelected && (
                <div className="absolute top-3 right-3 size-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center border border-background shadow">
                  <Check className="size-2.5 stroke-[3]" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* System switch row */}
      <div className="flex items-center justify-between p-4 bg-muted/10 border border-border/80 rounded-2xl">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">
            Match system setting
          </span>
          <span className="text-xs text-muted-foreground">
            Automatically switch between light and dark themes based on your device settings.
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={matchSystem}
            onChange={(e) => handleSystemToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
        </label>
      </div>

      {/* Calendar preferences row */}
      <div className="space-y-4 pt-6 border-t border-border">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Calendar className="size-4 text-primary" /> Default Calendar View
          </span>
          <span className="text-xs text-muted-foreground">
            Configure your default schedule dashboard viewing perspective.
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {["week", "day", "month"].map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setDefaultCalView(view as any)}
              className={cn(
                "flex-1 h-10 border border-border rounded-xl px-4 text-xs font-semibold transition-all hover:bg-muted/30 cursor-pointer capitalize text-center",
                defaultCalView === view
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground bg-card"
              )}
            >
              {view} view
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-border flex justify-end gap-3">
        <Button
          onClick={handleSave}
          disabled={updatePreferencesMutation.isPending}
          className="h-10 rounded-xl px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm cursor-pointer flex items-center gap-2 font-semibold text-sm"
        >
          {updatePreferencesMutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
