import { supabase } from './supabase';

export async function uploadToS3(
  file: File,
  folder: 'courses' | 'products' | 'news' | 'avatars'
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not signed in — please refresh the page and log in again.');
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-upload-url`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        folder,
      }),
    }
  );

  // ── FIX ────────────────────────────────────────────────────────────────────
  // The response was never checked. When the edge function failed, `publicUrl`
  // came back undefined and the literal string "undefined" was written into the
  // products/courses row — which then rendered as a broken image in the app.
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Could not get an upload URL (${res.status}). ${detail.slice(0, 200)}`
    );
  }

  const payload = await res.json().catch(() => null);
  const presignedUrl = payload?.presignedUrl;
  const publicUrl = payload?.publicUrl;

  if (!presignedUrl || !publicUrl) {
    throw new Error('Upload service returned an invalid response (missing URL).');
  }

  const putRes = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error(`Upload to storage failed (${putRes.status}).`);
  }

  return publicUrl;
}

export function extractS3Key(publicUrl: string, folder: string): string | null {
  const marker = `/${folder}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + 1);
}

export async function deleteFromS3(key: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-s3-file`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ key }),
      }
    );
  } catch (err) {
    // Best-effort cleanup — a leftover S3 object must never block the UI.
    console.warn('deleteFromS3 failed (non-fatal):', err);
  }
}
