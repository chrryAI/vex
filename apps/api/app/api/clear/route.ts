import { isDevelopment, isE2E } from "chrry/utils"
import { NextResponse } from "next/server"
import cleanupTest from "../../../lib/cleanupTest"
import { cookies, headers } from "next/headers"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { TEST_MEMBER_FINGERPRINTS, TEST_GUEST_FINGERPRINTS } from "@repo/db"
import { v4 as uuidv4 } from "uuid"

export async function POST() {
  if (!isE2E) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const member = await getMember({})

  const guest = await getGuest()

  const fp = member?.fingerprint || guest?.fingerprint

  if (!fp) {
    return NextResponse.json({ error: "Missing fingerprint" }, { status: 401 })
  }

  if (!isDevelopment && member?.role !== "admin") {
    if (member && !TEST_MEMBER_FINGERPRINTS.includes(fp)) {
      return NextResponse.json({ error: "Not a test member" }, { status: 401 })
    }

    if (guest && !TEST_GUEST_FINGERPRINTS.includes(fp)) {
      return NextResponse.json({ error: "Not a test guest" }, { status: 401 })
    }
  }

  await cleanupTest({ fingerprint: !isDevelopment ? fp : undefined })

  return NextResponse.json({ success: true })
}
