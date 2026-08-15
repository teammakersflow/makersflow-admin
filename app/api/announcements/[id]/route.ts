import { NextResponse } from "next/server";

/**
 * See app/api/announcements/route.ts for the full explanation.
 *
 * Short version: Supabase is gone and the NestJS backend has no
 * `announcements` module. `notifications` is a different table (per-user
 * alerts) and is not a substitute for broadcast announcements.
 */

const NOT_IMPLEMENTED =
  "Announcements are unavailable: the backend has no /announcements endpoint yet.";

export async function GET() {
  return NextResponse.json({ data: null, error: NOT_IMPLEMENTED }, { status: 501 });
}

export async function PUT() {
  return NextResponse.json({ data: null, error: NOT_IMPLEMENTED }, { status: 501 });
}

export async function DELETE() {
  return NextResponse.json({ success: false, error: NOT_IMPLEMENTED }, { status: 501 });
}
