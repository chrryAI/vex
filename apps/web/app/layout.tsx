import { getMember } from "chrry-dot-dev"
import { v4 as uuidv4 } from "uuid"

import {
  deleteCreditUsage,
  deleteMessage,
  deleteSubscription,
  deleteThread,
  getGuest as getGuestDb,
  getMessages,
  getStore,
  getSubscriptions,
  getThreads,
  getUser,
  updateGuest,
  updateThread,
  updateUser,
} from "@repo/db"
import { getLocale } from "next-intl/server"
import { locale } from "chrry/locales"

import { cookies, headers } from "next/headers"
import ChrryAI from "chrry/ChrryAI"

import { generateMeta } from "chrry/ChrryAI"

import {
  TEST_GUEST_FINGERPRINTS,
  TEST_MEMBER_EMAILS,
  TEST_MEMBER_FINGERPRINTS,
} from "@repo/db"
import { CHRRY_URL, generateAppMetadata } from "chrry/utils"
import { Providers } from "../components/Providers"
import { NextIntlClientProvider } from "next-intl"

export const generateMetadata = async () => {
  const locale = (await getLocale()) as locale

  const store = await getStore({
    domain: CHRRY_URL,
    depth: 1, // Populate one level of nested store.apps
  })

  if (!store?.app || !store.store) {
    return generateMeta({ locale })
  }

  const app = store.app

  if (!app.store) {
    return generateMeta({ locale })
  }

  return generateAppMetadata({
    locale,
    app,
    store: app.store,
    currentDomain: CHRRY_URL,
  })
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const currentMember = await getMember()
  const headersList = await headers()

  const locale = (await getLocale()) as locale

  const cookieStore = await cookies()

  const fingerprint =
    cookieStore.get("fingerprint")?.value || headersList.get("x-fp") || uuidv4()

  const testMember =
    fingerprint && TEST_MEMBER_FINGERPRINTS.includes(fingerprint)
      ? await getUser({
          fingerprint: fingerprint,
        })
      : null

  if (testMember && TEST_MEMBER_EMAILS.includes(testMember.email)) {
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
  } else if (fingerprint && TEST_GUEST_FINGERPRINTS.includes(fingerprint)) {
    const guest = await getGuestDb({ fingerprint: fingerprint })

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

  return (
    <NextIntlClientProvider locale={locale} messages={{}}>
      <ChrryAI
        Wrapper={Providers}
        apiKey={currentMember?.token || fingerprint}
        locale={locale as locale}
        headersList={headersList}
        cookieStore={cookieStore}
      >
        {children}
      </ChrryAI>
    </NextIntlClientProvider>
  )
}
