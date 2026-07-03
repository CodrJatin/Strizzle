export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; url: string; hiveId?: string }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("Supabase URL or service role key missing. Cannot send push notification.");
    return;
  }

  // Fire and forget asynchronously
  fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      ...payload,
    }),
  })
  .then(async (res) => {
    if (!res.ok) {
      const txt = await res.text();
      console.error(`Edge Function push error status ${res.status}:`, txt);
    }
  })
  .catch((err) => {
    console.error("Error sending push notification via Edge Function:", err);
  });
}
