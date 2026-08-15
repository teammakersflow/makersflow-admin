-- ============================================================================
-- MakersFlow — fix migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to run more than once.
-- ============================================================================


-- ─── 1. Course gallery ──────────────────────────────────────────────────────
-- The mobile app already reads `courses.images` and feeds it to the swiper
-- (app/course/[id].tsx), but the column never existed, so courses could only
-- ever show one picture. Add it, then backfill from the existing thumbnail so
-- current courses aren't left with an empty gallery.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.courses.images IS
  'Ordered gallery image URLs. courses.thumbnail_url should also appear here.';

UPDATE public.courses
SET images = ARRAY[thumbnail_url]
WHERE thumbnail_url IS NOT NULL
  AND thumbnail_url <> ''
  AND (images IS NULL OR cardinality(images) = 0);


-- ─── 2. Product gallery backfill ────────────────────────────────────────────
-- Products created before the gallery existed have a thumbnail_url but an
-- empty images[]. The admin edit screen builds its grid from images[], so those
-- thumbnails were invisible and unchangeable. Pull them into the gallery.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS videos TEXT[] DEFAULT '{}';

UPDATE public.products
SET images = ARRAY[thumbnail_url]
WHERE thumbnail_url IS NOT NULL
  AND thumbnail_url <> ''
  AND (images IS NULL OR cardinality(images) = 0);

-- Where a thumbnail exists but isn't in the gallery, prepend it.
UPDATE public.products
SET images = ARRAY[thumbnail_url] || images
WHERE thumbnail_url IS NOT NULL
  AND thumbnail_url <> ''
  AND images IS NOT NULL
  AND cardinality(images) > 0
  AND NOT (thumbnail_url = ANY(images));


-- ─── 3. push_tokens — the reason push never fired ───────────────────────────
-- The app upserts with onConflict: "token", which needs a UNIQUE index on
-- `token` by itself. The table only had UNIQUE(user_id, token), so every
-- upsert failed and no device token was ever saved.
-- The columns the app writes (device_info, updated_at) were missing too.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT DEFAULT 'android',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS device_info TEXT;
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Clear duplicate tokens before adding the unique index (keep the newest row).
DELETE FROM public.push_tokens a
USING public.push_tokens b
WHERE a.token = b.token
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_token_key
  ON public.push_tokens (token);


-- ─── 4. Enable Realtime ─────────────────────────────────────────────────────
-- Without these, the new subscription in lib/realtimeNotifications.ts connects
-- successfully but never receives a single event.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Realtime respects RLS, so readers need a SELECT policy or events are filtered
-- out silently. Announcements are public once published.
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_published_announcements" ON public.announcements;
CREATE POLICY "read_published_announcements" ON public.announcements
  FOR SELECT USING (status = 'published');


-- ─── 5. review_replies ──────────────────────────────────────────────────────
-- The admin Reviews page inserts into this table, but nothing created it.

CREATE TABLE IF NOT EXISTS public.review_replies (
  id         BIGSERIAL PRIMARY KEY,
  review_id  UUID NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS review_replies_review_id_idx
  ON public.review_replies (review_id);


-- ─── 6. Note on the original sql/run_these_in_supabase.sql ──────────────────
-- That file uses `CREATE POLICY IF NOT EXISTS`, which PostgreSQL does not
-- support — the script aborts at that line, so any statement after it never
-- ran. Use DROP POLICY IF EXISTS followed by CREATE POLICY instead, as above.


-- ─── 7. settings.key must be unique for the admin upserts to work ───────────
-- The Settings and Shipping pages upsert with onConflict: "key". Without a
-- unique index on that column Postgres rejects the conflict target and the
-- write fails — previously the UI still showed "Saved!" because the result was
-- never checked. Both platforms read shipping_fee / shipping_fee_remote /
-- free_shipping_threshold at checkout, so a silent failure mispriced orders.

DELETE FROM public.settings a
USING public.settings b
WHERE a.key = b.key AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS settings_key_key
  ON public.settings (key);

-- Seed the shipping values if they are absent.
INSERT INTO public.settings (key, value) VALUES
  ('shipping_fee',            '49'),
  ('shipping_fee_remote',     '149'),
  ('free_shipping_threshold', '999')
ON CONFLICT (key) DO NOTHING;
