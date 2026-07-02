import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { materials, shelfItems } from '@/db/schema';
import { fetchLinkMeta } from '@/server/lib/fetchLinkMeta';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const formData = await request.formData();
    const title = formData.get('title') as string | null;
    const text = formData.get('text') as string | null;
    const url = formData.get('url') as string | null;
    const files = formData.getAll('files') as File[];

    // Extract shared link: check if URL parameter exists, or if text contains a valid URL
    let sharedUrl = url || '';
    if (!sharedUrl && text) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const match = text.match(urlRegex);
      if (match) {
        sharedUrl = match[0];
      }
    }

    if (!user) {
      // 1. Unauthenticated sharing: serialise to cookie
      const cookieStore = await cookies();
      cookieStore.set('strizzle-share-payload', JSON.stringify({
        title: title || '',
        text: text || '',
        url: sharedUrl || '',
        hasFiles: files && files.length > 0 && files[0].size > 0,
      }), {
        path: '/',
        maxAge: 600, // 10 minutes
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });

      return NextResponse.redirect(new URL('/login?returnUrl=/desk', request.url), 303);
    }

    // 2. Authenticated sharing: process and save directly
    await db.transaction(async (tx) => {
      const validFiles = files.filter(f => f && f.name && f.size > 0);
      if (validFiles.length > 0) {
        for (const file of validFiles) {
          const filePath = `${user.id}/${Date.now()}-${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from('materials')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Determine content type
          const isImage = file.type.startsWith('image/');
          const contentType = isImage ? 'image' : 'file';

          const [newMat] = await tx
            .insert(materials)
            .values({
              ownerId: user.id,
              contentType,
              title: file.name,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              storagePath: filePath,
            })
            .returning();

          if (newMat) {
            await tx.insert(shelfItems).values({
              materialId: newMat.id,
              userId: user.id,
            });
          }
        }
      } else if (sharedUrl) {
        // Shared URL
        const meta = await fetchLinkMeta(sharedUrl);
        const isYoutube = /youtube\.com|youtu\.be/i.test(sharedUrl);
        const contentType = isYoutube ? 'youtube' : 'link';

        const [newMat] = await tx
          .insert(materials)
          .values({
            ownerId: user.id,
            contentType,
            title: meta.title || title || sharedUrl,
            url: sharedUrl,
            ogTitle: meta.title,
            ogDescription: meta.description,
            ogImage: meta.image,
            ogDomain: meta.domain,
          })
          .returning();

        if (newMat) {
          await tx.insert(shelfItems).values({
            materialId: newMat.id,
            userId: user.id,
          });
        }
      } else if (text) {
        // Shared text body
        const [newMat] = await tx
          .insert(materials)
          .values({
            ownerId: user.id,
            contentType: 'text',
            title: title || text.slice(0, 50).trim() || 'Untitled Capture',
            body: text,
          })
          .returning();

        if (newMat) {
          await tx.insert(shelfItems).values({
            materialId: newMat.id,
            userId: user.id,
          });
        }
      }
    });

    return NextResponse.redirect(new URL('/desk?shareSuccess=true', request.url), 303);
  } catch (error) {
    console.error('Error in share-target API route:', error);
    return NextResponse.redirect(new URL('/desk?shareError=true', request.url), 303);
  }
}
