import { NextRequest, NextResponse } from "next/server"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"
import { deletePushSubscription, getPushSubscription } from "@repo/db"

export async function POST(request: NextRequest) {
  const { endpoint } = await request.json()

  const member = await getMember()

  const guest = !member ? await getGuest() : undefined

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const subscription = await getPushSubscription({
    userId: member?.id,
    guestId: guest?.id,
    endpoint,
  })

  if (!subscription) {
    return NextResponse.json(
      { error: "Subscription not found" },
      { status: 404 },
    )
  }

  return NextResponse.json({ subscription })
}

export async function DELETE(request: NextRequest) {
  const { endpoint } = await request.json()

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint is required" })
  }

  const member = await getMember()

  const guest = !member ? await getGuest() : undefined

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const subscription = await getPushSubscription({
    userId: member?.id,
    guestId: guest?.id,
    endpoint,
  })

  if (!subscription) {
    return NextResponse.json(
      { error: "Subscription not found" },
      { status: 404 },
    )
  }

  await deletePushSubscription({
    id: subscription.id,
  })

  return NextResponse.json({ success: true })
}
