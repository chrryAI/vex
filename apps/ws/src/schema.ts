import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import type { AdapterAccount } from "@auth/core/adapters"
import { sql } from "drizzle-orm"

export const PLUS_CREDITS_PER_MONTH = 2000
export const ADDITIONAL_CREDITS = 2500
export const GUEST_CREDITS_PER_MONTH = 30
export const MEMBER_CREDITS_PER_MONTH = 150
export const MAX_INSTRUCTIONS_CHAR_COUNT = 7500
export const MAX_THREAD_TITLE_CHAR_COUNT = 100

export const PROMPT_LIMITS = {
  INPUT: 7000, // Max for direct input
  INSTRUCTIONS: 2000, // Max for instructions
  TOTAL: 30000, // Combined max (input + context)
  WARNING_THRESHOLD: 5000, // Show warning at this length
  THREAD_TITLE: 100,
}

export const users = pgTable(
  "user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("emailVerified", {
      mode: "date",
      withTimezone: true,
    }),
    image: text("image"),
    password: text("password"),
    role: text("role", { enum: ["admin", "user"] })
      .notNull()
      .default("user"),
    theme: text("theme", { enum: ["light", "dark", "system"] })
      .notNull()
      .default("system"),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    activeOn: timestamp("activeOn", {
      mode: "date",
      withTimezone: true,
    }).defaultNow(),
    ip: text("ip"),
    language: text("language", {
      enum: ["en", "de", "es", "fr", "ja", "ko", "pt", "zh", "nl", "tr"],
    })
      .notNull()
      .default("en"),
    fingerprint: text("fingerprint"),
    isOnline: boolean("isOnline").default(false),
    subscribedOn: timestamp("subscribedOn", {
      mode: "date",
      withTimezone: true,
    }),
    userName: text("userName").notNull(),
    fileUploadsToday: integer("fileUploadsToday").default(0).notNull(),
    fileUploadsThisHour: integer("fileUploadsThisHour").default(0).notNull(),
    totalFileSizeToday: integer("totalFileSizeToday").default(0).notNull(),
    lastFileUploadReset: timestamp("lastFileUploadReset", {
      mode: "date",
      withTimezone: true,
    }),

    country: text("country"),
    city: text("city"),

    speechRequestsToday: integer("speechRequestsToday").default(0).notNull(),
    speechRequestsThisHour: integer("speechRequestsThisHour")
      .default(0)
      .notNull(),
    speechCharactersToday: integer("speechCharactersToday")
      .default(0)
      .notNull(),
    lastSpeechReset: timestamp("lastSpeechReset", {
      mode: "date",
      withTimezone: true,
    }),

    characterProfilesEnabled: boolean("characterProfilesEnabled").default(
      false,
    ),
    memoriesEnabled: boolean("memoriesEnabled").default(true),
    suggestions: jsonb("suggestions").$type<{
      instructions: Array<{
        id: string
        title: string
        emoji: string
        content: string
        confidence: number
        generatedAt: string
        requiresWebSearch?: boolean
      }>
      lastGenerated?: string
    }>(),

    weather: jsonb("weather").$type<{
      location: string
      country: string
      temperature: string
      condition: string
      code: number
      createdOn: Date
      lastUpdated: Date
    }>(),

    imagesGeneratedToday: integer("imagesGeneratedToday").default(0).notNull(),
    lastImageGenerationReset: timestamp("lastImageGenerationReset", {
      mode: "date",
      withTimezone: true,
    }),
    favouriteAgent: text("favouriteAgent").notNull().default("sushi"),
    timezone: text("timezone"),
    appleId: text("appleId"),
    migratedFromGuest: boolean("migratedFromGuest").default(false).notNull(),
    credits: integer("credits").default(MEMBER_CREDITS_PER_MONTH).notNull(),
  },
  (table) => [
    uniqueIndex("user_name_idx").on(table.userName),
    uniqueIndex("user_email_idx").on(table.email),
    index("user_search_index").using(
      "gin",
      sql`(
      setweight(to_tsvector('english', ${table.name}), 'A') ||
      setweight(to_tsvector('english', ${table.email}), 'B')
  )`,
    ),
  ],
)

export const devices = pgTable(
  "device",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type"),
    app: text("app"),
    os: text("os"),
    osVersion: text("osVersion"),
    screenWidth: integer("screenWidth"),
    screenHeight: integer("screenHeight"),
    language: text("language"),
    timezone: text("timezone"),
    browser: text("browser"),
    browserVersion: text("browserVersion"),
    appVersion: text("appVersion"),
    userId: uuid("userId").references((): AnyPgColumn => users.id, {
      onDelete: "cascade",
    }),
    guestId: uuid("guestId").references((): AnyPgColumn => guests.id, {
      onDelete: "cascade",
    }),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    fingerprint: text("fingerprint").notNull().unique(),
  },
  (table) => [index("device_fingerprint_idx").on(table.fingerprint)],
)

export const subscriptions = pgTable(
  "subscription",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider", {
      enum: ["stripe", "apple", "google"],
    }).notNull(),
    subscriptionId: text("subscriptionId").notNull(),
    sessionId: text("sessionId"),
    status: text("status", {
      enum: ["active", "canceled", "pastDue", "ended", "trialing"],
    }).notNull(),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    plan: text("plan", {
      enum: ["plus", "pro"],
    }).notNull(),
  },
  (table) => [
    {
      // Allow same subscriptionId for guest and user (handles Apple resubscription during guest-to-member transition)
      // But prevent duplicate subscriptionIds within the same provider for same user/guest
      // Use MD5 hash to avoid PostgreSQL btree index row size limit for large Apple subscription IDs
      userProviderSubscriptionIndex: uniqueIndex(
        "subscription_user_provider_hash_idx",
      )
        .on(table.userId, table.provider, sql`md5(${table.subscriptionId})`)
        .where(sql`${table.userId} IS NOT NULL`),
      guestProviderSubscriptionIndex: uniqueIndex(
        "subscription_guest_provider_hash_idx",
      )
        .on(table.guestId, table.provider, sql`md5(${table.subscriptionId})`)
        .where(sql`${table.guestId} IS NOT NULL`),
      // Non-unique indexes for efficient lookups
      userIdIndex: index("subscription_user_idx").on(table.userId),
      guestIdIndex: index("subscription_guest_idx").on(table.guestId),
    },
  ],
)
export const guests = pgTable("guest", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  ip: text("ip").notNull(),
  country: text("country"),
  city: text("city"),
  fingerprint: text("fingerprint").notNull(),
  activeOn: timestamp("activeOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  email: text("email"),

  weather: jsonb("weather").$type<{
    location: string
    country: string
    temperature: string
    condition: string
    code: number
    createdOn: Date
    lastUpdated: Date
  }>(),

  memoriesEnabled: boolean("memoriesEnabled").default(true),

  characterProfilesEnabled: boolean("characterProfilesEnabled").default(false),
  suggestions: jsonb("suggestions").$type<{
    instructions: Array<{
      id: string
      title: string
      emoji: string
      content: string
      confidence: number
      generatedAt: string
    }>
    lastGenerated?: string
  }>(),

  favouriteAgent: text("favouriteAgent").notNull().default("sushi"),

  credits: integer("credits").default(GUEST_CREDITS_PER_MONTH).notNull(),
  isBot: boolean("isBot").default(false).notNull(),
  isOnline: boolean("isOnline").default(false),
  imagesGeneratedToday: integer("imagesGeneratedToday").default(0).notNull(),
  lastImageGenerationReset: timestamp("lastImageGenerationReset", {
    mode: "date",
    withTimezone: true,
  }),

  migratedToUser: boolean("migratedToUser").default(false).notNull(),

  fileUploadsToday: integer("fileUploadsToday").default(0).notNull(),
  fileUploadsThisHour: integer("fileUploadsThisHour").default(0).notNull(),
  totalFileSizeToday: integer("totalFileSizeToday").default(0).notNull(),
  lastFileUploadReset: timestamp("lastFileUploadReset", {
    mode: "date",
    withTimezone: true,
  }),

  subscribedOn: timestamp("subscribedOn", {
    mode: "date",
    withTimezone: true,
  }),

  speechRequestsToday: integer("speechRequestsToday").default(0).notNull(),
  speechRequestsThisHour: integer("speechRequestsThisHour")
    .default(0)
    .notNull(),
  speechCharactersToday: integer("speechCharactersToday").default(0).notNull(),
  lastSpeechReset: timestamp("lastSpeechReset", {
    mode: "date",
    withTimezone: true,
  }),

  timezone: text("timezone"),
})

// export const gifts = pgTable("gifts", {
//   userId: uuid("userId").references((): AnyPgColumn => users.id, {
//     onDelete: "cascade",
//   }),
//   guestId: uuid("guestId").references((): AnyPgColumn => guests.id, {
//     onDelete: "cascade",
//   }),
//   status: text("status", {
//     enum: ["accepted", "pending"],
//   }).default("pending"),
//   createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
//     .defaultNow()
//     .notNull(),
//   updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
//     .defaultNow()
//     .notNull(),

//   fromUserId: uuid("fromGuestId").references((): AnyPgColumn => users.id, {
//     onDelete: "set null",
//   }),
//   fromGuestId: uuid("fromGuestId").references((): AnyPgColumn => guests.id, {
//     onDelete: "set null",
//   }),
// })

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
)

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").notNull().primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
})

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
)

export const threads = pgTable("threads", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guestId").references(() => guests.id, { onDelete: "cascade" }),
  createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  taskId: uuid("taskId").references(() => tasks.id, { onDelete: "cascade" }),
  updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  title: text("title").notNull(),
  aiResponse: text("aiResponse").notNull(),
  isIncognito: boolean("isIncognito").notNull().default(false),
  star: integer("star"),
  bookmarks: jsonb("bookmarks")
    .$type<
      {
        userId?: string
        guestId?: string
        createdOn: string
      }[]
    >()
    .default([]),

  isMainThread: boolean("isMainThread").notNull().default(false),

  appId: uuid("appId").references(() => apps.id, {
    onDelete: "set null",
  }),
  metadata: jsonb("metadata").$type<{}>().default({}),
  instructions: text("instructions"),
  visibility: text("visibility", {
    enum: ["private", "protected", "public"],
  })
    .notNull()
    .default("private"),
  artifacts: jsonb("artifacts").$type<
    {
      type: string
      url?: string
      name: string
      size: number
      data?: string
      id: string
    }[]
  >(),
})

export const pushSubscriptions = pgTable("pushSubscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guestId").references(() => guests.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
})

export type collaborationStatus = "active" | "pending" | "revoked" | "rejected"

export const collaborations = pgTable("collaborations", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  threadId: uuid("threadId")
    .references(() => threads.id, {
      onDelete: "cascade",
    })
    .notNull(),
  role: text("role", {
    enum: ["owner", "collaborator"],
  })
    .notNull()
    .default("collaborator"),
  userId: uuid("userId")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),

  activeOn: timestamp("activeOn", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),

  status: text("status", {
    enum: ["active", "pending", "revoked", "rejected"],
  }).default("active"),
  isOnline: boolean("isOnline").default(false),
  isTyping: boolean("isTyping").default(false),
  lastTypedOn: timestamp("lastTypedOn", { mode: "date", withTimezone: true }),
  expiresOn: timestamp("expiresOn", { mode: "date", withTimezone: true }),
})

export const aiAgents = pgTable("aiAgents", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  name: text("name").notNull(),
  displayName: text("displayName").notNull(),
  version: text("version").notNull(),
  apiURL: text("apiURL").notNull(),
  description: text("description"),
  state: text("state", { enum: ["active", "testing", "inactive"] })
    .notNull()
    .default("active"),
  creditCost: integer("creditCost").notNull().default(1),
  modelId: text("modelId").notNull(),
  order: integer("order").notNull().default(0),
  maxPromptSize: integer("maxPromptSize").default(PROMPT_LIMITS.INPUT),
  capabilities: jsonb("capabilities")
    .$type<{
      text: boolean
      image: boolean
      audio: boolean
      video: boolean
      webSearch: boolean
      imageGeneration: boolean
      codeExecution?: boolean
      pdf: boolean
    }>()
    .notNull()
    .default({
      text: true,
      image: false,
      audio: false,
      video: false,
      webSearch: false,
      imageGeneration: false,
      codeExecution: false,
      pdf: false,
    }),
  authorization: text("authorization", {
    enum: ["user", "subscriber", "guest", "all"],
  })
    .notNull()
    .default("all"),
})

export type webSearchResultType = {
  title: string
  url: string
  snippet: string
}

export type taskAnalysis = {
  type: "chat" | "automation" | "booking" | "summary" | "scraping"
  creditMultiplier: number
  estimatedTokens: number
  confidence: number
}

export type modelName =
  | "chatGPT"
  | "claude"
  | "deepSeek"
  | "gemini"
  | "flux"
  | "sushi"

export const messages = pgTable(
  "messages",
  {
    type: text("type", {
      enum: ["chat", "training", "system", "feedback", "test"],
    })
      .notNull()
      .default("chat"),
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    moodId: uuid("moodId").references(() => moods.id, {
      onDelete: "set null",
    }),
    agentId: uuid("agentId").references(() => aiAgents.id, {
      onDelete: "cascade",
    }),
    debateAgentId: uuid("debateAgentId").references(() => aiAgents.id, {
      onDelete: "set null",
    }),
    pauseDebate: boolean("pauseDebate").notNull().default(false),
    clientId: uuid("clientId").notNull().defaultRandom(),
    selectedAgentId: uuid("selectedAgentId").references(() => aiAgents.id, {
      onDelete: "set null",
    }),
    isWebSearchEnabled: boolean("isWebSearchEnabled").notNull().default(false),
    isImageGenerationEnabled: boolean("isImageGenerationEnabled")
      .notNull()
      .default(false),
    agentVersion: text("agentVersion"),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    originalContent: text("originalContent"),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    readOn: timestamp("readOn", { mode: "date", withTimezone: true }),
    threadId: uuid("threadId")
      .references(() => threads.id, {
        onDelete: "cascade",
      })
      .notNull(),
    metadata: jsonb("metadata")
      .$type<{
        analysis?: taskAnalysis
      }>()
      .default({}),
    task: text("task", {
      enum: ["chat", "automation", "booking", "summary", "scraping"],
    })
      .notNull()
      .default("chat"),
    files: jsonb("files").$type<
      {
        type: string
        url?: string
        name: string
        size: number
        data?: string
        id: string
      }[]
    >(),
    reactions: jsonb("reactions").$type<
      {
        like: boolean
        dislike: boolean
        userId?: string
        guestId?: string
        createdOn: string
      }[]
    >(),
    creditCost: integer("creditCost").notNull().default(1),
    webSearchResult: jsonb("webSearchResult").$type<webSearchResultType[]>(),
    searchContext: text("searchContext"),
    images: jsonb("images").$type<
      {
        url: string
        prompt: string
        model?: string
        width?: number
        height?: number
        title?: string
        id: string
      }[]
    >(),
    audio: jsonb("audio").$type<
      {
        url: string
        size?: number
        title?: string
        id: string
      }[]
    >(),
    video: jsonb("video").$type<
      {
        url: string
        size?: number
        title?: string
        id: string
      }[]
    >(),
  },

  (table) => [
    index("messages_search_index").using(
      "gin",
      sql`(
        setweight(to_tsvector('english', ${table.content}), 'A')
      )`,
    ),
  ],
)

export const apps = pgTable(
  "app",
  {
    storeId: uuid("storeId").references(() => stores.id, {
      onDelete: "cascade",
    }),
    id: uuid("id").defaultRandom().primaryKey(),
    // Creator (null for system apps like Atlas, Bloom, etc.)
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),
    mainThreadId: uuid("mainThreadId").references(
      (): AnyPgColumn => threads.id,
      {
        onDelete: "set null",
      },
    ),
    // team (for team-owned apps)
    teamId: uuid("teamId").references(() => teams.id, {
      onDelete: "cascade",
    }),

    tools: text("tools", {
      enum: ["calendar", "location", "weather"],
    })
      .array()
      .default([]),

    // Basic Info
    name: text("name").notNull(), // Unique identifier (e.g., "Atlas", "my-legal-assistant")
    // displayName: text("displayName").notNull().default("Untitled Agent"), // Display name (e.g., "Atlas", "Legal Assistant")
    title: text("title").notNull().default("Your personal AI agent"), // Short tagline (e.g., "AI Travel Companion")
    subtitle: text("subtitle"), // Subtitle (e.g., "AI Travel Companion")
    description: text("description"), // Full description
    icon: text("icon"), // URL, emoji, or base64 image
    images: jsonb("images").$type<
      {
        url: string
        width?: number
        height?: number
        id: string
      }[]
    >(), // 500x500px PNG image URL (required for published agents)
    slug: text("slug").notNull(), // Auto-generated from displayName

    onlyAgent: boolean("onlyAgent").notNull().default(false),

    // Structured content for app details
    highlights: jsonb("highlights").$type<
      Array<{
        id: string
        title: string
        content?: string
        emoji?: string
        requiresWebSearch?: boolean
        appName?: string
      }>
    >(), // Key features/highlights (e.g., ["Smart Itineraries", "Local Insights", "Weather Integration"])
    featureList: jsonb("featureList").$type<string[]>(), // Simple feature list for display (e.g., ["Smart Matching", "Travel Connections"])

    // Version & Status
    version: text("version").notNull().default("1.0.0"),
    status: text("status", {
      enum: [
        "testing",
        "draft",
        "pending_review",
        "approved",
        "rejected",
        "active",
        "inactive",
      ],
    })
      .notNull()
      .default("draft"),

    // App Store-like review process
    submittedForReviewAt: timestamp("submittedForReviewAt", {
      mode: "date",
      withTimezone: true,
    }),
    reviewedAt: timestamp("reviewedAt", { mode: "date", withTimezone: true }),
    reviewedBy: uuid("reviewedBy").references(() => users.id), // Admin who reviewed
    rejectionReason: text("rejectionReason"),

    // PWA Manifest
    manifestUrl: text("manifestUrl"), // /agents/username/slug/manifest.json
    themeColor: text("themeColor").default("#f87171"),
    backgroundColor: text("backgroundColor").default("#ffffff"),
    displayMode: text("displayMode", {
      enum: ["standalone", "fullscreen", "minimal-ui", "browser"],
    }).default("standalone"),

    // Native App Store Integration
    installType: text("installType", {
      enum: ["pwa", "native", "web", "hybrid"],
    }).default("pwa"), // Type of installation
    appStoreUrl: text("appStoreUrl"), // iOS App Store URL
    playStoreUrl: text("playStoreUrl"), // Google Play Store URL
    bundleId: text("bundleId"), // iOS bundle ID (e.g., com.chrry.app)
    packageName: text("packageName"), // Android package name
    deepLinkScheme: text("deepLinkScheme"), // Deep link scheme (e.g., chrry://)
    isInstallable: boolean("isInstallable").notNull().default(true), // Can be installed

    placeholder: text("placeholder"),
    // Extends system apps OR other custom agents (by UUID)
    extend: jsonb("extend")
      .$type<
        Array<
          "Vex" | "Chrry" | "Atlas" | "Peach" | "Vault" | "Bloom" | string // UUID of custom agent
        >
      >()
      .default([]),

    // Capabilities
    capabilities: jsonb("capabilities")
      .$type<{
        text: boolean
        image: boolean
        audio: boolean
        video: boolean
        webSearch: boolean
        imageGeneration: boolean
        codeExecution: boolean
        pdf: boolean
      }>()
      .default({
        text: true,
        image: true,
        audio: true,
        video: true,
        webSearch: true,
        imageGeneration: true,
        codeExecution: true,
        pdf: true,
      }),

    // Tags for discovery
    tags: text("tags").array().default([]), // ["legal", "contracts", "business"]

    // Personality & Behavior
    systemPrompt: text("systemPrompt"), // Custom instructions
    tone: text("tone", {
      enum: ["professional", "casual", "friendly", "technical", "creative"],
    }).default("professional"),
    language: text("language").default("en"), // Default language

    // Knowledge Base
    knowledgeBase: text("knowledgeBase"), // Custom context/knowledge (simple text)
    ragDocumentIds: text("ragDocumentIds").array().default([]), // IDs of uploaded RAG documents
    ragEnabled: boolean("ragEnabled").notNull().default(false), // Whether to use RAG
    examples:
      jsonb("examples").$type<Array<{ user: string; assistant: string }>>(), // Example conversations

    // Settings
    visibility: text("visibility", {
      enum: ["private", "public", "unlisted"],
    })
      .notNull()
      .default("private"),
    defaultModel: text("defaultModel").default("sushi"), // Default AI model for this app
    temperature: real("temperature").default(0.7),

    // Monetization
    pricing: text("pricing", {
      enum: ["free", "one-time", "subscription"],
    })
      .notNull()
      .default("free"),
    tier: text("tier", {
      enum: ["free", "plus", "pro"],
    })
      .notNull()
      .default("free"), // Subscription tier required to use this app
    price: integer("price").default(0), // Price in cents (e.g., 999 = $9.99)
    currency: text("currency").default("usd"),
    subscriptionInterval: text("subscriptionInterval", {
      enum: ["monthly", "yearly"],
    }), // Only for subscription pricing
    stripeProductId: text("stripeProductId"), // Stripe product ID
    stripePriceId: text("stripePriceId"), // Stripe price ID
    revenueShare: integer("revenueShare").default(70), // Creator gets 70%, Vex gets 30%

    // BYOK (Bring Your Own Key) - Encrypted API keys
    apiKeys: jsonb("apiKeys").$type<{
      openai?: string // Encrypted OpenAI API key
      anthropic?: string // Encrypted Anthropic API key
      google?: string // Encrypted Google API key
      deepseek?: string // Encrypted DeepSeek API key
      perplexity?: string // Encrypted Perplexity API key
      replicate?: string // Encrypted Replicate API key (for Flux)
    }>(), // If provided, app uses creator's keys instead of Vex's

    // Usage Limits (customizable per app)
    // Free tier: User's credits apply + these limits (if set)
    // Plus tier: User's credits apply + these limits (creator pays API)
    // Pro tier: NO credits deducted, only these limits apply (creator pays API)
    limits: jsonb("limits")
      .$type<{
        promptInput?: number // Max input length (default: 7000)
        promptTotal?: number // Max total context (default: 30000)
        speechPerHour?: number // Voice requests per hour (default: 10)
        speechPerDay?: number // Voice requests per day (default: 100)
        speechCharsPerDay?: number // Voice characters per day (default: 10000)
        fileUploadMB?: number // Max file size in MB (default: 30)
        filesPerMessage?: number // Max files per message (default: 10)
        messagesPerHour?: number // Rate limit per hour (default: 50)
        messagesPerDay?: number // Daily message limit (default: 500)
        imageGenerationsPerDay?: number // Image generations per day (default: 20)
      }>()
      .default({}), // Empty object means use system defaults

    // API Access
    apiEnabled: boolean("apiEnabled").notNull().default(false),
    apiPricing: text("apiPricing", {
      enum: ["free", "per-request", "subscription"],
    }).default("per-request"),
    apiPricePerRequest: integer("apiPricePerRequest").default(1), // Price in cents per API call
    apiMonthlyPrice: integer("apiMonthlyPrice").default(0), // Monthly API subscription price
    apiRateLimit: integer("apiRateLimit").default(1000), // Requests per month for free tier
    apiKey: text("apiKey"), // Auto-generated API key for the agent
    apiRequestCount: integer("apiRequestCount").notNull().default(0), // Total API requests
    apiRevenue: integer("apiRevenue").notNull().default(0), // Total API revenue in cents

    // Analytics
    usageCount: integer("usageCount").notNull().default(0),
    likeCount: integer("likeCount").notNull().default(0),
    shareCount: integer("shareCount").notNull().default(0),
    installCount: integer("installCount").notNull().default(0), // How many users added it
    subscriberCount: integer("subscriberCount").notNull().default(0), // Paying subscribers
    totalRevenue: integer("totalRevenue").notNull().default(0), // Total revenue in cents

    // Timestamps
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),

    // Legacy
    features: jsonb("features").$type<{ [key: string]: boolean }>(),
  },
  (table) => [
    {
      // Indexes for efficient queries
      userIdIndex: index("app_user_idx").on(table.userId),
      guestIdIndex: index("app_guest_idx").on(table.guestId),
      visibilityIndex: index("app_visibility_idx").on(table.visibility),
      tagsIndex: index("app_tags_idx").using("gin", table.tags),
      slugIndex: index("app_slug_idx").on(table.slug),
      // Unique constraint: store can't have duplicate slugs (clean URLs)
      storeSlugUnique: uniqueIndex("app_store_slug_unique").on(
        table.storeId,
        table.slug,
      ),
      // Unique constraint: user can't have duplicate slugs
      userSlugUnique: uniqueIndex("app_user_slug_store_unique").on(
        table.userId,
        table.storeId,
        table.slug,
      ),
      guestSlugUnique: uniqueIndex("app_guest_slug_store_unique").on(
        table.guestId,
        table.storeId,
        table.slug,
      ),
    },
  ],
)

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly name
  description: text("description"),
  logo: text("logo"), // URL to logo
  website: text("website"),

  // Owner
  ownerId: uuid("ownerId")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  // Settings
  plan: text("plan", {
    enum: ["starter", "professional", "business", "enterprise"],
  })
    .notNull()
    .default("starter"),

  // Limits based on plan
  maxMembers: integer("maxMembers").default(3).notNull(), // Starter: 3, Pro: 10, Business: 50, Enterprise: unlimited
  maxApps: integer("maxApps").default(2).notNull(), // Starter: 2, Pro: 10, Business: 50, Enterprise: unlimited

  // Monthly price in cents
  monthlyPrice: integer("monthlyPrice").default(0).notNull(), // Starter: $0, Pro: $99, Business: $299, Enterprise: custom

  // Billing
  stripeCustomerId: text("stripeCustomerId"),
  stripeSubscriptionId: text("stripeSubscriptionId"),
  subscriptionStatus: text("subscriptionStatus", {
    enum: ["active", "canceled", "past_due", "trialing"],
  }),

  // Timestamps
  createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    images: jsonb("images").$type<
      {
        url: string
        width?: number
        height?: number
        id: string
      }[]
    >(),
    teamId: uuid("teamId").references(() => teams.id, {
      onDelete: "cascade",
    }),
    domain: text("domain"),
    appId: uuid("appId").references((): AnyPgColumn => apps.id, {
      onDelete: "cascade",
    }),
    userId: uuid("userId").references((): AnyPgColumn => users.id, {
      onDelete: "cascade",
    }),
    guestId: uuid("guestId").references((): AnyPgColumn => guests.id, {
      onDelete: "cascade",
    }),
    parentStoreId: uuid("parentStoreId").references(
      (): AnyPgColumn => stores.id,
    ),
    visibility: text("visibility", {
      enum: ["public", "private", "unlisted"],
    })
      .default("public")
      .notNull(),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    {
      // Unique constraint on slug (for URL routing)
      slugUnique: uniqueIndex("stores_slug_unique").on(table.slug),
      // Index for finding user's stores
      userIdIndex: index("stores_user_idx").on(table.userId),
      // Index for finding guest's stores
      guestIdIndex: index("stores_guest_idx").on(table.guestId),
      // Index for finding team's stores
      teamIdIndex: index("stores_team_idx").on(table.teamId),
      // Index for finding child stores (hierarchy queries)
      parentStoreIdIndex: index("stores_parent_idx").on(table.parentStoreId),
      // Index for finding store by main app
      appIdIndex: index("stores_app_idx").on(table.appId),
      // Index for custom domain lookup
      domainIndex: index("stores_domain_idx").on(table.domain),
    },
  ],
)

export const creditUsage = pgTable(
  "creditUsage",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    userId: uuid("userId").references(() => users.id, { onDelete: "set null" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "set null",
    }),
    appId: uuid("appId").references(() => apps.id, {
      onDelete: "cascade",
    }),
    agentId: uuid("agentId")
      .references(() => aiAgents.id, { onDelete: "cascade" })
      .notNull(),
    creditCost: integer("creditCost").notNull(),
    messageType: text("messageType", {
      enum: ["user", "ai", "image", "search"],
    }).notNull(),
    threadId: uuid("threadId").references(() => threads.id, {
      onDelete: "set null",
    }),
    messageId: uuid("messageId"), // Optional reference for auditing
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("credit_usage_user_date_idx").on(table.userId, table.createdOn),
    index("credit_usage_guest_date_idx").on(table.guestId, table.createdOn),
    index("credit_usage_thread_idx").on(table.threadId),
  ],
)

export const systemLogs = pgTable("systemLogs", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  level: text("level", { enum: ["info", "warn", "error"] }).notNull(),
  userId: uuid("userId").references(() => users.id, { onDelete: "set null" }),
  guestId: uuid("guestId").references(() => guests.id, {
    onDelete: "set null",
  }),
  message: text("message"),
  object: jsonb("object"),
  createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  threadId: uuid("threadId").references(() => threads.id, {
    onDelete: "cascade",
  }),
  userId: uuid("userId").references(() => users.id, {
    onDelete: "cascade",
  }),
  guestId: uuid("guestId").references(() => guests.id, {
    onDelete: "cascade",
  }),
  email: text("email").notNull(),
  createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  gift: uuid("gift"),
  status: text("status", {
    enum: ["accepted", "pending"],
  }).default("pending"),
})

// Document summaries for quick context
export const documentSummaries = pgTable("document_summaries", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  messageId: uuid("messageId").references(() => messages.id, {
    onDelete: "cascade",
  }),
  threadId: uuid("threadId").references(() => threads.id, {
    onDelete: "cascade",
  }),

  filename: text("filename").notNull(),
  fileType: text("fileType").notNull(),
  fileSizeBytes: integer("fileSizeBytes"),

  // AI-generated content
  summary: text("summary"), // AI-generated summary
  keyTopics: jsonb("keyTopics"), // Array of main topics
  totalChunks: integer("total_chunks"),

  createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const timers = pgTable("timer", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guestId").references(() => guests.id, { onDelete: "cascade" }),
  createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  count: integer("count").notNull().default(0),
  fingerprint: text("fingerprint").notNull(),
  isCountingDown: boolean("isCountingDown").notNull().default(false),
  preset1: integer("preset1").notNull().default(25),
  preset2: integer("preset2").notNull().default(15),
  preset3: integer("preset3").notNull().default(5),
})

export const moods = pgTable("mood", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guestId").references(() => guests.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["happy", "sad", "angry", "astonished", "inlove", "thinking"],
  }).notNull(),
  createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),

  messageId: uuid("messageId").references((): AnyPgColumn => messages.id, {
    onDelete: "cascade",
  }),
  metadata: jsonb("metadata")
    .$type<{
      detectedBy?: string // "claude-3.5-sonnet"
      confidence?: number // 0.85
      reason?: string // "User expressed excitement..."
      conversationContext?: string // Last 200 chars
    }>()
    .default({}),
})

export const tasks = pgTable("task", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guestId").references(() => guests.id, { onDelete: "cascade" }),
  createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  modifiedOn: timestamp("modifiedOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  total: jsonb("total").$type<{ date: string; count: number }[]>().default([]),
  order: integer("order").default(0),
  selected: boolean("selected").default(false),
  threadId: uuid("threadId").references(() => threads.id, {
    onDelete: "cascade",
  }),
})
