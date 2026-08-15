-- ============================================================================
-- MakersFlow — repair enrolments left behind by the upsert bug
--
-- Both verify-razorpay-payment and razorpay-webhook upserted into
-- public.enrollments without an onConflict target. PostgREST defaulted to the
-- primary key, so the write behaved as an INSERT and collided with
-- uq_enrollments_user_course whenever a row already existed. The error was only
-- logged, so payments succeeded while payment_status was never advanced.
--
-- Deploy the fixed edge functions FIRST, then run this to repair existing rows.
-- Safe to run more than once.
-- ============================================================================


-- ─── 1. Inspect before changing anything ────────────────────────────────────
-- Enrolments that have a matching PAID order but are not marked completed.
select
  e.user_id,
  e.course_id,
  c.title,
  e.payment_status  as enrolment_status,
  o.id              as order_id,
  o.status          as order_status,
  o.total_amount,
  o.created_at
from public.enrollments e
join public.courses c on c.id = e.course_id
join public.orders  o on o.user_id = e.user_id
where (e.payment_status is distinct from 'completed')
  and o.status in ('paid', 'completed', 'delivered', 'shipped', 'packed')
  and o.items::text like '%"course_id":' || e.course_id::text || '%'
order by o.created_at desc;


-- ─── 2. Repair: mark those enrolments completed ─────────────────────────────
-- Review the output of query 1 before running this.
update public.enrollments e
set
  payment_status = 'completed',
  status         = coalesce(e.status, 'active')
from public.orders o
where o.user_id = e.user_id
  and (e.payment_status is distinct from 'completed')
  and o.status in ('paid', 'completed', 'delivered', 'shipped', 'packed')
  and o.items::text like '%"course_id":' || e.course_id::text || '%';


-- ─── 3. Free courses should never sit in a pending payment state ────────────
update public.enrollments e
set payment_status = 'free'
from public.courses c
where c.id = e.course_id
  and c.is_free = true
  and (e.payment_status is null or e.payment_status = 'pending');


-- ─── 4. Confirm the unique index the fixed upsert now targets ───────────────
-- Must return uq_enrollments_user_course on (user_id, course_id).
select indexname, indexdef
from pg_indexes
where tablename = 'enrollments';

-- If it is missing, the fixed upsert will still fail. Create it:
-- (Remove duplicate rows first, keeping the most recently enrolled.)
--
--   delete from public.enrollments a
--   using public.enrollments b
--   where a.user_id = b.user_id
--     and a.course_id = b.course_id
--     and a.id < b.id;
--
--   create unique index if not exists uq_enrollments_user_course
--     on public.enrollments (user_id, course_id);


-- ─── 5. Verify the repair ───────────────────────────────────────────────────
select payment_status, count(*)
from public.enrollments
group by payment_status
order by count(*) desc;

-- Anything still 'pending' should correspond to a genuinely unpaid order.
-- Spot-check one user (replace the email):
select e.course_id, c.title, e.payment_status, e.status, e.enrolled_at
from public.enrollments e
join public.courses c on c.id = e.course_id
where e.user_id = (select id from auth.users where email = 'team.makersflow@gmail.com')
order by e.enrolled_at desc;
