import {
  deleteCreditUsage,
  deleteMessage,
  deleteSubscription,
  deleteThread,
  getGuest as getGuestDb,
  getMessages,
  getSubscriptions,
  getThreads,
  getUser,
  updateGuest,
  updateThread,
  TEST_MEMBER_EMAILS,
  TEST_GUEST_FINGERPRINTS,
} from "@repo/db"

export default async function cleanupTest({
  fingerprint,
}: {
  fingerprint?: string
} = {}) {
  if (!fingerprint) {
    for (const email of TEST_MEMBER_EMAILS) {
      const user = await getUser({ email })
      if (user) {
        await cleanupUser({
          type: "member",
          userId: user.id,
        })
      }
    }
    for (const fp of TEST_GUEST_FINGERPRINTS) {
      await cleanupTest({
        fingerprint: fp,
      })
    }
    return
  }

  const guest =
    fingerprint && TEST_GUEST_FINGERPRINTS.includes(fingerprint)
      ? await getGuestDb({ fingerprint })
      : null

  // Cleanup for test guest
  if (guest && TEST_GUEST_FINGERPRINTS.includes(fingerprint)) {
    await cleanupUser({
      guestId: guest.id,
      type: "guest",
    })

    await updateGuest({
      ...guest,
      credits: 30,
      subscribedOn: null,
    })
  }
}

// Shared cleanup logic for both member and guest
async function cleanupUser({
  userId,
  guestId,
  type,
}: {
  userId?: string
  guestId?: string
  type: "member" | "guest"
}) {
  const idFilter = type === "member" ? { userId } : { guestId }

  // 1. Delete credit usage
  await deleteCreditUsage(idFilter)

  // 2. Get and delete messages FIRST (they reference threads)
  const messages = await getMessages({
    pageSize: 100000,
    ...idFilter,
  })

  await Promise.all(
    messages.messages.map((message) =>
      deleteMessage({ id: message.message.id }),
    ),
  )

  // 3. Get and cleanup threads
  const threads = await getThreads({
    pageSize: 100000,
    ...idFilter,
    publicBookmarks: true,
  })

  await Promise.all(
    threads.threads.map((thread) => {
      const isOwner =
        type === "member"
          ? thread.userId === userId
          : thread.guestId === guestId

      if (isOwner) {
        return deleteThread({ id: thread.id })
      } else {
        // Just remove bookmark, don't delete thread
        return updateThread({
          ...thread,
          bookmarks:
            thread?.bookmarks?.filter((bookmark) =>
              type === "member"
                ? bookmark.userId !== userId
                : bookmark.guestId !== guestId,
            ) || [],
        })
      }
    }),
  )

  // 4. Delete subscriptions
  const subscriptions = await getSubscriptions(idFilter)

  await Promise.all(
    subscriptions.map((subscription) =>
      deleteSubscription({ id: subscription.id }),
    ),
  )
}
