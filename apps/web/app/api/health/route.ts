import { NextResponse } from "next/server"

// Build ID is set at build time (GIT_SHA) or runtime fallback
const buildId =
  process.env.GIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  Date.now().toString()

export async function GET() {
  return NextResponse.json({
    status: "ok",
    buildId,
    version: process.env.npm_package_version || "unknown",
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
}
