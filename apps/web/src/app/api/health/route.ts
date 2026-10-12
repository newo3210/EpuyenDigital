import { NextResponse } from "next/server";

// Health route - liveness for local stack and probes
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "epuyen-web",
    feature: "inspectoria-pet-registry-bot",
  });
}
