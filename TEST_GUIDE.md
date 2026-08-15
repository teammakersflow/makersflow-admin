# MakersFlow — Complete Test Guide (v2 Final)

## PART 0 — SETUP (do in this exact order)

1. **SQL — run BOTH files in Supabase SQL Editor** (Dashboard → SQL Editor → New query → paste → Run). Idempotent, safe to re-run:
   - `2026-07_premium_features.sql` (if not already run)
   - `PATCH_coupons_used_count.sql` (if not already run)
   - `2026-07_admin_content.sql` ← **NEW, required for this release**
2. **Make yourself admin** (needed for the admin panel's new role guard):
   ```sql
   update profiles set role = 'admin' where email = 'YOUR-ADMIN-EMAIL';
   ```
3. Extract the three FINAL-v2 zips to fresh folders. Copy your `.env` into `artifacts\mobile\` and `.env.local` into the admin folder.
4. Install & typecheck each:
   - Mobile: `pnpm install` (repo root) → `cd artifacts\mobile` → `npx tsc --noEmit` → `pnpm start`
   - Admin: `npm install` → `npx tsc --noEmit` → `npm run dev`
   - Web: `npm install` → `npx tsc -b --noEmit` → `npm run dev`
5. Webhook: no changes this round — keep the existing Razorpay webhook registration.

---

## PART 1 — REVIEWS MODERATION (new)

**Flow: student writes review → admin approves/rejects → visible everywhere.**

1. **Submit (mobile):** open an enrolled course → scroll to reviews → pick stars, write a comment → Submit. You should see the alert "…pending approval…".
2. **Verify it's hidden from others:** log into the web app with a *different* account → open that course → the new review must NOT appear. (You, the author, still see your own — that's intended.)
3. **Moderate (admin):** Admin → **Reviews** → Pending tab shows the review with stars, comment, course, and author → click **Approve**.
4. **Verify visible:** the other account on web now sees it; mobile course page shows it in the list and the average rating updates.
5. **Reject path:** submit another review from a second account → admin → **Reject** → it never appears publicly, but the author still sees their own.
6. **Re-moderation on edit:** as the author, edit your approved review (change stars, resubmit) → it disappears from public view and returns to admin's Pending tab. This is enforced by a DB trigger — users cannot self-approve even by crafting API calls.
7. **Counts:** the Pending/Approved/Rejected tab badges should match `select status, count(*) from reviews group by status;`.

---

## PART 2 — QUIZZES (new)

**Flow: admin adds questions per lesson → students take the quiz in the app.**

1. **Create (admin):** Admin → **Quizzes** → pick Course → Module → Lesson → type a question, fill 2–4 options, tick the radio next to the correct one → Add Question. Add 3–4 questions. Reorder with the up/down arrows.
2. **Take (mobile):** open that course → play that lesson → below the video, switch to the **Quiz** tab → Start Quiz → your questions appear in order, timer = 1 min/question → answer → results screen shows the score.
3. **Empty state:** a lesson with no questions shows "There are no quiz questions added for this lesson yet."
4. **Web:** the web quiz reads the answer-free `quiz_questions_public` view — take the same quiz on web and confirm the questions match (correct answers are never sent to the web client).
5. **Security check (optional):** in the browser dev-tools network tab on web, confirm quiz responses contain no `correct_option_index` field.

---

## PART 3 — RESOURCES (new)

**Flow: admin attaches files/links to a lesson → students open them from the Resources tab.**

1. **Add (admin):** Admin → **Resources** → Course → Module → Lesson → title "Pinout cheat-sheet", URL of any public PDF, type PDF → Add.
2. **Open (mobile):** in that lesson's **Resources** tab (next to Quiz) the item appears with a PDF icon → tapping opens it in the browser/viewer.
3. **Web:** the web lesson page reads the same `lesson_resources` table — the resource shows there too.
4. **Empty state:** lessons without resources show "No resources yet".
5. **Delete in admin → gone from both clients after reload.**

---

## PART 4 — WEB CERTIFICATE (fixed dead button)

1. Complete a course on web (or force it: set every lesson's progress to done, or temporarily test with a course at 100%).
2. Web → **My Learning** → Completed tab → each completed card has the green certificate icon button — **it previously did nothing; now it works**.
3. Click it → a PNG certificate downloads with your profile name, the course title (wraps for long titles), and today's date.
4. Check the name on it matches `profiles.full_name` (falls back to email prefix).

---

## PART 5 — MOBILE GST + SHIPPING (new)

1. Add a **physical** product to the cart on mobile → Checkout.
2. The summary now shows: Subtotal → Coupon (if applied) → **GST** (per-item rate from `products.gst_rate`, default 18%) → **Shipping** (₹49, or ₹149 for remote states like Assam/Ladakh, FREE above ₹999 — same `settings` keys the web uses) → Total. **Compare against web:** put the same items in the web cart — the totals must match to the rupee.
3. Coupons interact correctly: GST is computed on the *discounted* amount (apply a coupon and watch GST drop proportionally).
4. Pay (test card 4111 1111 1111 1111) → in SQL: `select total_amount, tax_amount, shipping_address from orders order by created_at desc limit 1;` → tax_amount populated, address stored.
5. **Orders screen (fixed bug + new details):** Profile → Orders → the paid order **now appears** (previously orders with status 'paid' were silently filtered out!) with a green Paid badge, "Includes GST: ₹x", and the full ship-to address block.
6. The generated invoice PDF also now shows GST and Shipping lines.
7. Digital-only cart: no Shipping row, no address required — as before.

---

## PART 6 — ADMIN SECURITY GUARD (new)

1. Log into the admin panel with a **non-admin** account (any student).
2. You should briefly see a spinner, then "This account does not have admin access." and be returned to login. Direct URLs like `/coupons` are blocked the same way.
3. Log in with the admin account (Part 0 step 2) → full access.
4. Note: the UI guard is convenience; the hard enforcement is DB-level — the new `is_admin()` RLS policies mean even a crafted API call from a student token cannot approve reviews, write quizzes/resources, or read other users' pending reviews.

---

## PART 7 — SECURITY ITEMS RESOLVED / TO KNOW

- **Removed from the mobile repo:** `brute-auth.js` (a credential brute-force test script sitting in the app folder), `test-query.js`, `validate.bat`. None belong in a shippable APK codebase.
- **No service-role keys** exist anywhere in client code (scanned all three repos, including base64-encoded forms). Service role is used only in the admin's server-side API routes — correct.
- The anon key in clients is public by design; safety rests on RLS, which the three migrations now define **in code** for every new table.
- **Known limitation (accepted):** the mobile quiz reads `correct_option_index` for client-side grading, so a determined user could extract answers from the app's API traffic. Web is protected via the public view. Moving mobile to server-side grading is a future improvement, not a launch blocker.
- **Do this manually (cannot be done from code):** in Supabase Dashboard verify RLS is ENABLED on `orders`, `enrollments`, `lesson_progress`, `payments` and that students can only select their own rows — the checklist is at the bottom of `2026-07_premium_features.sql`.

---

## PART 8 — REGRESSION PASS (10 min, before building the APK)

Re-verify nothing regressed: mobile login/logout, Google login, coupon apply (`TEST20` style), a full test payment start-to-finish, video playback + progress save, course expiry "Renew Access" (set `expires_at` in the past), notifications bell (send from admin), promotions banner (create in admin), single-device kick (two devices), web purchase visible on mobile and vice-versa, admin Orders/Payments/Refunds pages loading.

## PART 9 — BUILDING THE APK

```bash
cd artifacts/mobile
npm i -g eas-cli && eas login
eas build --platform android --profile preview   # installable APK
```
Before building: ensure `assets/images/notification-icon.png` exists (or remove the icon line from the expo-notifications plugin in app.json), and remember push notifications + save-certificate-to-gallery only work in this real build, not Expo Go.
