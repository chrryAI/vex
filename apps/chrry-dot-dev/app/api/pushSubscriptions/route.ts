import { NextRequest, NextResponse } from "next/server"
import {
  createPushSubscription,
  getPushSubscriptions,
  NewCustomPushSubscription,
} from "@repo/db"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"

export async function POST(request: NextRequest) {
  const member = await getMember()
  const guest = await getGuest()

  if (!member && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { endpoint, keys } = await request.json()

  if (!endpoint || !keys) {
    return NextResponse.json(
      { error: "Missing endpoint or keys" },
      { status: 400 },
    )
  }

  const subscription: NewCustomPushSubscription = {
    endpoint,
    keys,
    createdOn: new Date(),
    updatedOn: new Date(),
  }

  const createdSubscription = await createPushSubscription({
    userId: member?.id,
    guestId: guest?.id,
    subscription,
  })

  return NextResponse.json({ subscription: createdSubscription })
}
