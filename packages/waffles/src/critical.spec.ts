import { expect, test } from "@playwright/test"
import { getURL, TEST_MEMBER_FINGERPRINTS, wait } from "."
import { subscribe } from "./shared/subscribe"
import { signIn } from "./shared/signIn"

const isLive = false

import { clean, prepare } from "./shared/clean"

test.beforeEach(async ({ page }) => {
  await clean({ page })
})

// WM_001: Launch Watermelon game as guest
test("WM_001: Launch Watermelon as Guest", async ({ page }) => {
  await page.goto(
    getURL({
      isLive,
      isMember: false,
      fingerprint: TEST_MEMBER_FINGERPRINTS[0],
      app: "watermelon",
    }),
    {
      waitUntil: "domcontentloaded",
      timeout: 100000,
    },
  )
  await prepare({ page })

  // Wait for watermelon canvas/game to load
  const canvas = page.locator("canvas").first()
  await expect(canvas).toBeVisible({ timeout: 15000 })

  console.log("✅ WM_001: Watermelon canvas loaded for guest")
})

// WM_002: Launch Watermelon game as member
test("WM_002: Launch Watermelon as Member", async ({ page }) => {
  await page.goto(
    getURL({
      isLive,
      isMember: true,
      app: "watermelon",
    }),
    {
      waitUntil: "domcontentloaded",
      timeout: 100000,
    },
  )
  await prepare({ page })

  // Wait for watermelon canvas/game to load
  const canvas = page.locator("canvas").first()
  await expect(canvas).toBeVisible({ timeout: 15000 })

  console.log("✅ WM_002: Watermelon canvas loaded for member")
})

// WM_003: Basic game interaction
test("WM_003: Basic Game Interaction", async ({ page }) => {
  await page.goto(
    getURL({
      isLive,
      isMember: false,
      fingerprint: TEST_MEMBER_FINGERPRINTS[1],
      app: "watermelon",
    }),
    {
      waitUntil: "domcontentloaded",
      timeout: 100000,
    },
  )
  await prepare({ page })

  const canvas = page.locator("canvas").first()
  await expect(canvas).toBeVisible({ timeout: 15000 })

  // Click on canvas to drop a fruit
  const box = await canvas.boundingBox()
  if (box) {
    await canvas.click({
      position: { x: box.width / 2, y: box.height / 4 },
    })
  }

  await wait(1000)

  // Verify game is still responsive (no crash)
  await expect(canvas).toBeVisible()

  console.log("✅ WM_003: Basic game interaction successful")
})

test("Subscribe As Guest", async ({ page }) => {
  await page.goto(
    getURL({
      isLive,
      isMember: false,
      fingerprint: TEST_MEMBER_FINGERPRINTS[0],
    }),
    {
      waitUntil: "domcontentloaded",
      timeout: 100000,
    },
  )
  await prepare({ page })
  await subscribe({
    page,
    isMember: false,
  })
})

test("Subscribe as Member", async ({ page }) => {
  await clean({ page })
  await page.goto(getURL({ isLive: false, isMember: true }), {
    waitUntil: "domcontentloaded",
    timeout: 100000,
  })

  await signIn({ page })
  await subscribe({ page, isMember: true })
})
