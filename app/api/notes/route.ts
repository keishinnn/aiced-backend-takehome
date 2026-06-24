import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase";
import { z } from "zod";

const CreateNoteSchema = z.object({
  group_id: z.string().uuid(),
  body: z.string().min(1, "body must not be empty"),
});

/**
 * GET /api/notes
 * Returns the notes the caller is allowed to see.
 *
 * RLS restricts results to notes belonging to the caller's groups.
 */
export async function GET(req: NextRequest) {
  const supabase = createUserClient(req);

  const { data, error } = await supabase
    .from("notes")
    .select("id, group_id, author_id, body, created_at, updated_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: data });
}

/**
 * POST /api/notes
 * Create a note. The caller must be a member of the target group.
 *
 * RLS enforces tenant isolation — the policy checks membership and requires
 * author_id to match the authenticated user.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = CreateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const supabase = createUserClient(req);

  // auth.uid() is set by the JWT — Supabase uses it as author_id automatically
  // via our RLS policy (which requires author_id = auth.uid()).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({
      group_id: parsed.data.group_id,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select()
    .single();

  if (error) {
    // RLS violation comes back as a 403-style error from Postgres
    if (error.code === "42501") {
      return NextResponse.json(
        { error: "You are not a member of this group" },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ note: data }, { status: 201 });
}
