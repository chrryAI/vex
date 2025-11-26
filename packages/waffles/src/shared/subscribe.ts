import { expect, Page } from "@playwright/test"
import { signIn } from "./signIn"
import { chat } from "./chat"
import { isCI, modelName } from "../index"

export const subscribe = async ({
  page,
  isMember,
  email = process.env.VEX_TEST_EMAIL_2!,
  password = process.env.VEX_TEST_PASSWORD_2!,
  gift,
  invite,
}: {
  page: Page
  isMember?: boolean
  email?: string
  password?: string
  gift?: string
  invite?: string
}) => {
  page.on("console", (msg) => {
    console.log(`[browser][${msg.type()}] ${msg.text()}`, msg)
  })
  const inviteOrGift = invite || gift

  const createChat = !inviteOrGift && !isMember

  const prompts = [
    {
      text: "Hello",
      model: "sushi" as modelName,
    },
    {
      text: "World",
      model: "sushi" as modelName,
    },
  ]
  if (createChat) {
    await chat({
      page,
      isMember,
      isNewChat: false,
      prompts,
    })
  }

  let threadUrl

  if (createChat) {
    threadUrl = page.url()
    const threadId = threadUrl.split("/threads/")[1]?.split("?")[0]
    expect(threadId).toBeTruthy()

    const guestCount = await page.getByTestId("guest-message").count()

    expect(guestCount).toBe(2)
  }

  const subscribeButton = page.getByTestId("subscribe-button")
  await expect(subscribeButton).toBeVisible({
    timeout: 5000,
  })
  await subscribeButton.click()

  const modal = page.getByTestId("subscribe-modal")
  await expect(modal).toBeVisible()

  const checkoutButton = page.getByTestId("subscribe-checkout")

  const subscribeGift = page.getByTestId("subscribe-gift")
  await expect(subscribeGift).toBeVisible()

  // if (!isMember) {
  // }

  if (inviteOrGift) {
    await subscribeGift.click()
    const subscribeGiftInput = page.getByTestId("subscribe-gift-input")
    await expect(subscribeGiftInput).toBeVisible()
    await subscribeGiftInput.fill(inviteOrGift)

    const subscribeGiftSearch = page.getByTestId("subscribe-gift-search")
    await expect(subscribeGiftSearch).toBeVisible()
    await subscribeGiftSearch.click()
    await page.waitForTimeout(5000)
  }

  const getCreditsLeft = async (page: Page) => {
    const creditsInfo = page.getByTestId("credits-info")

    await expect(creditsInfo).toBeVisible({
      timeout: 10000,
    })

    return parseInt(
      (await creditsInfo.getAttribute("data-credits-left", {
        timeout: 1000,
      })) || "0",
    )
  }

  if (invite) {
    await subscribeGift.click()
  } else if (gift) {
    await subscribeGift.click()
  } else {
    await expect(checkoutButton).toBeVisible()
    await checkoutButton.click()
  }

  await page.waitForSelector("form.PaymentForm-form")

  // Fill payment form
  await page.fill("#email", "test@example.com")
  await page.fill("#cardNumber", "4242424242424242") // Stripe test card
  await page.fill("#cardExpiry", "12/30") // MM/YY
  await page.fill("#cardCvc", "123")
  await page.fill("#billingName", "Test User")

  // Fill address fields for USA billing

  if (isCI) {
    await page.selectOption("#billingCountry", "NL")
  }

  const guestMessages = page.getByTestId("guest-message")

  //   await page.selectOption("#billingCountry", "US") // Select country

  await page.waitForTimeout(1000)

  await page.click('[data-testid="hosted-payment-submit-button"]')

  const plusButton = page.getByTestId("plus-button")
  await expect(plusButton).toBeVisible({
    timeout: 20000,
    visible: !inviteOrGift,
  })

  await expect(subscribeButton).toBeVisible({
    visible: !!inviteOrGift,
    timeout: 10000,
  })

  const purchaseTypeInput = page.getByTestId("purchase-type")

  // Wait for toast with partial text match (handles emoji and variations)
  await expect(purchaseTypeInput).toHaveValue(
    inviteOrGift ? "gift" : "subscription",
  )

  const getNthMenuThread = async (nth: number) => {
    const threads = page.getByTestId("menu-thread-item")
    return threads.nth(nth)
  }
  const getFirstMenuThread = async () => {
    return getNthMenuThread(0)
  }

  if (createChat && threadUrl) {
    expect(await getCreditsLeft(page)).toBe(2000 - prompts.length * 2)

    await signIn({
      page,
      email,
      password,
    })

    // const first = await getFirstMenuThread()
    // await expect(first).toBeVisible({
    //   timeout: 20000,
    // })

    await page.goto(threadUrl, {
      waitUntil: "networkidle",
    })

    const getLastMessage = async () => {
      // Wait for either user or guest messages to appear
      await page.waitForFunction(
        () => {
          const userMessages = document.querySelectorAll(
            '[data-testid="user-message"]',
          )
          const guestMessages = document.querySelectorAll(
            '[data-testid="guest-message"]',
          )
          console.log(
            `Debug: Found ${userMessages.length} user messages, ${guestMessages.length} guest messages`,
          )
          return userMessages.length > 0 || guestMessages.length > 0
        },
        { timeout: 10000 },
      )

      // Try both user and guest message types since the test ID depends on actual user context
      const userMessages = page.getByTestId("user-message")
      const guestMessages = page.getByTestId("guest-message")

      const userCount = await userMessages.count()
      const guestCount = await guestMessages.count()

      console.log(
        `Debug: After wait - ${userCount} user messages, ${guestCount} guest messages`,
      )

      if (userCount > 0) {
        console.log(`Debug: Using user message (${userCount} found)`)
        return userMessages.nth(userCount - 1)
      } else if (guestCount > 0) {
        console.log(`Debug: Using guest message (${guestCount} found)`)
        return guestMessages.nth(guestCount - 1)
      } else {
        throw new Error("No user or guest messages found after waiting")
      }
    }

    await expect(await getLastMessage()).toBeVisible({
      timeout: 10000,
    })
  }

  if (inviteOrGift) {
    const fingerprint = await subscribeButton.getAttribute(
      "data-gifted-fingerprint",
    )

    expect(fingerprint).toBeTruthy()

    // Open gift redemption in fresh browser context
    const giftBrowser = page.context().browser()!
    const giftContext = await giftBrowser.newContext()
    const giftPage = await giftContext.newPage()
    await giftPage.goto(`${page.url().split("?")[0]}?gift=${fingerprint}`, {
      waitUntil: "networkidle",
    })

    await giftPage.bringToFront()

    if (gift) {
      await signIn({
        page: giftPage,
        email,
        password,
      })
    }

    // Verify guest receives subscription
    const giftSubscribeButton = giftPage.getByTestId("subscribe-button")
    await expect(giftSubscribeButton).not.toBeVisible({
      timeout: 10000,
    })

    // Check for subscription confirmation
    const giftPlusButton = giftPage.getByTestId("plus-button")
    await expect(giftPlusButton).toBeVisible({
      timeout: 20000,
    })

    expect(await getCreditsLeft(giftPage)).toBeGreaterThan(150)
    await giftContext.close()
  }
}
