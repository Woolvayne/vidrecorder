import { NextResponse } from "next/server";

/**
 * Tiny image proxy so external free imagery (Wikipedia, Openverse, Picsum)
 * is always same-origin for canvas rendering & export — no CORS tainting.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FreeRush/1.0" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const type = res.headers.get("content-type") || "image/jpeg";
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
