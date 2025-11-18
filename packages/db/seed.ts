import {
  createAiAgent,
  createCollaboration,
  createUser,
  db,
  passwordToSalt,
  updateThread,
  getUser,
  getApp,
  createThread,
  createMessage,
  TEST_MEMBER_FINGERPRINTS,
  getUsers,
  updateUser,
  getGuests,
  updateGuest,
  getGuest,
  deleteGuest,
  getTasks,
} from "./index"
import { eq, and, isNull, sql, inArray } from "drizzle-orm"
import {
  users,
  messages,
  guests,
  aiAgents,
  systemLogs,
  subscriptions,
  threads,
  memories,
  characterProfiles,
  threadSummaries,
  calendarEvents,
  stores,
  apps,
  instructions,
  storeInstalls,
} from "./src/schema"

import { createEvent } from "./createEvent"
import { createStores } from "./createStores"

const isProd = process.env.DB_URL && !process.env.DB_URL.includes("localhost")

const now = new Date()
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

const clearDb = async (): Promise<void> => {
  if (isProd) {
    return
  }
  console.log("Clearing database")
  await db.delete(calendarEvents)
  await db.delete(aiAgents)
  await db.delete(messages)
  await db.delete(guests)
  await db.delete(users)
  await db.delete(systemLogs)
  await db.delete(subscriptions)
  await db.delete(threads)
  await db.delete(memories)
  await db.delete(calendarEvents)
  await db.delete(stores)
  await db.delete(apps)
  // await db.delete(cities)
  await db.delete(characterProfiles)
  await db.delete(threadSummaries)
}

const VEX_TEST_EMAIL = process.env.VEX_TEST_EMAIL!
const VEX_TEST_NAME = process.env.VEX_TEST_NAME!
const VEX_TEST_PASSWORD = process.env.VEX_TEST_PASSWORD!

const VEX_TEST_EMAIL_2 = process.env.VEX_TEST_EMAIL_2!
const VEX_TEST_NAME_2 = process.env.VEX_TEST_NAME_2!
const VEX_TEST_PASSWORD_2 = process.env.VEX_TEST_PASSWORD_2!

const VEX_TEST_EMAIL_3 = process.env.VEX_TEST_EMAIL_3!
const VEX_TEST_NAME_3 = process.env.VEX_TEST_NAME_3!
const VEX_TEST_PASSWORD_3 = process.env.VEX_TEST_PASSWORD_3!

const VEX_TEST_EMAIL_4 = process.env.VEX_TEST_EMAIL_4!
const VEX_TEST_NAME_4 = process.env.VEX_TEST_NAME_4!
const VEX_TEST_PASSWORD_4 = process.env.VEX_TEST_PASSWORD_4!

async function clearGuests() {
  const batchSize = 500
  let totalDeleted = 0
  let hasMore = true

  while (hasMore) {
    // Find inactive guests (no subscription, no messages, no tasks)
    const inactiveGuests = await db
      .select({ id: guests.id, ip: guests.ip })
      .from(guests)
      .leftJoin(subscriptions, eq(subscriptions.guestId, guests.id))
      .leftJoin(messages, eq(messages.guestId, guests.id))
      .leftJoin(sql`task`, sql`task."guestId" = ${guests.id}`)
      .where(
        and(
          isNull(subscriptions.id),
          isNull(messages.id),
          sql`task.id IS NULL`,
        ),
      )
      .groupBy(guests.id, guests.ip)
      .limit(batchSize)

    if (inactiveGuests.length === 0) {
      hasMore = false
      break
    }

    // Delete batch
    const idsToDelete = inactiveGuests.map((g) => g.id)
    await db.delete(guests).where(inArray(guests.id, idsToDelete))

    totalDeleted += inactiveGuests.length
    console.log(
      `🧹 Deleted batch of ${inactiveGuests.length} guests (total: ${totalDeleted})`,
    )

    // Show some IPs from this batch
    inactiveGuests.slice(0, 5).forEach((guest) => {
      console.log(`  - ${guest.ip}`)
    })

    if (inactiveGuests.length < batchSize) {
      hasMore = false
    }
  }

  console.log(
    `✅ Cleanup complete! Deleted ${totalDeleted} inactive bot guests`,
  )
}

const create = async () => {
  if (isProd) {
    return
  }

  console.log("🌍 Creating cities...")
  console.log("✅ Cities created")

  // Check if admin user already exists
  let admin = await getUser({ email: VEX_TEST_EMAIL })

  if (!admin) {
    console.log("👤 Creating admin user...")
    admin = await createUser({
      email: VEX_TEST_EMAIL,
      name: VEX_TEST_NAME,
      password: passwordToSalt(VEX_TEST_PASSWORD),
      role: "admin",
      userName: "ibsukru",
      credits: 99999999,
      city: "Amsterdam",
      country: "Netherlands",
    })
    if (!admin) throw new Error("Failed to add admin")
    console.log("✅ Admin user created")
  } else {
    console.log("✅ Admin user already exists, skipping creation")
  }

  const { vex } = await createStores({ user: admin })

  await createAiAgent({
    name: "chatGPT",
    displayName: "GPT-4.1",
    version: "4.1",
    apiURL: "https://api.openai.com/v1/chat/completions",
    state: "active",
    description: "Versatile, creative, and reliable language model.",
    creditCost: 4,
    authorization: "user",
    maxPromptSize: 128000,
    modelId: "gpt-4.1",
    order: 1,
    capabilities: {
      text: true,
      image: true,
      audio: true,
      video: true,
      webSearch: false,
      pdf: true,
      imageGeneration: false,
    },
  })

  await createAiAgent({
    name: "claude",
    displayName: "Claude Sonnet 4",
    version: "4",
    apiURL: "https://api.anthropic.com/v1/messages",
    state: "active",
    description: "Helpful, safe, and human-like conversational AI",
    creditCost: 3,
    authorization: "user",
    modelId: "claude-sonnet-4-20250514",
    maxPromptSize: 200000,
    order: 0,
    capabilities: {
      text: true,
      image: true,
      audio: true,
      video: true,
      webSearch: false,
      pdf: true,
      imageGeneration: false,
    },
  })

  await createAiAgent({
    name: "deepSeek",
    displayName: "DeepSeek V3",
    version: "3.0.0",
    apiURL: "https://api.deepseek.com/v1",
    description: "Fast, accurate, and privacy-focused AI assistant.",
    state: "active",
    creditCost: 1,
    authorization: "all",
    modelId: "deepseek-chat",
    maxPromptSize: 128000,
    order: 4,
    capabilities: {
      text: true,
      image: false,
      audio: false,
      video: false,
      webSearch: false,
      pdf: true,
      imageGeneration: false,
    },
  })

  const sushiAgent = await createAiAgent({
    name: "sushi",
    displayName: "Sushi 1.0",
    version: "1.0.0",
    apiURL: "https://api.deepseek.com/v1",
    description:
      "🍣 Unified multimodal AI with advanced reasoning. Shows its thinking process, analyzes images/videos/PDFs. Powered by DeepSeek R1. Use palette icon for image generation.",
    state: "active",
    creditCost: 2,
    authorization: "all",
    modelId: "deepseek-reasoner", // Advanced reasoning model with visible thinking
    maxPromptSize: 128000,
    order: 5,
    capabilities: {
      text: true,
      image: true,
      audio: true,
      video: true,
      webSearch: false,
      pdf: true,
      imageGeneration: true, // Available via UI palette icon
    },
  })

  await createAiAgent({
    name: "gemini",
    displayName: "Gemini 2.5 Pro",
    version: "2.5",
    apiURL:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent",
    state: "active",
    description: "Fast, efficient, and great for quick answers.",
    creditCost: 2,
    authorization: "user",
    modelId: "gemini-2.5-pro",
    maxPromptSize: 1000000,
    order: 2,
    capabilities: {
      text: true,
      image: true,
      audio: true,
      video: true,
      webSearch: false,
      pdf: true,
      imageGeneration: false,
    },
  })

  await createAiAgent({
    name: "perplexity",
    displayName: "Perplexity Sonar",
    version: "1.1",
    apiURL: "https://api.perplexity.ai/chat/completions",
    state: "active",
    description: "Real-time web search with citations.",
    creditCost: 3, // Lower cost than sonar-pro
    authorization: "guest",
    modelId: "sonar-pro", // keep 'sonar-pro' if you want the best quality
    maxPromptSize: 28000,
    order: 3,
    capabilities: {
      text: true,
      image: false,
      audio: false,
      video: false,
      webSearch: true,
      pdf: false,
      imageGeneration: false,
    },
  })

  await createAiAgent({
    name: "flux",
    displayName: "Flux Schnell",
    version: "1.0",
    apiURL: "https://api.replicate.com/v1/predictions",
    state: "active",
    description: "Create stunning visuals from text prompts.",
    creditCost: 2, // Hybrid DeepSeek + Flux Schnell
    authorization: "guest",
    modelId: "black-forest-labs/flux-schnell",
    order: 5,
    maxPromptSize: 4000,
    capabilities: {
      text: false,
      image: false,
      audio: false,
      video: false,
      webSearch: false,
      pdf: false,
      imageGeneration: true,
    },
  })

  if (!sushiAgent) throw new Error("Failed to add agent")

  await createEvent({ user: admin })

  // Check if feedback user already exists
  let feedback = await getUser({ email: VEX_TEST_EMAIL_2 })

  if (!feedback) {
    console.log("👤 Creating feedback user...")
    feedback = await createUser({
      email: VEX_TEST_EMAIL_2,
      name: VEX_TEST_NAME_2,
      password: passwordToSalt(VEX_TEST_PASSWORD_2),
      role: "user",
      userName: VEX_TEST_NAME_2,
      fingerprint: TEST_MEMBER_FINGERPRINTS[0],
    })
    if (!feedback) throw new Error("Failed to add user")
    console.log("✅ Feedback user created")
  } else {
    console.log("✅ Feedback user already exists, skipping creation")
  }

  // Check if diplomatic user already exists
  let diplomatic = await getUser({ email: VEX_TEST_EMAIL_3 })

  if (!diplomatic) {
    console.log("👤 Creating diplomatic user...")
    diplomatic = await createUser({
      email: VEX_TEST_EMAIL_3,
      name: VEX_TEST_NAME_3,
      password: passwordToSalt(VEX_TEST_PASSWORD_3),
      role: "user",
      userName: VEX_TEST_NAME_3,
      fingerprint: TEST_MEMBER_FINGERPRINTS[1],
    })
    if (!diplomatic) throw new Error("Failed to add user")
    console.log("✅ Diplomatic user created")
  } else {
    console.log("✅ Diplomatic user already exists, skipping creation")
  }

  // Check if localswaphub user already exists
  let localswaphub = await getUser({ email: VEX_TEST_EMAIL_4 })

  if (!localswaphub) {
    console.log("👤 Creating localswaphub user...")
    localswaphub = await createUser({
      email: VEX_TEST_EMAIL_4,
      name: VEX_TEST_NAME_4,
      password: passwordToSalt(VEX_TEST_PASSWORD_4),
      role: "user",
      userName: VEX_TEST_NAME_4,
      fingerprint: TEST_MEMBER_FINGERPRINTS[2],
    })
    if (!localswaphub) throw new Error("Failed to add user")
    console.log("✅ Localswaphub user created")
  } else {
    console.log("✅ Localswaphub user already exists, skipping creation")
  }
  // const createdUsers = await Promise.all([admin, feedback])

  // --- BEGIN meaningful threads/messages/AI agent seeding ---

  for (const adminUser of [admin]) {
    const foo = true || process.env.TESTING_ENV === "e2e"
    if (foo) return

    // Pool of user prompts and AI responses
    const prompts = [
      "What is the weather like in Paris today?",
      "Explain the concept of relativity.",
      "How do I reset my password?",
      "Tell me a joke.",
      "Summarize the latest news in AI.",
      "What's the capital of Australia?",
      "How does photosynthesis work?",
      "Translate 'good morning' to Spanish.",
      "What's the best way to learn TypeScript?",
      "Who won the World Cup in 2018?",
      "How do I make a perfect omelette?",
      "What are the health benefits of yoga?",
      "Define the term 'blockchain'.",
      "What is quantum computing?",
      "Give me a fun fact about cats.",
      "How do airplanes fly?",
      "What is the Fibonacci sequence?",
      "Tips for staying productive when working remotely?",
      "What's the distance from Earth to Mars?",
      "How do I improve my public speaking skills?",
    ]
    const responses = [
      "The weather in Paris today is mostly sunny with a high of 24°C.",
      "Relativity is a theory by Einstein that explains how space and time are linked for objects moving at a constant speed.",
      "To reset your password, click on 'Forgot password' on the login page and follow the instructions.",
      "Why did the computer show up at work late? It had a hard drive!",
      "Recent AI news: OpenAI released a new model that can generate images from text.",
      "The capital of Australia is Canberra.",
      "Photosynthesis is the process by which green plants use sunlight to synthesize food from carbon dioxide and water.",
      "'Good morning' in Spanish is 'Buenos días'.",
      "Practice regularly, use official docs, and build small projects to learn TypeScript effectively.",
      "France won the FIFA World Cup in 2018.",
      "Whisk eggs, add a pinch of salt, cook on medium heat, and fold gently for a perfect omelette.",
      "Yoga improves flexibility, reduces stress, and boosts overall well-being.",
      "Blockchain is a distributed digital ledger that records transactions across many computers securely.",
      "Quantum computing uses quantum bits to perform computations much faster for certain problems.",
      "Cats have five toes on their front paws, but only four on the back!",
      "Airplanes fly due to the lift generated by their wings as air flows over them.",
      "The Fibonacci sequence is a series where each number is the sum of the two preceding ones.",
      "Set boundaries, take breaks, and use task lists to stay productive when working remotely.",
      "The average distance from Earth to Mars is about 225 million kilometers.",
      "Practice regularly, record yourself, and get feedback to improve public speaking skills.",
    ]

    // --- JSON-like structure for multi-turn threads ---
    const THREAD_COUNT = 50
    const MESSAGES_PER_THREAD = 50
    const threadsData = Array.from({ length: THREAD_COUNT }).map((_, t) => {
      const usedIndexes = new Set<number>()
      const messages: { role: "user" | "ai"; content: string }[] = []
      // For the first 5 threads, ensure at least 50 messages (25 user/ai pairs)
      const messagePairs =
        t < 5 ? MESSAGES_PER_THREAD / 2 : Math.ceil(prompts.length / 2)
      for (let c = 0; c < messagePairs; c++) {
        // Cycle through prompts/responses for variety
        const idx = (c + t * messagePairs) % prompts.length
        const userText = prompts[idx] ?? `Prompt ${idx}`
        const agentText = responses[idx] ?? `Response ${idx}`
        messages.push(
          { role: "user", content: userText },
          { role: "ai", content: agentText },
        )
      }
      // Use the first user message as the thread title
      return {
        title: messages[0]?.content || `Thread ${t + 1}`,
        messages,
      }
    })

    // --- Seed threads and messages from JSON-like structure ---

    const oneHourAgo = new Date(now.getTime() - 60 * 600 * 1000)
    const timePerThread = (600 * 60 * 1000) / THREAD_COUNT

    // Then for each thread:

    for (let t = 0; t < threadsData.length; t++) {
      const threadDatum = threadsData[t]
      if (!threadDatum) throw new Error(`Missing thread data at index ${t}`)
      if (!adminUser.id) throw new Error("Admin user has no id")

      const threadStartTime = new Date(oneHourAgo.getTime() - t * timePerThread)
      let lastMessageTime = new Date(threadStartTime)

      const thread = await createThread({
        userId: adminUser.id as string,
        title: threadDatum.title as string,
        aiResponse: threadDatum.messages[1]?.content as string,
        createdOn: lastMessageTime,
        updatedOn: lastMessageTime,
        appId: vex.id,
      })

      if (!thread || !thread.id) throw new Error("Failed to create thread")

      for (const msg of threadDatum.messages) {
        if (msg.role === "user") {
          const userMessage = await createMessage({
            userId: adminUser.id as string,
            threadId: thread.id as string,
            content: msg.content as string,
            createdOn: lastMessageTime,
            updatedOn: lastMessageTime,
          })
          if (!userMessage) throw new Error("Failed to create user message")
        } else {
          if (!sushiAgent.id) throw new Error("Agent has no id")
          const agentMessage = await createMessage({
            threadId: thread.id as string,
            agentId: sushiAgent.id as string,
            userId: adminUser.id as string,
            content: msg.content as string,
            createdOn: lastMessageTime,
            updatedOn: lastMessageTime,
          })
          if (!agentMessage) throw new Error("Failed to create agent message")
        }
        lastMessageTime = new Date(lastMessageTime.getTime() + 120000) // 2 minutes
      }
      console.log(
        `Seeded thread ${t + 1} with ${threadDatum.messages.length} messages`,
      )
    }
    // --- END meaningful threads/messages/AI agent seeding ---

    const thread = await createThread({
      userId: localswaphub.id as string,
      title: "Test Collaboration Thread",
      aiResponse: "Test Collaboration AI Response",
    })

    if (!thread) throw new Error("Failed to create thread")

    {
      const message = await createMessage({
        threadId: thread.id,
        agentId: sushiAgent.id,
        userId: localswaphub.id,
        content: "Test Collaboration User Message",
        // createdOn: new Date(lastMessageTime),
        // updatedOn: new Date(lastMessageTime),
      })

      if (!message) throw new Error("Failed to create message")

      const collaboration = await createCollaboration({
        threadId: thread.id,
        userId: admin.id,
        status: "pending",
      })

      if (!collaboration) throw new Error("Failed to create collaboration")
    }
    const publicThread = await createThread({
      userId: localswaphub.id,
      title: "Test Public Thread",
      aiResponse: "Test Public AI Response",
      visibility: "public",
    })

    if (!publicThread) throw new Error("Failed to create public thread")

    {
      const message = await createMessage({
        threadId: publicThread.id,
        agentId: sushiAgent.id,
        userId: localswaphub.id,
        content: "Test Public User Message",
        // createdOn: new Date(lastMessageTime),
        // updatedOn: new Date(lastMessageTime),
      })

      if (!message) throw new Error("Failed to create message")
    }

    await updateThread({
      ...publicThread,
      bookmarks: [
        {
          userId: admin.id,
          createdOn: new Date().toISOString(),
        },
      ],
    })

    // const guest = await createGuest({
    //   ip: "192.168.2.27",
    //   credits: 5000,
    //   activeOn: new Date(),
    //   createdOn: new Date(),
    //   updatedOn: new Date(),
    //   fingerprint: uuid(),
    // })
  }

  // if (!guest) throw new Error("Failed to add guest")

  // console.log("Guest created:", guest.ip)
}

const prod = async () => {
  // Check if admin user already exists
  let admin = await getUser({ email: VEX_TEST_EMAIL })
  if (!admin) throw new Error("Admin user not found")
  // Delete inactive bot guests in batches
  // await clearGuests()
  const vex = await createStores({ user: admin, isProd: true })
  // const allInstructions = await db.select().from(instructions)
  // const seen = new Map<string, string>() // Map of unique key -> instruction ID
  // const duplicateIds: string[] = []
  // for (const instruction of allInstructions) {
  //   // Create unique key based on userId/guestId + appId + title + content
  //   const key = `${instruction.userId || ""}-${instruction.guestId || ""}-${instruction.appId || ""}-${instruction.title}-${instruction.content}`
  //   if (
  //     // instruction.title === "Plan afternoon trip under €1000 💰" &&
  //     instruction.userId === admin.id
  //   ) {
  //     console.log("my in.", instruction)
  //   }
  //   // if (seen.has(key)) {
  //   //   // This is a duplicate, mark for deletion
  //   //   duplicateIds.push(instruction.id)
  //   //   console.log(
  //   //     `  ❌ Duplicate found: "${instruction.title}" (ID: ${instruction.id})`,
  //   //   )
  //   // } else {
  //   //   seen.set(key, instruction.id)
  //   // }
  // }
  // if (duplicateIds.length > 0) {
  //   console.log(`🗑️  Removing ${duplicateIds.length} duplicate instructions...`)
  //   for (const id of duplicateIds) {
  //     // await db.delete(instructions).where(eq(instructions.id, id))
  //   }
  //   console.log(`✅ Removed ${duplicateIds.length} duplicate instructions`)
  // } else {
  //   console.log("✅ No duplicate instructions found")
}

// const vex = await createStores({ user: admin })
// const me = await getUser({ email: "ibsukru@gmail.com" })
// if (!me) {
//   throw new Error("Failed user not found")
// }
// const calendarEvents = await getCalendarEvents({
//   userId: me.id,
// })
// for (const element of calendarEvents) {
//   await deleteCalendarEvent({ id: element.id })
// }
// await createEvent({ user: me })
// return
// const guests = await getGuests({
//   pageSize: 1000000,
// })
// for (const guest of guests.guests) {
//   const threadCount = (await getThreads({ pageSize: 1, guestId: guest.id }))
//     .totalCount
//   const oneWeekAgo = new Date()
//   oneWeekAgo.setDate(oneWeekAgo.getDate() - 3)
//   if (
//     // guest.ip === "10.8.0.2"
//     // guest.credits === GUEST_CREDITS_PER_MONTH &&
//     // guest.activeOn < oneWeekAgo &&
//     // threadCount === 0
//     guest.favouriteAgent === "perplexity"
//   ) {
//     await updateGuest({
//       ...guest,
//       favouriteAgent: "deepSeek",
//     })
//     // await deleteGuest({ id: guest.id })
//     console.log(
//       `Guest ${guest.id} has ${threadCount} threads (inactive since ${guest.activeOn})`,
//     )
//   }
// }

const seedDb = async (): Promise<void> => {
  // await prod()
  // process.exit(0)
  if (isProd) {
    // eslint-disable-next-line no-console
    console.warn(
      "\n⚠️  WARNING: You are about to run the seed script on a NON-LOCAL database!\n" +
        `DB_URL: ${process.env.DB_URL}\n` +
        "Press Enter to continue, or Ctrl+C to abort.",
    )

    await new Promise<void>((resolve) => {
      process.stdin.resume()
      process.stdin.once("data", () => resolve())
    })
  }

  if (isProd) {
    await prod()
    process.exit(0)
  } else {
    await clearDb()

    await create()
    process.exit(0)
  }
  // await updateInvalidDates()
  // process.exit(0)
}

seedDb()
