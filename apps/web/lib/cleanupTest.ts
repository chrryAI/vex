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
  updateUser,
  TEST_MEMBER_EMAILS,
  TEST_GUEST_FINGERPRINTS,
  TEST_MEMBER_FINGERPRINTS,
} from "@repo/db"

export default async function cleanupTest({
  fingerprint,
}: {
  fingerprint: string
}) {
  const testMember =
    fingerprint && TEST_MEMBER_FINGERPRINTS.includes(fingerprint)
      ? await getUser({
          fingerprint: fingerprint,
        })
      : null

  const guest =
    fingerprint && TEST_GUEST_FINGERPRINTS.includes(fingerprint)
      ? await getGuestDb({
          fingerprint: fingerprint,
        })
      : null

  if (
    testMember &&
    TEST_MEMBER_EMAILS.includes(testMember.email) &&
    testMember.isOnline
  ) {
    await deleteCreditUsage({
      userId: testMember.id,
    })

    await updateUser({
      ...testMember,
      credits: 150,
      migratedFromGuest: false,
      subscribedOn: null,
    })

    const threads = await getThreads({
      pageSize: 100000,
      userId: testMember.id,
      publicBookmarks: true,
    })

    await Promise.all(
      threads.threads.map((thread) => {
        thread.userId === testMember.id
          ? deleteThread({ id: thread.id })
          : updateThread({
              ...thread,
              bookmarks:
                thread?.bookmarks?.filter(
                  (bookmark) => bookmark.userId !== testMember.id,
                ) || [],
            })
      }),
    )

    const messages = await getMessages({
      pageSize: 100000,
      userId: testMember.id,
    })

    await Promise.all(
      messages.messages.map((message) => {
        deleteMessage({
          id: message.message.id,
        })
      }),
    )

    const subscriptions = await getSubscriptions({
      userId: testMember.id,
    })

    await Promise.all(
      subscriptions.map((subscription) => {
        deleteSubscription({ id: subscription.id })
      }),
    )
  } else if (TEST_GUEST_FINGERPRINTS.includes(fingerprint) && guest?.isOnline) {
    if (guest) {
      await deleteCreditUsage({
        guestId: guest.id,
      })

      const threads = await getThreads({
        pageSize: 100000,
        guestId: guest.id,
        publicBookmarks: true,
      })

      const messages = await getMessages({
        pageSize: 100000,
        guestId: guest.id,
      })

      await Promise.all(
        messages.messages.map((message) => {
          deleteMessage({
            id: message.message.id,
          })
        }),
      )

      await Promise.all(
        threads.threads.map((thread) => {
          thread.guestId === guest.id
            ? deleteThread({ id: thread.id })
            : updateThread({
                ...thread,
                bookmarks:
                  thread?.bookmarks?.filter(
                    (bookmark) => bookmark.guestId !== guest.id,
                  ) || [],
              })
        }),
      )

      const subscriptions = await getSubscriptions({
        guestId: guest.id,
      })

      await Promise.all(
        subscriptions.map((subscription) => {
          deleteSubscription({ id: subscription.id })
        }),
      )

      await updateGuest({
        ...guest,
        credits: 30,
        subscribedOn: null,
      })
    }
  }
}
