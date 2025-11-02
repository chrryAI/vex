import { NextRequest, NextResponse } from "next/server"
import { getStores, createStore } from "@repo/db"
import getMember from "../../actions/getMember"
import getGuest from "../../actions/getGuest"

export async function GET(request: NextRequest) {
  try {
    const member = await getMember()
    const guest = await getGuest()

    const stores = await getStores({
      userId: member?.id,
      guestId: guest?.id,
      page: 1,
      pageSize: 100,
    })
    return NextResponse.json(stores)
  } catch (error) {
    console.error("Error fetching stores:", error)
    return NextResponse.json(
      { error: "Failed to fetch stores" },
      { status: 500 },
    )
  }
}
