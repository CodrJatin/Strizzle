/**
 * Utility functions for YouTube Video and Playlist handling.
 */

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

/**
 * Parses a YouTube playlist range string (e.g. "1-19 22 27 30-36")
 * and returns a set of 1-based video indices to count/display.
 * If rangeStr is empty, returns all indices up to maxCount.
 */
export function parseVideoRange(rangeStr: string, maxCount: number): Set<number> {
  const indices = new Set<number>();
  const normalized = rangeStr.trim();
  
  if (!normalized) {
    // Empty range means count all videos
    for (let i = 1; i <= maxCount; i++) {
      indices.add(i);
    }
    return indices;
  }

  const tokens = normalized.split(/[\s,]+/);
  for (const token of tokens) {
    if (!token) continue;
    if (token.includes('-')) {
      const parts = token.split('-');
      if (parts.length === 2) {
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        if (!isNaN(start) && !isNaN(end)) {
          const low = Math.min(start, end);
          const high = Math.max(start, end);
          for (let i = low; i <= high; i++) {
            if (i >= 1 && i <= maxCount) {
              indices.add(i);
            }
          }
        }
      }
    } else {
      const val = parseInt(token, 10);
      if (!isNaN(val)) {
        if (val >= 1 && val <= maxCount) {
          indices.add(val);
        }
      }
    }
  }

  // If a range is typed but yields no valid positions, default to all
  if (indices.size === 0) {
    for (let i = 1; i <= maxCount; i++) {
      indices.add(i);
    }
  }

  return indices;
}

/**
 * Parses an ISO 8601 duration string (e.g. "PT1H23M45S") to seconds.
 */
export function parseISO8601Duration(durationStr: string): number {
  const regex = /P(?:([\d.]+)D)?T?(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?/;
  const matches = durationStr.match(regex);
  if (!matches) return 0;
  const days = parseFloat(matches[1] || '0');
  const hours = parseFloat(matches[2] || '0');
  const minutes = parseFloat(matches[3] || '0');
  const seconds = parseFloat(matches[4] || '0');
  return Math.floor(days * 86400 + hours * 3600 + minutes * 60 + seconds);
}

/**
 * Attempts to extract a single video's duration by scraping its HTML page.
 * Returns duration in seconds, or null if it fails.
 */
export async function fetchYoutubeVideoDurationWithoutKey(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Look for itemprop="duration"
    const itempropMatch = /<meta\s+itemprop="duration"\s+content="([^"]+)"/i.exec(html);
    if (itempropMatch && itempropMatch[1]) {
      return parseISO8601Duration(itempropMatch[1]);
    }

    // Look for schema.org JSON-LD duration
    const jsonLdMatch = /"duration"\s*:\s*"([^"]+)"/i.exec(html);
    if (jsonLdMatch && jsonLdMatch[1]) {
      return parseISO8601Duration(jsonLdMatch[1]);
    }
  } catch (e) {
    console.error("Error scraping YouTube duration:", e);
  }
  return null;
}

/**
 * Fetches a single video's duration via the official YouTube Data API.
 */
export async function fetchYoutubeVideoDurationWithKey(videoId: string, apiKey: string): Promise<number | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${apiKey}`);
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const durationStr = data.items?.[0]?.contentDetails?.duration;
    if (durationStr) {
      return parseISO8601Duration(durationStr);
    }
  } catch (e) {
    console.error("Error fetching YouTube duration with key:", e);
  }
  return null;
}

/**
 * Fetches all videos of a playlist along with their titles and durations.
 */
export async function fetchPlaylistVideos(
  playlistId: string,
  apiKey: string
): Promise<{ videoId: string; title: string; duration: number }[]> {
  const items: { videoId: string; title: string }[] = [];
  let nextPageToken = "";

  // 1. Paginate and gather all video IDs + titles
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch playlist items: ${res.statusText}. Details: ${errorText}`);
    }
    const data = (await res.json()) as any;
    
    const playlistItems = data.items || [];
    for (const item of playlistItems) {
      const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title || "Untitled Video";
      if (videoId) {
        items.push({ videoId, title });
      }
    }
    nextPageToken = data.nextPageToken || "";
  } while (nextPageToken);

  if (items.length === 0) return [];

  // 2. Fetch video durations in batches of 50
  const videoIds = items.map((i) => i.videoId);
  const durationMap = new Map<string, number>();

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch.join(",")}&key=${apiKey}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as any;
      const videoItems = data.items || [];
      for (const item of videoItems) {
        const vId = item.id;
        const durationStr = item.contentDetails?.duration;
        if (vId && durationStr) {
          durationMap.set(vId, parseISO8601Duration(durationStr));
        }
      }
    }
  }

  // 3. Assemble and return results
  return items.map((item) => ({
    videoId: item.videoId,
    title: item.title,
    duration: durationMap.get(item.videoId) || 0,
  }));
}

/**
 * Formats seconds into a human-readable duration (e.g. "12:34" or "1h 23m").
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds === 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}
