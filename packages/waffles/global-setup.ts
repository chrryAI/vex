import { chromium, FullConfig } from "@playwright/test"

async function globalSetup(config: FullConfig) {
  const baseURL = config.use?.baseURL || "http://localhost:5173"
  const apiURL = baseURL.replace("chrry.ai", "chrry.dev")

  console.log(`🔥 Warming up backend at ${apiURL}...`)

  // Warm up the API with retries
  const maxRetries = 10
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${apiURL}/api/health`, {
        method: "GET",
      })
      if (response.ok) {
        console.log(`✅ Backend ready after ${i + 1} attempts`)
        break
      }
    } catch (error) {
      console.log(
        `⏳ Attempt ${i + 1}/${maxRetries} - Backend not ready yet...`,
      )
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  }

  // Also warm up WebSocket connection
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    await page.goto(baseURL, { waitUntil: "networkidle", timeout: 60000 })
    console.log("✅ Frontend loaded successfully")
  } catch (error) {
    console.log("⚠️  Frontend load warning (may be okay):", error)
  }

  await browser.close()
}

export default globalSetup
