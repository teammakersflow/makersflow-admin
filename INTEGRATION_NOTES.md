# Edodwaja / MakersFlow — Three-App Integration (Mobile + Web + Admin)

All three apps talk to the SAME Supabase project. This update makes them agree
on tables, edge functions, and money flows. Below: what was broken, what
changed in each app, and the canonical data contracts.

## Critical bugs fixed

1. **Every mobile payment showed "Verification Failed"** — the shared
   `verify-razorpay-payment` edge function returns `{ verified: true }`, but
   the mobile app checked `.success`. Money was captured, verification UI
   failed. Fixed in `services/razorpayService.ts` (normalizes both shapes).
2. **Mobile orders were invisible to the webhook** — mobile wrote order items
   as `{product_id, quantity}`; the shared `razorpay-webhook` parses
   `{id, qty, is_course, course_id}`. So `order_items`, `course_purchases`,
   invoices and stock decrements never fired for mobile orders. Mobile now
   writes the shared shape.
3. **Mobile coupons could never work** — mobile validated against a
   `promo_codes` table that doesn't exist in the shared DB. It now calls the
   same `validate-coupon` edge function the web uses, against the `coupons`
   table the admin panel manages (percent AND flat coupons, min-order,
   per-user limits, item restrictions — all enforced server-side).
4. **Coupon usage double-counting (web)** — both `verify-razorpay-payment`
   and `razorpay-webhook` recorded `coupon_usage` for the same payment. The
   webhook now skips if usage already exists.
5. **Webhook had no idempotency (web)** — Razorpay redeliveries duplicated
   `order_items`/`invoices`. Now deduped on `x-razorpay-event-id` via the
   `payment_events` table (degrades gracefully if the table is missing).
6. **Duplicate `gst_rate` key (web, pre-existing)** — a hardcoded `gst_rate: 18`
   overrode each course's real GST rate in explore data. Removed.

## The canonical contracts (how the three apps now connect)

**Coupons:** admin manages `coupons` → web + mobile validate via
`validate-coupon` → usage recorded server-side in `coupon_usage` (verify fn,
webhook as fallback). Admin's Coupons/Usage pages now reflect mobile
purchases too.

**Payments & fulfillment:** any client → `create-razorpay-order` →
Razorpay checkout → `verify-razorpay-payment` (signature check + `payments`
row + coupon usage) → client writes `orders` (shared items shape) →
`razorpay-webhook` (safety net) creates `order_items`, `course_purchases`,
**and now `enrollments` with a 1-year `expires_at`**, decrements stock,
issues `invoices`. Admin Orders/Payments/LMS Purchases/Refunds pages see
everything from both clients.

**Enrollments & expiry:** every path (mobile checkout RPC + fallback, web
checkout, web free-enroll, webhook, api-server webhook) now writes
`payment_status: completed`, `status: active`, `enrolled_at`, and
`expires_at = +1 year`. Web's `isEnrolled` gate now honors `expires_at`
(parity with the mobile lesson gate); mobile shows "Renew Access".

**Notifications:** admin "Notifications" → `announcements` (broadcast) →
web reads them (already did) → **mobile now merges announcements into its
notifications feed + home bell badge** (per-device last-seen, same approach
as web). Per-user `notifications` rows (order updates etc.) still work
alongside.

**Promotions (NEW admin page):** admin → Promotions manages the `promotions`
table that drives the mobile home banner carousel (create/enable/expire
banners with image + deep link).

**Refunds:** admin Refunds page → `create-refund` edge function (canonical).
The api-server `/api/razorpay/refund` remains as an optional
automation/scripting alternative. **Pick ONE webhook receiver** in the
Razorpay dashboard: the `razorpay-webhook` edge function (recommended — it's
the fuller one) or the api-server route; both are idempotent, but running
both would race.

## Changed files

- **Mobile**: `services/razorpayService.ts`, `app/store/checkout.tsx`,
  `app/notifications.tsx`, `app/(tabs)/index.tsx`
- **Web**: `src/routes/checkout.tsx`, `src/lib/explore-data.ts`,
  `supabase/functions/razorpay-webhook/index.ts`
- **Admin**: `app/(dashboard)/promotions/page.tsx` (new),
  `components/sidebar.tsx`
- **api-server**: `src/routes/razorpay.ts` (shared item shape +
  course_purchases mirror)
- **Migration**: `docs/migrations/2026-07_premium_features.sql` updated —
  `promo_codes` removed (coupons is canonical), `announcements` ensured with
  public-read RLS, RPC no longer touches promo counters and mirrors
  `course_purchases` best-effort.

## Deploy order

1. Run the updated migration in Supabase SQL Editor.
2. Redeploy the webhook: `supabase functions deploy razorpay-webhook`
   (from the web repo). WhatsApp functions deploy from the mobile repo.
3. Ship the three app builds in any order — every change is
   backward-compatible with data already in the DB.
