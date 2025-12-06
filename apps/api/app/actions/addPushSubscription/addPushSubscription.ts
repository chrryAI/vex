"use server"

import {
  createPushSubscription,
  getPushSubscription,
  NewCustomPushSubscription,
} from "@repo/db"
import getMember from "../getMember"

export default async function addPushSubscription({
  subscription,
}: {
  subscription: NewCustomPushSubscription
}) {
  const member = await getMember()
  if (!member) {
    return {
      error: "Something went wrong, member not found.",
    }
  }

  try {
    const pushSubscription = await createPushSubscription({
      userId: member.id,
      subscription,
    })

    return {
      pushSubscription: pushSubscription
        ? await getPushSubscription({ id: pushSubscription.id })
        : null,
      success: true,
    }
  } catch (error) {
    return {
      error: "Failed to add push subscription, please try again",
    }
  }
}
