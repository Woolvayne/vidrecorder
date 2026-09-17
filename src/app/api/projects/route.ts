import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: projects.id, title: projects.title, status: projects.status,
        format: projects.format, aspect: projects.aspect, mode: projects.mode,
        language: projects.language, durationTargetSec: projects.durationTargetSec,
        data: projects.data, updatedAt: projects.updatedAt, createdAt: projects.createdAt,
      })
      .from(projects)
      .orderBy(desc(projects.updatedAt))
      .limit(100);
    // strip heavy payload for list view
    return NextResponse.json({
      projects: rows.map((r) => ({
        ...r,
        scenesCount: Array.isArray(r.data?.scenes) ? r.data.scenes.length : 0,
        thumbnail: r.data?.thumbnails?.[0] ?? null,
        data: undefined,
      })),
    });
  } catch (e) {
    return NextResponse.json({ projects: [], error: String(e) }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = body.data;
    const [row] = await db
      .insert(projects)
      .values({
        title: body.title ?? "Untitled Project",
        prompt: body.prompt ?? "",
        mode: body.mode ?? "prompt",
        status: body.status ?? "draft",
        format: body.format ?? "youtube",
        language: body.language ?? "en",
        aspect: body.aspect ?? "16:9",
        durationTargetSec: body.durationTargetSec ?? 300,
        brandId: body.brandId ?? null,
        data,
      })
      .returning({ id: projects.id });
    return NextResponse.json({ id: row.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
