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
  updateThread,
  TEST_MEMBER_EMAILS,
  TEST_GUEST_FINGERPRINTS,
  TEST_MEMBER_FINGERPRINTS,
  user,
  guest,
  deleteGuest,
  updateUser,
} from "@repo/db"
import { MEMBER_CREDITS_PER_MONTH } from "@repo/db/src/schema"

const allowedFingerprints = TEST_GUEST_FINGERPRINTS.concat(
  TEST_MEMBER_FINGERPRINTS,
)

export default async function cleanupTest() {
  for (const email of TEST_MEMBER_EMAILS) {
    const user = await getUser({ email, skipCache: true })
    if (user && email && user.email === email) {
      await cleanup({
        user,
      })
    }
  }
  for (const fingerprint of allowedFingerprints) {
    const guest = await getGuestDb({ fingerprint, skipCache: true })

    // Cleanup for test guest
    // SAFETY: Multiple checks to prevent accidental deletion of production data
    // 1. Guest exists from DB
    // 2. Fingerprint param provided
    // 3. Guest's fingerprint matches param (prevents wrong guest cleanup)
    // 4. Fingerprint is in test whitelist (prevents production user cleanup)
    if (
      guest &&
      fingerprint &&
      guest.fingerprint === fingerprint &&
      allowedFingerprints.includes(fingerprint)
    ) {
      await cleanup({
        guest,
      })
    }
  }
  return
}

// Shared cleanup logic for both member and guest
async function cleanup({ user, guest }: { user?: user; guest?: guest }) {
  if (!user && !guest) {
    return
  }

  // 1. Delete credit usage
  await deleteCreditUsage({ userId: user?.id, guestId: guest?.id })

  // 2. Get and delete messages FIRST (they reference threads)
  const messages = await getMessages({
    pageSize: 100000,
    userId: user?.id,
    guestId: guest?.id,
  })

  await Promise.all(
    messages.messages.map((message) =>
      deleteMessage({ id: message.message.id }),
    ),
  )

  // 3. Get and cleanup threads
  const threads = await getThreads({
    pageSize: 100000,
    userId: user?.id,
    guestId: guest?.id,
    // publicBookmarks: true,
  })

  await Promise.all(
    threads.threads.map((thread) => {
      const isOwner = user
        ? thread.userId === user.id
        : guest && thread.guestId === guest.id

      if (isOwner) {
        return deleteThread({ id: thread.id })
      } else {
        // Just remove bookmark, don't delete thread
        return updateThread({
          ...thread,
          bookmarks:
            thread?.bookmarks?.filter((bookmark) =>
              user
                ? bookmark.userId !== user.id
                : bookmark.guestId !== guest?.id,
            ) || [],
        })
      }
    }),
  )

  // 4. Delete subscriptions
  const subscriptions = await getSubscriptions({
    userId: user?.id,
    guestId: guest?.id,
  })

  await Promise.all(
    subscriptions.map((subscription) =>
      deleteSubscription({ id: subscription.id }),
    ),
  )

  user &&
    (await updateUser({
      ...user,
      credits: MEMBER_CREDITS_PER_MONTH,
      subscribedOn: null,
      migratedFromGuest: false,
      fingerprint: null,
    }))

  guest && (await deleteGuest({ id: guest.id }))
}
