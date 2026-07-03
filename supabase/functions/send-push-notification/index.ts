import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import webpush from "npm:web-push@3.6.7";

serve(async (req) => {
  // CORS support
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // 1. Authenticate caller: require service_role key to prevent abuse
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!authHeader || !serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Parse payload
    const { userId, title, body, url, hiveId } = await req.json();

    if (!userId || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields: userId, title, body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseClient = createClient(supabaseUrl!, serviceRoleKey!);

    // 4. Mute Filter Check
    if (hiveId) {
      const { data: pref, error: prefError } = await supabaseClient
        .from("user_hive_preferences")
        .select("feed_weight")
        .eq("user_id", userId)
        .eq("hive_id", hiveId)
        .maybeSingle();

      if (prefError) {
        console.error("Error querying hive preferences:", prefError);
      }

      if (pref && pref.feed_weight === "muted") {
        console.log(`Skipping notification: User ${userId} has muted Hive ${hiveId}`);
        return new Response(JSON.stringify({ success: true, message: "Hive is muted by user" }), {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // 5. Retrieve device subscriptions
    const { data: subscriptions, error: subError } = await supabaseClient
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (subError) {
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return new Response(JSON.stringify({ success: true, message: "No active push subscriptions found" }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // 6. Set VAPID Details
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@strizzle.com";
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID key configuration missing inside environment secrets.");
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // 7. Dispatch notifications in parallel
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key,
          },
        };

        try {
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify({ title, body, url: url || "/dashboard" })
          );
          return { endpoint: sub.endpoint, status: "sent" };
        } catch (err: any) {
          console.error(`Push dispatch failed for endpoint ${sub.endpoint}:`, err);
          
          // Delete stale/expired registration if endpoint returns 410 or 404 (Gone / Not Found)
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`Cleaning up expired subscription ID: ${sub.id}`);
            await supabaseClient
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
            return { endpoint: sub.endpoint, status: "expired_deleted" };
          }

          return { endpoint: sub.endpoint, status: "failed", error: err.message };
        }
      })
    );

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("Global edge function error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
