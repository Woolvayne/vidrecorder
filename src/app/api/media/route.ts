import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";

export async function GET() {
  try {
    const rows = await db.select().from(media).orderBy(desc(media.createdAt)).limit(300);
    return NextResponse.json({ media: rows });
  } catch (e) {
    return NextResponse.json({ media: [], error: String(e) });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (typeof body.url === "string" && body.url.length > 8_000_000) {
      return NextResponse.json({ error: "File too large (max ~8 MB in free local mode)" }, { status: 413 });
    }
    const [row] = await db
      .insert(media)
      .values({
        name: body.name ?? "Untitled",
        type: body.type ?? "image",
        category: body.category ?? "uploads",
        url: body.url ?? "",
        size: body.size ?? 0,
        duration: body.duration ?? 0,
        tags: body.tags ?? [],
      })
      .returning({ id: media.id });
    return NextResponse.json({ id: row.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await db.delete(media).where(eq(media.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
