import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: true, mode: "free", ts: Date.now() });
  } catch {
    return NextResponse.json({ ok: true, db: false, mode: "free", ts: Date.now() });
  }
}
