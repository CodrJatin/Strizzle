import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/trpc/client";
import { useNotificationStore } from "@/store/notificationStore";
import { activityLog } from "@/db/schema";

export function useRealtimeHive(hiveId: string) {
  const supabase = createClient();
  const utils = api.useUtils();
  const incrementNotification = useNotificationStore((s) => s.increment);

  const { data: me } = api.user.getMe.useQuery(undefined, {
    staleTime: 900000,
    retry: false,
  });

  useEffect(() => {
    if (!me?.id) return;

    const channel = supabase
      .channel(`hive:${hiveId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_log",
          filter: `hive_id=eq.${hiveId}`,
        },
        (payload: { new: typeof activityLog.$inferSelect }) => {
          // Format payload.new to match client-side tRPC type serialization (where Date is represented as a string)
          const formattedActivity = {
            ...payload.new,
            createdAt: typeof payload.new.createdAt === "string"
              ? (payload.new.createdAt as string)
              : (payload.new.createdAt as unknown as Date).toISOString(),
            actor: {
              fullName: payload.new.actorId === me?.id ? me.fullName : "A member",
              avatarUrl: payload.new.actorId === me?.id ? me.avatarUrl : null,
            },
          };

          // Prepend to cached hive activity list
          utils.activity.getHiveActivity.setData({ hiveId }, (old) => {
            if (!old) return old;
            return {
              ...old,
              items: [formattedActivity, ...old.items],
            };
          });

          // Prepend to cached overview activity list
          utils.hive.getHiveOverview.setData({ hiveId }, (old) => {
            if (!old) return old;
            return {
              ...old,
              activity: [formattedActivity, ...old.activity],
            };
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${me.id}`,
        },
        () => {
          incrementNotification();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hiveId, me?.id, supabase, utils, incrementNotification]);
}
