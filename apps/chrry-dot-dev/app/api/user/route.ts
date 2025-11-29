import { NextRequest, NextResponse } from "next/server"
import getMember from "../../actions/getMember"
import {
  deleteUser,
  getStore,
  getSubscription,
  getUser,
  updateUser,
} from "@repo/db"
import "../../../sentry.server.config"
import captureException from "../../../lib/captureException"
import { isValidUsername } from "chrry/utils"
import { protectedRoutes } from "chrry/utils/url"
import Stripe from "stripe"
import { deleteFile } from "../../../lib/minio"

export async function GET() {
  const member = await getMember({ skipCache: true })

  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(member)
}

export async function PATCH(request: NextRequest) {
  const member = await getMember({ full: true, skipCache: true })

  const {
    language,
    name,
    image,
    userName,
    favouriteAgent,
    characterProfilesEnabled,
    memoriesEnabled,
    city,
    country,
  } = await request.json()

  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (protectedRoutes.includes(userName)) {
    return NextResponse.json(
      { error: "Username is protected" },
      { status: 400 },
    )
  }

  if (!isValidUsername(userName)) {
    return NextResponse.json(
      { error: "Username must be 3-20 alphanumeric characters" },
      { status: 400 },
    )
  }

  const exists = async (username: string) => {
    // Check if username taken by another user
    const existingUser = await getUser({ userName: username })
    if (existingUser && existingUser.id !== member.id) {
      return true // Username taken by someone else
    }

    // Check if slug taken by another user's store
    const existingStore = await getStore({ slug: username })
    if (existingStore?.store) {
      const store = existingStore.store

      // It's taken UNLESS it's owned by current user
      const isOwnStore = store.userId === member.id

      if (!isOwnStore) {
        return true // Slug taken by someone else
      }
    }

    return false // Username/slug is available
  }

  if (userName && (await exists(userName))) {
    return NextResponse.json(
      { error: "Username already exists" },
      { status: 400 },
    )
  }

  const existingUser = userName
    ? await getUser({
        userName,
      })
    : undefined

  if (existingUser && existingUser.id !== member.id) {
    return NextResponse.json(
      { error: "Username already exists" },
      { status: 400 },
    )
  }

  try {
    // Update user
    await updateUser({
      ...member,
      language: language ?? "en",
      name: name ?? member.name,
      image: image ?? member.image,
      userName: userName ?? member.userName,
      characterProfilesEnabled:
        characterProfilesEnabled ?? member.characterProfilesEnabled,
      memoriesEnabled: memoriesEnabled ?? member.memoriesEnabled,
      favouriteAgent: favouriteAgent ?? member.favouriteAgent,
      city: city ?? member.city,
      country: country ?? member.country,
    })

    // If username changed, update store slug if it matches old username
    if (userName && userName !== member.userName) {
      const userStore = await getStore({ slug: member.userName })
      if (userStore && userStore.store.userId === member.id) {
        const { updateStore } = await import("@repo/db")
        await updateStore({
          ...userStore.store,
          slug: userName,
        })
      }
    }

    return NextResponse.json({
      ...(await getUser({
        id: member.id,
      })),
      password: undefined,
    })
  } catch (error) {
    captureException(error)
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const member = await getMember({
    skipCache: true,
  })

  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stripeSubscriptionId =
    member.subscription?.provider === "stripe"
      ? member.subscription.subscriptionId
      : null

  if (member.image) {
    await deleteFile(member.image)
  }

  try {
    if (stripeSubscriptionId) {
      await stripe.subscriptions.cancel(stripeSubscriptionId)
    }
    await deleteUser(member.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    captureException(error)
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
