import { expect, Page } from "@playwright/test"
import {
  getURL,
  simulateInputPaste,
  wait,
  capitalizeFirstLetter,
  simulatePaste,
  modelName,
} from ".."
import path from "path"
import process from "process"
import { faker } from "@faker-js/faker"

// Resolve paths relative to the waffles package root
const getTestFilePath = (...pathSegments: string[]) => {
  const cwd = process.cwd()
  // Check if we're already in the waffles directory
  if (cwd.endsWith("packages/waffles") || cwd.endsWith("waffles")) {
    return path.join(cwd, ...pathSegments)
  }
  // Otherwise, assume we're in monorepo root
  return path.join(cwd, "packages/waffles", ...pathSegments)
}

const MAX_FILES = 5

export const chat = async ({
  artifacts,
  page,
  isMember,
  isSubscriber,

  instruction = "This thread will be all about React Native, are you ready?",
  prompts = [
    {
      stop: false,
      text: "Hello",
      agentMessageTimeout: 500000,
      webSearch: false,
      delete: true,
      mix: {
        image: 0,
        video: 0,
        audio: 0,
        paste: 0,
        pdf: 0,
      },
    },
  ],
  agentMessageTimeout = 50 * 1000,
  isNewChat = true,
  isLiveTest = false,
  threadId,
  creditsConsumed = 0,
  bookmark = true,
}: {
  isSubscriber?: boolean
  artifacts?: {
    text?: number
    paste?: number
    pdf?: number
  }
  page: Page
  isMember?: boolean
  instruction?: string
  prompts?: {
    debateAgent?: modelName
    stop?: boolean
    text: string
    instruction?: string
    deleteMessage?: boolean
    deleteAgentMessage?: boolean
    model?: modelName
    agentMessageTimeout?: number
    shouldFail?: boolean
    like?: boolean
    delete?: boolean
    webSearch?: boolean

    mix?: {
      image?: number
      video?: number
      audio?: number
      paste?: number
      pdf?: number
    }
  }[]
  agentMessageTimeout?: number
  isNewChat?: boolean
  isLiveTest?: boolean
  threadId?: string
  creditsConsumed?: number
  bookmark?: boolean
}) => {
  page.on("console", (msg) => {
    console.log(`[browser][${msg.type()}] ${msg.text()}`, msg)
  })

  if (threadId) {
    instruction = ""
  }

  const fileExtensions = {
    image: "jpeg",
    video: "webm",
    audio: "wav",
    pdf: "pdf",
  }

  const hourlyLimit = isSubscriber ? 100 : isMember ? 30 : 10 // guests: 10, members: 30, subscribers: 100

  const getModelCredits = (model: string) =>
    model === "flux"
      ? 2
      : isMember
        ? model === "chatGPT"
          ? 4
          : model === "sushi"
            ? 2
            : model === "claude"
              ? 3
              : 2
        : 2

  const MAX_FILE_SIZE = 4

  if (isLiveTest) {
    await page.goto(getURL({ isLive: true, isMember }), {
      waitUntil: "networkidle",
    })
    await wait(3000)
  } else if (isNewChat) {
    await page.goto(getURL({ isLive: false, isMember }), {
      waitUntil: "networkidle",
    })
    await wait(3000)
  }

  let credits = isSubscriber ? 2000 : (isMember ? 150 : 30) - creditsConsumed
  let hourlyUsage = creditsConsumed || 0 // Track hourly usage for assertions

  const agentModal = page.getByTestId("agent-modal")
  await expect(agentModal).not.toBeVisible()

  const signInModal = page.getByTestId("sign-in-modal")
  await expect(signInModal).not.toBeVisible()

  const agentSelectButton = page.getByTestId("agent-select-button")
  await expect(agentSelectButton).toBeVisible()

  const addDebateAgentButton = page.getByTestId("add-debate-agent-button")
  await expect(addDebateAgentButton).toBeVisible()

  const getAgentName = async () => {
    return page
      .getByTestId("agent-select-button")
      .getAttribute("data-agent-name")
  }

  const getDebateAgentName = async () => {
    return page
      .getByTestId("add-debate-agent-button")
      .getAttribute("data-agent-name")
  }

  expect(await getAgentName()).toBe("sushi")

  const chatTextarea = page.getByTestId("chat-textarea")
  await expect(chatTextarea).toBeVisible()

  const creditsInfo = page.getByTestId("credits-info")
  await expect(creditsInfo).toBeVisible()
  const scrollToBottom = async () => {
    return
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await wait(500) // Give time for scroll to complete
  }

  const getCreditsLeft = async () => {
    await scrollToBottom() // Ensure credit info is visible
    const creditsInfo = page.getByTestId("credits-info")
    const isCreditsVisible = await creditsInfo.isVisible().catch(() => false)
    if (!isCreditsVisible) {
      return null // Credits info is hidden when hourly limit is shown
    }
    return await creditsInfo.getAttribute("data-credits-left", {
      timeout: 1000,
    })
  }

  const getHourlyUsageLeft = async () => {
    await scrollToBottom() // Ensure hourly limit info is visible
    const hourlyLimitInfo = page.getByTestId("hourly-limit-info")

    return await hourlyLimitInfo.getAttribute("data-hourly-left", {
      timeout: 1000,
    })
  }

  const login = page.getByTestId("login-from-chat-button")
  await expect(login).toBeVisible()

  expect(await getCreditsLeft()).toBe(credits.toString())

  const thread = page.getByTestId("thread")

  let willFail = false

  const getNthInstruction = async (nth: number) => {
    const items = page.getByTestId("instruction-item")
    return items.nth(nth)
  }

  const about = page.getByTestId("instruction-about")
  let instructionButton = await getNthInstruction(0)
  let artifactsButton = page.getByTestId("instruction-modal-artifacts-button")

  let artifactsUploadButton = page.getByTestId(
    "instruction-artifacts-upload-button",
  )

  if (!threadId) {
    await expect(thread).not.toBeVisible()
    await expect(instructionButton).toBeVisible()
    await expect(about).toBeVisible()
  } else {
    await expect(instructionButton).not.toBeVisible()

    instructionButton = page.getByTestId("chat-instruction-button")
    artifactsButton = page.getByTestId("chat-modal-artifacts-button")
    artifactsUploadButton = page.getByTestId("chat-artifacts-upload-button")
    await expect(thread).toBeVisible()
    await expect(about).not.toBeVisible()
  }

  // await expect(instructionButton).not.toBeVisible()
  const instructionModal = page.getByTestId("instruction-modal")
  await expect(instructionModal).not.toBeVisible()

  if (instruction) {
    await instructionButton.click()

    await expect(instructionModal).toBeVisible()

    const modalTextarea = page.getByTestId("instruction-modal-textarea")
    await expect(modalTextarea).toBeVisible()

    await modalTextarea.fill(instruction)

    const modalCharLeft = page.getByTestId("instruction-modal-char-left")
    await expect(modalCharLeft).toBeVisible()

    const modalSaveButton = page.getByTestId("instruction-modal-save-button")
    await expect(modalSaveButton).toBeVisible()

    if (artifacts) {
      await artifactsButton.click()

      const dataTestId = threadId ? "chat" : "instruction"
      await expect(instructionModal).toBeVisible()

      if (artifacts.paste) {
        for (let i = 0; i < artifacts.paste; i++) {
          await simulatePaste(
            page,
            faker.lorem.sentence({ min: 550, max: 750 }),
          )
        }
      }

      const fileChooserPromise = page.waitForEvent("filechooser")

      let filesToAttach: string[] = []
      let filesToPaste = 0

      for (const [key, count] of Object.entries(
        artifacts as Record<string, number>,
      )) {
        if (key === "paste") {
          filesToPaste = count
        } else {
          // Add multiple files of same type
          for (let i = 0; i < count; i++) {
            filesToAttach.push(key)
          }
        }
      }

      const testUsedPaths = await Promise.all(
        Array.from({ length: filesToAttach.length }, async (_, i) => {
          // Determine file type based on prompt.mix configuration
          const fileType = filesToAttach[i]

          if (!fileType) {
            return null
          }

          const fileName = `test${capitalizeFirstLetter(fileType)}${i + 1}`
          const extension =
            fileExtensions[fileType as keyof typeof fileExtensions] || "jpeg"

          return path.join(
            process.cwd(),
            "src/shared",
            fileType,
            `${fileName}.${extension}`,
          )
        }),
      )

      await artifactsUploadButton.click()

      const fileChooser = await fileChooserPromise

      await fileChooser.setFiles(
        testUsedPaths.filter((path): path is string => path !== null),
      )

      if (filesToAttach.length + filesToPaste > 10) {
        await expect(page.getByText("Maximum 10 files allowed")).toBeVisible()
      }

      const modalSaveButton = page.getByTestId(
        `${dataTestId}-modal-save-button`,
      )
      await expect(modalSaveButton).toBeVisible()

      await modalSaveButton.click()

      expect(await page.getByText("Updated").count()).toBeGreaterThan(0)
    } else {
      await modalSaveButton.click()
    }
  }

  const getAgentModalButton = (agent: string) => {
    const agentModalButton = page.getByTestId(`agent-modal-button-${agent}`)
    return agentModalButton
  }

  for (const prompt of prompts) {
    const debateAgentDeleteButton = page.getByTestId(
      "debate-agent-delete-button",
    )
    const isDebateAgentVisible = await debateAgentDeleteButton.isVisible()

    if (isDebateAgentVisible) {
      await debateAgentDeleteButton.click()
    }
    if (prompt.model && prompt.model !== (await getAgentName())) {
      await agentSelectButton.click()

      await expect(agentModal).toBeVisible()

      const agentModalButton = getAgentModalButton(prompt.model)

      await agentModalButton.click()

      expect(await getAgentName()).toBe(prompt.model)
    }

    if (prompt.debateAgent) {
      {
        await addDebateAgentButton.click()

        await expect(agentModal).toBeVisible()

        const geminiButton = page.getByTestId(`agent-modal-button-gemini`)

        const fluxButton = page.getByTestId(`agent-modal-button-flux`)

        expect(geminiButton).not.toBeVisible()
        expect(fluxButton).not.toBeVisible()

        const agentModalButton = page.getByTestId(
          `agent-modal-button-${prompt.debateAgent}`,
        )

        await agentModalButton.click()
      }
      if (!isMember) {
        expect(prompt.shouldFail).toBe(true)
        willFail = true
      } else {
        expect(await getDebateAgentName()).toBe(prompt.debateAgent)
        await addDebateAgentButton.click()

        await expect(getAgentModalButton(prompt.debateAgent)).not.toBeVisible()

        const agentModalCloseButton = page.getByTestId(
          "agent-modal-close-button",
        )

        await expect(agentModalCloseButton).toBeVisible()
        await agentModalCloseButton.click()

        await agentSelectButton.click()
        await expect(agentModal).toBeVisible()

        const fluxButton = getAgentModalButton("flux")
        await expect(fluxButton).toBeVisible()
        await fluxButton.click()
        await wait(1000)

        await expect(addDebateAgentButton).not.toBeVisible()

        await agentSelectButton.click()

        const promptAgentModalButton = page.getByTestId(
          `agent-modal-button-${prompt.model}`,
        )

        await promptAgentModalButton.click()

        expect(await getAgentName()).toBe(prompt.model)
        await addDebateAgentButton.click()
        await expect(addDebateAgentButton).toBeVisible()

        await getAgentModalButton(prompt.debateAgent).click()
        expect(await getDebateAgentName()).toBe(prompt.debateAgent)
        expect(await getAgentName()).toBe(prompt.model)
      }
    }

    if (willFail) {
      return
    }

    const attachButton = page.getByTestId("attach-button")

    if (prompt.mix) {
      const size = Object.values(prompt.mix).reduce((a, b) => a + b)
      const to = size > MAX_FILES ? MAX_FILES : size

      // Create array of individual files to attach
      let filesToAttach: string[] = []
      let filesToPaste = 0

      for (const [key, count] of Object.entries(prompt.mix)) {
        if (key === "paste") {
          filesToPaste = count
        } else {
          // Add multiple files of same type
          for (let i = 0; i < count; i++) {
            filesToAttach.push(key)
          }
        }
      }

      for (let i = 0; i < filesToPaste; i++) {
        const text = faker.lorem.sentence({ min: 550, max: 750 })
        await simulateInputPaste(page, text)
        await page.waitForTimeout(1000)
      }

      for (let i = 0; i < filesToAttach.length; i++) {
        const key = filesToAttach[i]
        if (!key) break

        const fileChooserPromise = page.waitForEvent("filechooser")

        attachButton.click()
        await wait(1000)
        {
          const fileChooser = await fileChooserPromise

          const extension =
            fileExtensions[key as keyof typeof fileExtensions] || "jpeg"

          const fileIndex = filesToAttach
            .slice(0, i + 1)
            .filter((k) => k === key).length

          const testUsed = path.join(
            process.cwd(),
            `src/shared/${key}/test${capitalizeFirstLetter(key)}${fileIndex}.${extension}`,
          )
          await fileChooser.setFiles(testUsed)

          await page.waitForTimeout(2000)
        }
      }

      const filePreviewClears = page.getByTestId("file-preview-clear")

      for (let i = 0; i < to; i++) {
        const filePreviewClear = filePreviewClears.nth(0)
        await expect(filePreviewClear).toBeVisible()
        await filePreviewClear.click()
        await page.waitForTimeout(500)
      }

      for (let i = 0; i < filesToPaste; i++) {
        const text = faker.lorem.sentence({ min: 550, max: 750 })
        await simulateInputPaste(page, text)
        await page.waitForTimeout(1000)
      }

      if (filesToAttach.length > 0) {
        await expect(attachButton).toBeVisible()
        attachButton.click()

        const fileChooserPromise = page.waitForEvent("filechooser")

        const fileChooser = await fileChooserPromise

        const testUsedPaths = await Promise.all(
          Array.from({ length: filesToAttach.length }, async (_, i) => {
            // Determine file type based on prompt.mix configuration
            const fileType = filesToAttach[i]

            if (!fileType) {
              return null
            }

            const fileName = `test${capitalizeFirstLetter(fileType)}${i + 1}`
            const extension =
              fileExtensions[fileType as keyof typeof fileExtensions] || "jpeg"

            return path.join(
              process.cwd(),
              "src/shared",
              fileType,
              `${fileName}.${extension}`,
            )
          }),
        )

        await fileChooser.setFiles(
          testUsedPaths.filter((path): path is string => path !== null),
        )

        if (filesToAttach.length + filesToPaste > 5) {
          await expect(page.getByText("Too many files selected")).toBeVisible()
        }
      }
    }

    await chatTextarea.fill(prompt.text)

    if (prompt.webSearch) {
      const webSearchButton = page.getByTestId("web-search-button-disabled")
      await expect(webSearchButton).toBeVisible()

      await webSearchButton.click()

      if (!isMember) {
        await expect(agentModal).toBeVisible()

        const agentModalCloseButton = page.getByTestId(
          "agent-modal-close-button",
        )

        await expect(agentModalCloseButton).toBeVisible()
        await agentModalCloseButton.click()
      }
    }

    const sendButton = page.getByTestId("chat-send-button")
    await expect(sendButton).toBeVisible()

    // Handle shouldFail case - test hourly limit boundary
    if (prompt.shouldFail) {
      console.log(
        `🚫 Testing hourly limit boundary with message: "${prompt.text}"`,
      )

      await expect(sendButton).toBeDisabled()

      // Exit the loop since we've tested the limit
      break
    }

    // await scrollToBottom() // Ensure send button is visible
    await sendButton.click()

    const acceptButton = page.getByTestId("chat-accept-button")

    const isAcceptButtonVisible = await acceptButton.isVisible()

    if (isAcceptButtonVisible) {
      await wait(2000)
      await sendButton.click()
    }

    if (prompts.indexOf(prompt) === 0 && artifacts) {
      await expect(page.getByText("Uploading artifacts...")).toBeVisible()
    }

    await page.waitForTimeout(5000)

    const stopButton = page.getByTestId("chat-stop-streaming-button")
    await expect(stopButton).toBeVisible({
      timeout: prompt.agentMessageTimeout || agentMessageTimeout,
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
      timeout: prompt.agentMessageTimeout || agentMessageTimeout,
    })

    const lastMessage = await getLastMessage()
    console.log(`Debug: Got last message, looking for delete button...`)

    if (prompt.stop) {
      await stopButton.click()
      await expect(stopButton).not.toBeVisible({
        timeout: 8000,
      })

      prompt.model && (credits -= getModelCredits(prompt.model))
    } else {
      hourlyUsage += 1 + (prompt.debateAgent ? 1 : 0)
    }
    // Check if delete button exists
    const deleteMessageButton = lastMessage.locator(
      "[data-testid=delete-message]",
    )
    const deleteButtonCount = await deleteMessageButton.count()
    console.log(
      `Debug: Found ${deleteButtonCount} delete buttons in last message`,
    )

    // // Get the message text directly from the element with the expected text
    const userMessageContent = (await getLastMessage()).getByText(prompt.text)
    await expect(userMessageContent).toBeVisible({
      timeout: agentMessageTimeout,
    })
    // Get all agent messages and wait for the last one to be visible

    const getLastAgentMessage = async () => {
      const agentMessages = page.getByTestId("agent-message")
      const messageCount = await agentMessages.count()
      return agentMessages.nth(messageCount - 1)
    }

    const getLastUserMessage = async () => {
      const userMessages = page.getByTestId(
        `${isMember ? "user" : "guest"}-message`,
      )
      const messageCount = await userMessages.count()
      return userMessages.nth(messageCount - 1)
    }

    // Wait for the last message to be visible and have content
    await expect(await getLastAgentMessage()).toBeVisible()
    // await expect(
    //   lastAgentMessage.locator("[data-testid=markdown-paragraph]"),
    // ).toBeVisible({
    //   timeout: prompt.agentMessageTimeout || agentMessageTimeout,
    // })

    const deleteAgentMessageButton = (await getLastAgentMessage()).locator(
      "[data-testid=delete-message]",
    )
    await expect(deleteAgentMessageButton).toBeVisible({
      timeout: prompt.agentMessageTimeout || agentMessageTimeout,
      visible: !prompt.stop,
    })

    if (prompt.mix?.pdf) {
      const userMessagePdfCount = await (await getLastUserMessage())
        .getByTestId("user-message-pdf")
        .count()

      expect(userMessagePdfCount).toBe(
        prompt.mix.pdf > MAX_FILES ? MAX_FILES : prompt.mix.pdf,
      )
    }

    if (prompt.webSearch) {
      const webSearchResults = (await getLastAgentMessage()).getByTestId(
        "web-search-results",
      )
      await expect(webSearchResults).toBeVisible({
        timeout: prompt.agentMessageTimeout || agentMessageTimeout,
      })

      const webSearchResult = webSearchResults.getByTestId("web-search-result")
      expect(await webSearchResult.count()).toBe(4)
    }

    await wait(1000)

    const threadUrl = page.url()
    const threadId = threadUrl.split("/threads/")[1]?.split("?")[0]
    expect(threadId).toBeTruthy()
    console.log("Thread:", threadId)

    const likeButton = (await getLastAgentMessage()).locator(
      "[data-testid=like-button]",
    )

    // if (prompts.indexOf(prompt) === 0 && artifacts) {
    //   const dataTestId = threadId ? "chat" : "instruction"
    //   let artifactsButton = page.getByTestId(
    //     `${dataTestId}-instruction-artifacts-button`,
    //   )
    //   await artifactsButton.click()

    //   const instructionModal = page.getByTestId(
    //     `${dataTestId}-instruction-modal`,
    //   )

    //   await expect(instructionModal).toBeVisible()

    //   const filePreviewClears = page.getByTestId(
    //     `${dataTestId}-instruction-file-preview-clear`,
    //   )

    //   let count = (artifacts.pdf || 0) + (artifacts.paste || 0)

    //   if (count > 5) {
    //     count = 5
    //   }

    //   for (let i = 0; i < count; i++) {
    //     const filePreviewClear = filePreviewClears.nth(count - i - 1)
    //     await expect(filePreviewClear).toBeVisible()
    //     await filePreviewClear.click()
    //     await page.waitForTimeout(1000)
    //   }

    //   expect(await filePreviewClears.count()).toBe(0)

    //   if (artifacts.paste) {
    //     for (let i = 0; i < artifacts.paste; i++) {
    //       await simulatePaste(
    //         page,
    //         faker.lorem.sentence({ min: 550, max: 750 }),
    //       )
    //     }
    //   }

    //   if (artifacts.pdf) {
    //     const fileChooserPromise = page.waitForEvent("filechooser")
    //     await page
    //       .getByTestId(`${dataTestId}-instruction-artifacts-upload-button`)
    //       .click()
    //     const testUsedPaths = Array.from({ length: artifacts.pdf }, (_, i) => {
    //       const fileType = "pdf"
    //       const fileName = `test${capitalizeFirstLetter(fileType)}${i + 1}`
    //       const extension = "pdf"

    //       return path.join(
    //         process.cwd(),
    //         "src/shared",
    //         fileType,
    //         `${fileName}.${extension}`,
    //       )
    //     })

    //     const fileChooser = await fileChooserPromise
    //     await fileChooser.setFiles(testUsedPaths)
    //   }

    //   if ((artifacts.pdf || 0) + (artifacts.paste || 0) > 10) {
    //     await expect(page.getByText("Maximum 10 files allowed")).toBeVisible()
    //   }

    //   const modalSaveButton = page.getByTestId(
    //     `${dataTestId}-instruction-modal-save-button`,
    //   )
    //   await expect(modalSaveButton).toBeVisible()

    //   await modalSaveButton.click()

    //   await wait(10000)

    //   const modalCloseButton = page.getByTestId(
    //     `${dataTestId}-instruction-modal-close-button`,
    //   )
    //   await expect(modalCloseButton).toBeVisible()

    //   await modalCloseButton.click()
    // }

    if (!prompt.stop) {
      await expect(likeButton).toBeVisible({
        timeout: prompt.agentMessageTimeout || agentMessageTimeout,
      })
      const dislikeButton = (await getLastAgentMessage()).locator(
        "[data-testid=dislike-button]",
      )

      await expect(dislikeButton).toBeVisible({
        timeout: prompt.agentMessageTimeout || agentMessageTimeout,
      })

      const getFilterLikedButton = ({ liked }: { liked: boolean }) =>
        page.getByTestId(`${liked ? "unfilter" : "filter"}-liked-button`)
      await expect(getFilterLikedButton({ liked: false })).toBeVisible({
        timeout: 10000,
      })

      if (prompt.like) {
        await getFilterLikedButton({ liked: false }).click()

        await expect(await getLastAgentMessage()).not.toBeVisible({
          timeout: 8000,
        })

        await getFilterLikedButton({ liked: true }).click()

        await expect(await getLastAgentMessage()).toBeVisible({
          timeout: 8000,
        })

        await likeButton.click()
        await wait(4000)

        await getFilterLikedButton({ liked: false }).click()

        const unlikeButton = (await getLastAgentMessage()).locator(
          "[data-testid=unlike-button]",
        )

        await expect(unlikeButton).toBeVisible({
          timeout: 8000,
        })

        await unlikeButton.click()

        await expect(await getLastAgentMessage()).not.toBeVisible({
          timeout: 8000,
        })

        await getFilterLikedButton({ liked: true }).click()

        await expect(await getLastAgentMessage()).toBeVisible({
          timeout: 8000,
        })

        await getFilterLikedButton({ liked: false }).click()

        await expect(await getLastAgentMessage()).not.toBeVisible({
          timeout: 8000,
        })

        await getFilterLikedButton({ liked: true }).click()
        await wait(4000)
      }
      // // Verify delete button is visible

      if (prompt.model) {
        credits -= getModelCredits(prompt.model)

        if (prompt.debateAgent) {
          credits -= getModelCredits(prompt.debateAgent)
        }
      }

      // Increment hourly usage counter

      // Check if hourly limit info should be visible based on actual component logic
      // Component shows hourly limit when: hourlyUsageLeft < (selectedAgent?.creditCost || 0) * 3
      const hourlyLimitInfo = page.getByTestId("hourly-limit-info")

      // await expect(hourlyLimitInfo).toBeVisible({
      //   visible: 30 - hourlyUsage <= 10,
      // })
      // Try to get the hourly limit info visibility state from the DOM

      if (hourlyLimit - hourlyUsage === 0) {
        willFail = true
        return
      }

      const hourlyUsageLeft = await getHourlyUsageLeft()
      expect(hourlyUsageLeft).toBe((hourlyLimit - hourlyUsage).toString())

      // Assert appropriate values based on what's visible

      // When credits are shown, assert the credits left value
      const creditsLeft = await getCreditsLeft()
      if (creditsLeft !== null) {
        expect(creditsLeft).toBe(credits.toString())
        console.log(
          `✅ Credits assertion: ${creditsLeft} left (expected: ${credits})`,
        )
      }

      if (prompt.model === "flux") {
        const imageGenerationButton = page.getByTestId(
          "image-generation-button",
        )

        // First click: Toggle off image generation
        await imageGenerationButton.click()

        // Wait for agent to change away from flux
        await expect.poll(getAgentName, { timeout: 5000 }).not.toBe("flux")

        // Verify agent changed to expected default
        const expectedDefaultAgent = "sushi"
        expect(await getAgentName()).toBe(expectedDefaultAgent)

        // Second click: Toggle image generation back on
        await imageGenerationButton.click()

        // Wait for agent to change back to flux
        await expect.poll(getAgentName, { timeout: 5000 }).toBe("flux")
        await imageGenerationButton.click()
        await page.waitForTimeout(2000)
        expect(await getAgentName()).toBe(expectedDefaultAgent)
      }
    }

    if (prompt.delete) {
      await deleteMessageButton.click()
      await wait(200)
      await deleteMessageButton.click()
      await wait(4000)
      await expect(deleteMessageButton).not.toBeVisible()
    }
  }

  const getNthMenuThread = async (nth: number) => {
    const threads = page.getByTestId("menu-thread-item")
    return threads.nth(nth)
  }

  const getFirstMenuThread = async () => {
    return getNthMenuThread(0)
  }

  if (bookmark) {
    ;(await getFirstMenuThread()).hover()

    const bookmarkButton = page.getByTestId("thread-not-bookmarked")
    await expect(bookmarkButton).toBeVisible()

    await bookmarkButton.click()

    const menuBookmarked = page.getByTestId("menu-bookmarked")
    await expect(menuBookmarked).toBeVisible({
      timeout: 10000,
    })

    await menuBookmarked.click()

    const threadNotBookmarked = page.getByTestId("thread-not-bookmarked")
    await expect(threadNotBookmarked).toBeVisible({
      timeout: 10000,
    })
    ;(await getFirstMenuThread()).hover()
    const menuNotBookmarked = page.getByTestId("menu-not-bookmarked")
    await expect(menuNotBookmarked).toBeVisible()

    await threadNotBookmarked.click()
    await wait(2000)
  }

  if (isNewChat) {
    await page.getByTestId("new-chat-button").click()
    await wait(5000)

    await expect(
      isMember
        ? page.getByTestId("user-message")
        : page.getByTestId("guest-message"),
    ).not.toBeVisible({
      timeout: 5000,
    })

    // page.close()
  }
}
