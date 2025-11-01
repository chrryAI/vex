import { NextRequest, NextResponse } from "next/server"
import { getGuest, updateGuest } from "@repo/db"
import "../../../sentry.server.config"
import getGuestAction from "../../actions/getGuest"
import captureException from "../../../lib/captureException"

export async function PATCH(request: NextRequest) {
  const guest = await getGuestAction()

  const {
    favouriteAgent,
    characterProfilesEnabled,
    city,
    country,
    memoriesEnabled,
  } = await request.json()

  if (!guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await updateGuest({
      ...guest,
      favouriteAgent: [
        "deepSeek",
        "chatGPT",
        "claude",
        "gemini",
        "flux",
      ].includes(favouriteAgent)
        ? favouriteAgent
        : guest.favouriteAgent,
      characterProfilesEnabled:
        characterProfilesEnabled ?? guest.characterProfilesEnabled,
      memoriesEnabled: memoriesEnabled ?? guest.memoriesEnabled,
      city: city ?? guest.city,
      country: country ?? guest.country,
    })

    return NextResponse.json(
      await getGuest({
        id: guest.id,
      }),
    )
  } catch (error) {
    captureException(error)
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const guest = await getGuestAction()

  if (!guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(guest)
}
