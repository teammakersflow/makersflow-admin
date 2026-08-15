# Backend TODO — what's needed for the admin panel

Hi! The frontend migration off Supabase is **finished**. Supabase is fully
removed: no `@supabase/supabase-js`, no Supabase client, no edge functions,
no `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` anywhere. It
type-checks with 0 errors and `npm run build` succeeds (all 42 routes).

Login now works: Google Sign-In → `POST /auth/google` → JWT → `/auth/me`
gates the dashboard on `role === "admin"`.

This file lists what's still needed **on the backend** for the whole admin
panel to work. Roughly in priority order.

---

## 1. 🔴 Security — CRUD routes have no auth guard

Most controllers have **no `@UseGuards(JwtAuthGuard)`** at all, so anyone
on the internet can read and write data without a token:

`courses`, `products`, `orders`, `coupons`, `categories`, `modules`,
`lessons`, `enrollments`, `payments`, `reviews`, `notifications`,
`certificates`

The admin check in the frontend is a UX convenience, **not security** —
it only hides the UI. Please add `JwtAuthGuard` + `RolesGuard` with
`@Roles('admin')` on the write routes (and read routes with private data).

`analytics` and `users` are already guarded correctly — same pattern.

---

## 2. 🔴 CORS

`src/main.ts` needs every origin that will call the API:

```ts
app.enableCors({
  origin: [
    'http://localhost:3000',                                            // local dev
    'https://makerflow-frontend-bduecd-1a49ca-187-127-138-223.sslip.io', // deployed admin
    // ...any production domain
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

Without `http://localhost:3000` in that list, local development can't reach
`api.makersflow.in` even though the deployed site works.

---

## 3. 🔴 Missing endpoints — 12 admin pages need these

The admin panel uses **25 tables**; the API currently exposes **13**. The
frontend is already wired to the routes below — each page renders fine and
shows *"The X endpoint is not available on the backend yet"* until the
module exists. Standard CRUD (`GET /`, `GET /:id`, `POST /`, `PATCH /:id`,
`DELETE /:id`) matching your existing modules is all that's needed.

| Route the frontend calls | Prisma model | Admin page(s) |
|---|---|---|
| `/settings` | `settings` | Settings, Shipping |
| `/promo-codes` | `promo_codes` | Promo Codes |
| `/news` | `news` | News (list, new, view, edit) |
| `/announcements` | `announcements` | Notifications (list, new, view, edit) |
| `/promotions` | `promotions` | Promotions |
| `/quiz-questions` | `quiz_questions` | Quizzes |
| `/lesson-notes` | `lesson_notes` | Lesson Notes |
| `/lesson-resources` | `lesson_resources` | Resources |
| `/review-replies` | `review_replies` | Reviews — reply feature |
| `/course-purchases` | `course_purchases` | LMS Purchases — revenue figures |
| `/coupon-usage` | `coupon_usage` | Coupon usage history |
| `/lesson-progress` | `lesson_progress` | Dashboard — active-users metric |

⚠️ **`settings` is keyed by `key`, not `id`** (no `id` column), and the
admin panel saves settings with an upsert. So `POST /settings` should
**upsert by `key`** (create if new, update if it exists), and
`GET/PATCH/DELETE` should take `:key` rather than `:id`.

⚠️ **`announcements` ≠ `notifications`.** Different tables:
`announcements` = broadcast (title, message, type, status);
`notifications` = per-user alerts (user_id, is_read). The existing
`/notifications` endpoint does **not** serve the Notifications admin
screens — those manage `announcements`.

Already working: `courses`, `products`, `orders`, `categories`, `coupons`,
`modules`, `lessons`, `users`, `reviews`, `enrollments`, `payments`,
`notifications`, `certificates`.

---

## 3b. 🔴 DTO gaps causing 400 errors

**Products is the urgent one.** `CreateProductDto` / `UpdateProductDto`
accept only: title, slug, description, price, original_price, category,
subcategory, thumbnail_url, images, videos, features, in_stock, stock,
status, is_course, course_id.

But these columns exist in `model products` and the admin panel edits them:

| Column | In DB | In DTO |
|---|---|---|
| `gst_rate` | ✅ `Decimal @default(18)` | ❌ |
| `weight_kg` | ✅ `Decimal? @default(0.500)` | ❌ |
| `hsn_code` | ✅ `String? @default("84733099")` | ❌ |
| `stock_quantity` | ✅ `Int @default(-1)` | ❌ (DTO has `stock`, a different column) |

Because `forbidNonWhitelisted: true`, sending any of them 400s the whole
request. To keep the panel working today, `lib/products-api.ts` strips
these before sending and logs a console warning — so **GST rate, weight and
HSN code entered by an admin are currently NOT saved.** Please add them to
the DTOs and I'll remove the stripping.

Same for courses: `gst_rate`, `hsn_code`.


`main.ts` uses `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`,
so **any field not in a DTO fails the whole request with 400**. These columns
exist in your Prisma schema but are missing from the DTOs:

| DTO | Add these fields | Otherwise broken |
|---|---|---|
| `CreateProductDto` / `UpdateProductDto` | `gst_rate`, `weight_kg`, `hsn_code`, `stock_quantity` | Create + save product |
| `CreateCourseDto` / `UpdateCourseDto` | `gst_rate`, `hsn_code` | Create + duplicate course |

I left these in the frontend payloads on purpose — dropping a GST rate
silently would put wrong tax on invoices, which is worse than a visible
error. Adding them to the DTOs is a couple of lines each.

Already fixed on my side (they would have 400'd):
- `created_at` removed from all `POST /notifications` calls
- `enrolled_at` removed from `POST /enrollments`

## 3c. 🔴 Banning users — route + field mismatch

There is no `PATCH /users/:id`. The admin panel now calls
`PATCH /users/:id/ban` with `{ isBanned: boolean }` (camelCase). Please keep
that contract stable.

Also `users.controller.ts` declares `@Patch(':id/role')` **twice** (~line 86
and ~line 103) — the second one is unreachable dead code.

## 3d. 🟠 No bulk endpoints

Bulk actions (publish courses, mark orders shipped, bulk order status) now
send **one request per row** because there is no bulk route. Works, but a
bulk endpoint would be much better for large selections.

---

## 4. 🟠 File uploads — three mismatches

1. **No public URL returned.** `POST /storage/upload-url` returns
   `{ uploadUrl, key }` only. **Preferred fix: also return `publicUrl`** —
   the frontend already prefers it and only falls back to building the URL
   from a `NEXT_PUBLIC_S3_PUBLIC_BASE_URL` env var, where a misconfigured
   value silently saves broken image URLs into the database.
2. **No delete endpoint.** Removing an image in the UI orphans the S3
   object. The frontend already calls
   **`DELETE /storage/object?key=<key>`** (key as a query param, because S3
   keys contain slashes and can't fit one path segment) and ignores a
   failure. Please add that route.
3. **Folder whitelist too narrow.** `CreateUploadUrlDto` accepts only
   `courses | products | uploads`, but the app also uploads **news images**
   and **avatars** — currently funnelled into `uploads`. Consider adding
   `news` and `avatars`.

Also: uploads return **503** unless `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY` and `AWS_S3_BUCKET` are all set in the deployed
environment.

---

## 5. 🟠 List endpoints have no query parameters

`GET /orders`, `/payments`, `/products`, `/courses`, `/coupons`,
`/enrollments`, `/reviews` etc. return the **entire table** — no filtering,
sorting, or pagination.

The frontend therefore downloads everything and filters in the browser.
Correct today, but it will get slow as data grows. Please add:

```
?status=   ?search=   ?from=   ?to=   ?page=   ?limit=   ?sort=
```

`GET /users` already does this well — same pattern would be ideal elsewhere.

---

## 6. 🟠 No joins / nested relations

Supabase embedded joins (`orders → profiles(email)`,
`enrollments → courses(title)`) have no REST equivalent, so the frontend now
fetches both tables and joins them in memory (orders, payments, refunds,
reports, LMS purchases, reviews, dashboard). That's 2–3 full table
downloads per page.

An `?include=` param or nested relations in the response would remove that.

---

## 7. 🟡 Admin bootstrap

Role comes from the JWT, sourced from the Prisma `public_users` model
(mapped to the `public.users` table). New Google sign-ins default to
`student`, and promote-to-admin is itself an admin-only endpoint — so the
first admin has to be set directly in the DB:

```sql
UPDATE users SET role = 'admin' WHERE email = 'team.makersflow@gmail.com';
```

(Already done for that account — noting it so it isn't a surprise later
for other admins.)

---

## 8. 🟡 Passwords

Sign-in is Google-only and there's no password endpoint on the API, so the
"change password" box in Settings now shows an explanatory message instead
of silently failing. If passwords aren't coming back, that UI can be
removed entirely — just say the word.

---

## Frontend env vars (FYI)

Three variables, all `NEXT_PUBLIC_*`, so Next.js **bakes them in at build
time** — the Docker image must be **rebuilt** (not just restarted) when they
change. `Dockerfile` already requires them as build args.

```
NEXT_PUBLIC_API_URL=https://api.makersflow.in
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google oauth client id>
NEXT_PUBLIC_S3_PUBLIC_BASE_URL=<public bucket/CDN base>
```

The Google **Client Secret is not used** by this flow and isn't needed —
the browser uses Google Identity Services and the backend verifies the ID
token against the Client ID.

Every origin serving the admin panel must also be listed under **Authorized
JavaScript origins** for that OAuth client in Google Cloud Console.
