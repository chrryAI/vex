import { createMood, getLastMood, updateMood } from "@repo/db"
import getGuest from "../../actions/getGuest"
import getMember from "../../actions/getMember"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { type, ...rest } = await request.json()

  const language = rest.language || "en"

  const guest = await getGuest()

  const member = await getMember()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!type) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  let mood = await getLastMood(member?.id, guest?.id)

  if (mood) {
    const updatedMood = await updateMood({
      ...mood,
      type,
      updatedOn: new Date(),
    })

    mood = updatedMood
  } else {
    mood = await createMood({
      type,
      userId: member?.id,
      guestId: guest?.id,
    })
  }

  return NextResponse.json(mood)
}

export async function GET() {
  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const mood = await getLastMood(member?.id, guest?.id)

  return NextResponse.json(mood || {})
}
