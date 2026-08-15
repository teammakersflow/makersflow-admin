import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service role key — server-side only, never sent to the browser.
// Bypasses RLS so the admin panel can always read/write announcements.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/announcements — list all
export async function GET() {
  const { data, error } = await adminClient()
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

// POST /api/announcements — create
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, message, type, link_url, status } = body;

  const { data, error } = await adminClient()
    .from("announcements")
    .insert({ title, message, type, link_url: link_url || null, status })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
