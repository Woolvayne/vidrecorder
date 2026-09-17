import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { exportsTable } from "@/db/schema";

export async function GET() {
  try {
    const rows = await db.select().from(exportsTable).orderBy(desc(exportsTable.createdAt)).limit(100);
    return NextResponse.json({ exports: rows });
  } catch (e) {
    return NextResponse.json({ exports: [], error: String(e) });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const [row] = await db
      .insert(exportsTable)
      .values({
        projectId: body.projectId,
        title: body.title ?? "Export",
        status: body.status ?? "rendering",
        format: body.format ?? "webm",
        resolution: body.resolution ?? "1080p",
        aspect: body.aspect ?? "16:9",
        fps: body.fps ?? 30,
        size: body.size ?? 0,
        error: body.error ?? "",
      })
      .returning({ id: exportsTable.id });
    return NextResponse.json({ id: row.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const patch: Record<string, unknown> = {};
    for (const k of ["status", "size", "error"]) if (k in body) patch[k] = body[k];
    await db.update(exportsTable).set(patch).where(eq(exportsTable.id, body.id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await db.delete(exportsTable).where(eq(exportsTable.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
