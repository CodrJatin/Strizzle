import * as React from "react";
import { api } from "@/lib/trpc/client";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useNotificationPermission() {
  const [permissionState, setPermissionState] = React.useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const registerMutation = api.push.registerSubscription.useMutation();
  const unregisterMutation = api.push.unregisterSubscription.useMutation();

  const getSubscription = React.useCallback(async (): Promise<PushSubscription | null> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  }, []);

  const updateState = React.useCallback(async () => {
    if (typeof window === "undefined") return;
    
    if (!("Notification" in window)) {
      setLoading(false);
      return;
    }

    setPermissionState(Notification.permission);
    
    try {
      const sub = await getSubscription();
      setIsSubscribed(!!sub);
    } catch (err) {
      console.error("Failed to get push subscription state:", err);
    } finally {
      setLoading(false);
    }
  }, [getSubscription]);

  React.useEffect(() => {
    updateState();
  }, [updateState]);

  const subscribeUser = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Notifications are not supported in this browser.");
      return;
    }

    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== "granted") {
        toast.error("Notification permission denied.");
        setLoading(false);
        return;
      }

      if (!VAPID_PUBLIC_KEY) {
        toast.error("VAPID public key is missing in configuration.");
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const p256dh = sub.getKey("p256dh");
      const auth = sub.getKey("auth");

      const p256dhKey = p256dh
        ? btoa(String.fromCharCode(...new Uint8Array(p256dh)))
        : "";
      const authKey = auth
        ? btoa(String.fromCharCode(...new Uint8Array(auth)))
        : "";

      await registerMutation.mutateAsync({
        endpoint: sub.endpoint,
        p256dhKey,
        authKey,
        deviceLabel: navigator.userAgent.slice(0, 100),
      });

      setIsSubscribed(true);
      toast.success("Successfully subscribed to push notifications!");
    } catch (err: any) {
      console.error("Failed to subscribe user:", err);
      toast.error(err.message || "Failed to enable push notifications.");
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeUser = async () => {
    if (typeof window === "undefined") return;

    setLoading(true);
    try {
      const sub = await getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await unregisterMutation.mutateAsync({
          endpoint: sub.endpoint,
        });
      }
      setIsSubscribed(false);
      toast.success("Successfully unsubscribed from push notifications.");
    } catch (err: any) {
      console.error("Failed to unsubscribe user:", err);
      toast.error(err.message || "Failed to disable push notifications.");
    } finally {
      setLoading(false);
    }
  };

  return {
    permissionState,
    isSubscribed,
    loading,
    subscribeUser,
    unsubscribeUser,
  };
}
