export interface LinkMeta {
  title: string | null;
  description: string | null;
  image: string | null;
  domain: string;
}

const YOUTUBE_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i;

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractMetaContent(html: string, nameOrProperty: string): string | null {
  const metaTagRegex = /<meta\s+([^>]+)>/gi;
  let match;
  while ((match = metaTagRegex.exec(html)) !== null) {
    const attrs = match[1];
    const nameMatch = /\b(?:property|name)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(attrs);
    if (nameMatch) {
      const nameVal = nameMatch[1] || nameMatch[2] || nameMatch[3];
      if (nameVal.toLowerCase() === nameOrProperty.toLowerCase()) {
        const contentMatch = /\bcontent\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(attrs);
        if (contentMatch) {
          const contentVal = contentMatch[1] || contentMatch[2] || contentMatch[3];
          return decodeHtmlEntities(contentVal);
        }
      }
    }
  }
  return null;
}

function extractTitleTag(html: string): string | null {
  const titleRegex = /<title[^>]*>([\s\S]*?)<\/title>/i;
  const match = titleRegex.exec(html);
  if (match && match[1]) {
    return decodeHtmlEntities(match[1].trim());
  }
  return null;
}

/**
 * Server-side utility to extract metadata from a URL.
 * Supports YouTube oEmbed and generic page parsing of OpenGraph metadata.
 * Times out after 5 seconds and fails gracefully.
 */
export async function fetchLinkMeta(url: string): Promise<LinkMeta> {
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = "unknown";
  }

  // 1. YouTube handling
  if (YOUTUBE_REGEX.test(url)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      
      const res = await fetch(oembedUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as { title?: string; thumbnail_url?: string };
        return {
          title: data.title || null,
          description: "YouTube Video",
          image: data.thumbnail_url || null,
          domain: "youtube.com",
        };
      }
    } catch {
      // Fallback to standard scraper if oEmbed fails
    }
  }

  // 2. Generic scraper
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        title: null,
        description: null,
        image: null,
        domain,
      };
    }

    const html = await res.text();

    let title = extractMetaContent(html, "og:title") || extractMetaContent(html, "twitter:title") || extractTitleTag(html);
    let description = extractMetaContent(html, "og:description") || extractMetaContent(html, "description") || extractMetaContent(html, "twitter:description");
    let image = extractMetaContent(html, "og:image") || extractMetaContent(html, "twitter:image") || extractMetaContent(html, "image_src");

    title = title ? title.trim() : null;
    description = description ? description.trim() : null;

    if (image) {
      image = image.trim();
      try {
        image = new URL(image, url).href;
      } catch {
        // Leave image as is if URL construction fails
      }
    }

    return {
      title,
      description,
      image,
      domain,
    };
  } catch {
    return {
      title: null,
      description: null,
      image: null,
      domain,
    };
  }
}
