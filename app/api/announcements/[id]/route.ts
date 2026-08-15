import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Next.js 15+ requires params to be awaited
type RouteContext = { params: Promise<{ id: string }> };

// GET /api/announcements/[id]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { data, error } = await adminClient()
    .from("announcements")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

// PUT /api/announcements/[id]
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await req.json();
  const { title, message, type, link_url, status } = body;

  const { data, error } = await adminClient()
    .from("announcements")
    .update({ title, message, type, link_url: link_url || null, status })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

// DELETE /api/announcements/[id]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const { error } = await adminClient()
    .from("announcements")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
