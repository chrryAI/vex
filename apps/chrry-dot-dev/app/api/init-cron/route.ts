import { NextResponse } from "next/server"
import { initCronJobs } from "../../../lib/cronJobs"
import { isDevelopment } from "chrry/utils"

let initialized = false

/**
 * Initialize cron jobs
 * Call this once when your app starts
 *
 * GET /api/init-cron
 */
export async function GET() {
  if (!isDevelopment) {
    return NextResponse.json({
      success: true,
      message: "Cron jobs already initialized",
    })
  }

  if (initialized) {
    return NextResponse.json({
      success: true,
      message: "Cron jobs already initialized",
    })
  }

  try {
    initCronJobs()
    initialized = true

    return NextResponse.json({
      success: true,
      message: "Cron jobs initialized successfully",
    })
  } catch (error) {
    console.error("❌ Error initializing cron jobs:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
