import { isE2E } from "chrry/utils"
import { NextResponse } from "next/server"
import cleanupTest from "../../../lib/cleanupTest"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { TEST_GUEST_FINGERPRINTS, TEST_MEMBER_EMAILS } from "@repo/db"

export async function POST() {
  if (!isE2E) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const member = await getMember()

  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (member && TEST_MEMBER_EMAILS.includes(member?.email)) {
    await cleanupTest()

    return NextResponse.json({ success: true })
  }

  if (guest && TEST_GUEST_FINGERPRINTS.includes(guest?.fingerprint)) {
    await cleanupTest()

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
