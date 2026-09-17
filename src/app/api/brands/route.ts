import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema";

export async function GET() {
  try {
    const rows = await db.select().from(brands).orderBy(desc(brands.createdAt)).limit(50);
    return NextResponse.json({ brands: rows });
  } catch (e) {
    return NextResponse.json({ brands: [], error: String(e) });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const [row] = await db.insert(brands).values({ name: body.name ?? "My Channel", settings: body.settings ?? {} }).returning({ id: brands.id });
    return NextResponse.json({ id: row.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    await db.update(brands).set({ name: body.name, settings: body.settings }).where(eq(brands.id, body.id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await db.delete(brands).where(eq(brands.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
