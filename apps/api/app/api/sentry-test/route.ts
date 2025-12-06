import { NextRequest, NextResponse } from "next/server"
import "../../../sentry.server.config"
import captureException from "../../../lib/captureException"
// Adjust the path as needed
export async function GET(req: NextRequest) {
  // This will throw and should be captured by Sentry automatically
  captureException(new Error("Sentry test live error from /api/sentry-test"))

  return NextResponse.json({
    message: "Sentry test live error from /api/sentry-test",
  })
}

export async function POST(req: NextRequest) {
  captureException(
    new Error("Sentry test error live from /api/sentry-test POST"),
  )

  return NextResponse.json({
    message: "Sentry test error live from /api/sentry-test POST",
  })
}
