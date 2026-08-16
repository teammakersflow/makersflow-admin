import { NextResponse } from "next/server";

/**
 * ANNOUNCEMENTS ARE NOT AVAILABLE YET.
 *
 * These routes previously used a privileged service key against the old
 * database. That is gone, and the NestJS backend has no `announcements`
 * module yet.
 *
 * Note that `announcements` and `notifications` are DIFFERENT tables:
 *   announcements — broadcast messages (title, message, type, status)
 *   notifications — per-user alerts (user_id, is_read)  ← /notifications
 * so the existing /notifications endpoint is NOT a substitute.
 *
 * TO FIX: ask the backend team for an `announcements` CRUD module, then
 * replace these handlers with calls to it (or drop these Next routes and
 * have the pages call the backend directly via lib/db.ts).
 *
 * Until then these return an empty list plus an explanatory error, so the
 * admin screens render normally instead of crashing.
 */

const NOT_IMPLEMENTED =
  "Announcements are unavailable: the backend has no /announcements endpoint yet.";

export async function GET() {
  return NextResponse.json({ data: [], error: NOT_IMPLEMENTED }, { status: 501 });
}

export async function POST() {
  return NextResponse.json({ data: null, error: NOT_IMPLEMENTED }, { status: 501 });
}
