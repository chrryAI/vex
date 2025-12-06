import { getMoods } from "@repo/db"
import getMember from "../../actions/getMember"
import { NextResponse } from "next/server"
import { getIp } from "../../../lib"
import getGuest from "../../actions/getGuest"

export async function GET(request: Request) {
  const member = await getMember()

  const ip = getIp(request)

  if (!ip) {
    return NextResponse.json({ error: "IP address not found" })
  }

  const guest = member ? undefined : await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Invalid credentials" })
  }

  const moods = await getMoods({
    userId: member?.id,
    guestId: guest?.id,
    pageSize: 5000,
  })

  return NextResponse.json(moods)
}
