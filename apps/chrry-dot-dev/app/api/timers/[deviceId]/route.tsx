import { createTimer, getTimer, updateTimer } from "@repo/db"
import { NextResponse } from "next/server"
import getMember from "../../../actions/getMember"
import "../../../../sentry.server.config"
import { notify } from "../../../../lib/notify"
import getGuest from "../../../actions/getGuest"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const pathParts = url.pathname.split("/")
  let deviceId = pathParts[pathParts.length - 1]

  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Member not found" })
  }

  if (!deviceId) {
    return NextResponse.json({ error: "Invalid deviceId" })
  }

  const timer =
    (await getTimer({
      fingerprint: deviceId,
      userId: member?.id,
      guestId: guest?.id,
    })) ||
    (await createTimer({
      fingerprint: deviceId,
      userId: member?.id,
      guestId: guest?.id,
    }))

  return NextResponse.json(timer)
}

export const PATCH = async (request: Request) => {
  const url = new URL(request.url)
  const pathParts = url.pathname.split("/")
  const id = pathParts[pathParts.length - 1]
  if (!id) {
    return NextResponse.json({ error: "Invalid id" })
  }
  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Member not found" })
  }

  const { count, preset1, preset2, preset3, isCountingDown, fingerprint } =
    await request.json()

  const timer = await getTimer({ userId: member?.id, guestId: guest?.id })

  if (!timer) {
    return NextResponse.json({ error: "Timer not found" })
  }

  const updatedTimer = await updateTimer({
    ...timer,
    count: count ?? timer.count,
    preset1: preset1 ?? timer.preset1,
    preset2: preset2 ?? timer.preset2,
    preset3: preset3 ?? timer.preset3,
    isCountingDown: isCountingDown ?? timer.isCountingDown,
    fingerprint: fingerprint ?? timer.fingerprint,
  })

  notify(member?.id || guest?.id!, {
    type: "timer",
    data: updatedTimer,
  })

  return NextResponse.json(updatedTimer)
}
