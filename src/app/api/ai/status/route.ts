import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    serverKey: Boolean(process.env.MISTRAL_API_KEY),
    provider: process.env.MISTRAL_API_KEY ? "mistral" : "free",
  });
}
