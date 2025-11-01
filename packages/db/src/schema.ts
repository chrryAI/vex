import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  vector,
  uuid,
  real,
} from "drizzle-orm/pg-core"
import type { AdapterAccount } from "@auth/core/adapters"
import { sql } from "drizzle-orm"

export const PRO_CREDITS_PER_MONTH = 5000
export const PLUS_CREDITS_PER_MONTH = 2000
export const ADDITIONAL_CREDITS = 600
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
    apiKey: text("apiKey"),
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
    favouriteAgent: text("favouriteAgent").notNull().default("claude"),
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

  favouriteAgent: text("favouriteAgent").notNull().default("deepSeek"),

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

// teams/Teams for collaborative agent management
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

// team members (team members)
export const teamMembers = pgTable(
  "teamMembers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("teamId")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("userId")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    role: text("role", {
      enum: ["owner", "admin", "member", "viewer"],
    })
      .notNull()
      .default("member"),

    // Permissions
    canCreateApps: boolean("canCreateApps").default(true).notNull(),
    canEditApps: boolean("canEditApps").default(true).notNull(),
    canDeleteApps: boolean("canDeleteApps").default(false).notNull(),
    canManageMembers: boolean("canManageMembers").default(false).notNull(),
    canManageBilling: boolean("canManageBilling").default(false).notNull(),

    // Timestamps
    joinedOn: timestamp("joinedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    invitedBy: uuid("invitedBy").references(() => users.id),
  },
  (table) => [
    {
      // Ensure user can only be in org once
      uniqueOrgUser: uniqueIndex("unique_org_user").on(
        table.teamId,
        table.userId,
      ),
    },
  ],
)

export const cities = pgTable(
  "city",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    country: text("country").notNull(),
    population: integer("population"),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("cities_search_index").using(
      "gin",
      sql`(
      setweight(to_tsvector('english', ${table.name}), 'A') ||
      setweight(to_tsvector('english', ${table.country}), 'B')
  )`,
    ),
  ],
)

export const creditTransactions = pgTable("creditTransactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guestId").references(() => guests.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // positive for credits added, negative for usage
  balanceBefore: integer("balanceBefore").notNull(),
  balanceAfter: integer("balanceAfter").notNull(),
  description: text("description"),
  subscriptionId: uuid("subscriptionId").references(() => subscriptions.id, {
    onDelete: "cascade",
  }),
  type: text("type", {
    enum: ["purchase", "subscription"],
  })
    .notNull()
    .default("purchase"),
  metadata: jsonb("metadata"), // store payment info, subscription details, etc.
  createdOn: timestamp("createdOn", {
    mode: "date",
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
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
    id: uuid("id").defaultRandom(),
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    value: text("value"), // Better Auth expects this field
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),

    updatedAt: timestamp("updatedAt", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("createdAt", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expiresAt", {
      mode: "date",
      withTimezone: true,
    }), // Better Auth expects this field
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
  appId: uuid("appId").references(() => apps.id, { onDelete: "cascade" }),
  userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guestId").references(() => guests.id, { onDelete: "cascade" }),
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
  | "perplexity"

export const messages = pgTable(
  "messages",
  {
    type: text("type", {
      enum: ["chat", "training", "system", "feedback", "test"],
    })
      .notNull()
      .default("chat"),
    id: uuid("id").defaultRandom().notNull().primaryKey(),
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

export const placeHolders = pgTable("placeHolders", {
  appId: uuid("appId").references(() => apps.id, {
    onDelete: "cascade",
  }),
  id: uuid("id").defaultRandom().primaryKey(),
  text: text("text").notNull(),
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

  threadId: uuid("threadId").references((): AnyPgColumn => threads.id, {
    onDelete: "cascade",
  }),
  metadata: jsonb("metadata").$type<{
    history?: Array<{
      text: string
      generatedAt: string
      conversationContext?: string // Last 200 chars - for debugging only
      topicKeywords?: string[] // Extracted topics (lighter weight)
    }>
    clickCount?: number
    lastClickedAt?: string
    impressionCount?: number
    generatedBy?: string
    confidence?: number
  }>(),
})

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

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    messageId: uuid("messageId").references(() => messages.id, {
      onDelete: "cascade",
    }),
    threadId: uuid("threadId").references(() => threads.id, {
      onDelete: "cascade",
    }),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),

    // Content and metadata
    content: text("content").notNull(),
    chunkIndex: integer("chunkIndex").notNull(),
    filename: text("filename").notNull(),
    fileType: text("fileType").notNull(),

    // Vector embedding using pgvector
    embedding: vector("embedding", { dimensions: 1536 }),

    // Additional metadata
    metadata: jsonb("metadata"),
    tokenCount: integer("tokenCount"),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("document_chunks_thread_idx").on(table.threadId),
    index("document_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
)

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

// Message embeddings for semantic search of conversation history
export const messageEmbeddings = pgTable(
  "message_embeddings",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    messageId: uuid("messageId").references(() => messages.id, {
      onDelete: "cascade",
    }),
    threadId: uuid("threadId").references(() => threads.id, {
      onDelete: "cascade",
    }),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),

    // Message content and metadata
    content: text("content").notNull(),
    role: text("role").notNull(), // 'user' or 'assistant'

    // Vector embedding for semantic search
    embedding: vector("embedding", { dimensions: 1536 }),

    // Metadata for context
    metadata: jsonb("metadata"), // conversation context, topics, etc.
    tokenCount: integer("tokenCount"),

    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("message_embeddings_thread_idx").on(table.threadId),
    index("message_embeddings_user_idx").on(table.userId),
    index("message_embeddings_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
)

// Thread summaries with integrated RAG, memories, and character context
export const threadSummaries = pgTable(
  "threadSummaries",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    threadId: uuid("threadId")
      .references(() => threads.id, {
        onDelete: "cascade",
      })
      .notNull(),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),

    // Core summary content
    summary: text("summary").notNull(), // AI-generated thread summary
    keyTopics: jsonb("keyTopics").$type<string[]>(), // Main discussion topics

    // Message context
    messageCount: integer("messageCount").notNull().default(0),
    lastMessageAt: timestamp("lastMessageAt", {
      mode: "date",
      withTimezone: true,
    }),

    // RAG context from documents and conversation
    ragContext: jsonb("ragContext").$type<{
      documentSummaries: string[]
      relevantChunks: { content: string; source: string; score: number }[]
      conversationContext: string
    }>(),

    // User memories associated with this thread
    userMemories: jsonb("userMemories").$type<
      {
        id: string
        content: string
        tags: string[]
        relevanceScore: number
        createdAt: string
      }[]
    >(),

    // Character/agent tags and personality context
    characterTags: jsonb("characterTags").$type<{
      agentPersonalities: {
        agentId: string
        traits: string[]
        behavior: string
      }[]
      conversationTone: string
      userPreferences: string[]
      contextualTags: string[]
    }>(),

    // Vector embedding for semantic search of summaries
    embedding: vector("embedding", { dimensions: 1536 }),

    // Metadata
    metadata: jsonb("metadata").$type<{
      version: string
      generatedBy: string
      confidence: number
      lastUpdated: string
    }>(),

    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("thread_summaries_thread_idx").on(table.threadId),
    index("thread_summaries_user_idx").on(table.userId),
    index("thread_summaries_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("thread_summaries_topics_idx").using("gin", table.keyTopics),
  ],
)

// User memories for persistent context across conversations
export const memories = pgTable(
  "memories",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),
    appId: uuid("appId").references(() => apps.id, { onDelete: "cascade" }),

    // Memory content
    content: text("content").notNull(),
    title: text("title").notNull(),

    // Categorization
    tags: jsonb("tags").$type<string[]>().default([]),
    category: text("category", {
      enum: [
        "preference",
        "fact",
        "context",
        "instruction",
        "relationship",
        "goal",
      ],
    })
      .notNull()
      .default("context"),

    // Relevance and usage
    importance: integer("importance").notNull().default(5), // 1-10 scale
    usageCount: integer("usageCount").notNull().default(0),
    lastUsedAt: timestamp("lastUsedAt", { mode: "date", withTimezone: true }),

    // Vector embedding for semantic retrieval
    embedding: vector("embedding", { dimensions: 1536 }),

    // Source context
    sourceThreadId: uuid("sourceThreadId").references(() => threads.id, {
      onDelete: "set null",
    }),
    sourceMessageId: uuid("sourceMessageId").references(() => messages.id, {
      onDelete: "set null",
    }),

    // Metadata
    metadata: jsonb("metadata").$type<{
      extractedBy: string
      confidence: number
      relatedMemories: string[]
    }>(),

    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("user_memories_user_idx").on(table.userId),
    index("user_memories_guest_idx").on(table.guestId),
    index("app_memories_app_idx").on(table.appId),
    index("user_memories_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("user_memories_tags_idx").using("gin", table.tags),
    index("user_memories_category_idx").on(table.category),
  ],
)

// Character tags and personality profiles for AI agents
export const characterProfiles = pgTable(
  "characterProfiles",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    agentId: uuid("agentId")
      .references(() => aiAgents.id, {
        onDelete: "cascade",
      })
      .notNull(),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),
    visibility: text("visibility", {
      enum: ["private", "protected", "public"],
    })
      .notNull()
      .default("private"),
    // Character definition
    name: text("name").notNull(),
    personality: text("personality").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    // Behavioral traits
    traits: jsonb("traits")
      .$type<{
        communication: string[]
        expertise: string[]
        behavior: string[]
        preferences: string[]
      }>()
      .notNull(),

    threadId: uuid("threadId")
      .references(() => threads.id, {
        onDelete: "cascade",
      })
      .notNull(),

    // Context and usage
    tags: jsonb("tags").$type<string[]>().default([]),
    usageCount: integer("usageCount").notNull().default(0),
    lastUsedAt: timestamp("lastUsedAt", { mode: "date", withTimezone: true }),

    // Relationship context
    userRelationship: text("userRelationship"), // How this character relates to the user
    conversationStyle: text("conversationStyle"), // Formal, casual, technical, etc.

    // Vector embedding for personality matching
    embedding: vector("embedding", { dimensions: 1536 }),

    // Metadata
    metadata: jsonb("metadata").$type<{
      version: string
      createdBy: string
      effectiveness: number
    }>(),

    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("character_profiles_agent_idx").on(table.agentId),
    index("character_profiles_user_idx").on(table.userId),
    index("character_profiles_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("character_profiles_tags_idx").using("gin", table.tags),
  ],
)

// Calendar Events Table
export const calendarEvents = pgTable(
  "calendarEvent",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),

    // Event details
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),

    // Time and duration
    startTime: timestamp("startTime", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    endTime: timestamp("endTime", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    isAllDay: boolean("isAllDay").notNull().default(false),
    timezone: text("timezone").default("UTC"),

    // Visual and categorization
    color: text("color", {
      enum: ["red", "orange", "blue", "green", "violet", "purple"],
    }).default("blue"), // Default blue color
    category: text("category"), // work, personal, meeting, etc.
    // Recurrence (for future implementation)
    isRecurring: boolean("isRecurring").notNull().default(false),
    recurrenceRule: jsonb("recurrenceRule").$type<{
      frequency: "daily" | "weekly" | "monthly" | "yearly"
      interval: number
      endDate?: string
      daysOfWeek?: number[] // 0-6, Sunday = 0
      dayOfMonth?: number
      weekOfMonth?: number
    }>(),

    // Attendees and collaboration
    attendees: jsonb("attendees")
      .$type<
        Array<{
          email: string
          name?: string
          status: "pending" | "accepted" | "declined"
          isOrganizer?: boolean
        }>
      >()
      .default([]),

    // Integration with AI and threads
    threadId: uuid("threadId").references(() => threads.id, {
      onDelete: "set null",
    }), // Link to conversation that created this event
    agentId: uuid("agentId").references(() => aiAgents.id, {
      onDelete: "set null",
    }),
    aiContext: jsonb("aiContext").$type<{
      originalPrompt?: string
      confidence?: number
      suggestedBy?: string
    }>(),

    // Reminders
    reminders: jsonb("reminders")
      .$type<
        Array<{
          type: "email" | "notification" | "popup"
          minutesBefore: number
          sent?: boolean
        }>
      >()
      .default([]),

    // Status and metadata
    status: text("status", {
      enum: ["confirmed", "tentative", "cancelled"],
    })
      .notNull()
      .default("confirmed"),

    visibility: text("visibility", {
      enum: ["private", "public", "shared"],
    })
      .notNull()
      .default("private"),

    // External calendar sync
    externalId: text("externalId"), // For Google Calendar, Outlook sync
    externalSource: text("externalSource", {
      enum: ["google", "outlook", "apple"],
    }), // "google", "outlook", "apple"
    lastSyncedAt: timestamp("lastSyncedAt", {
      mode: "date",
      withTimezone: true,
    }),

    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("calendar_events_user_idx").on(table.userId),
    index("calendar_events_guest_idx").on(table.guestId),
    index("calendar_events_time_idx").on(table.startTime, table.endTime),
    index("calendar_events_thread_idx").on(table.threadId),
    index("calendar_events_external_idx").on(
      table.externalId,
      table.externalSource,
    ),
    // Composite index for efficient date range queries
    index("calendar_events_user_time_idx").on(table.userId, table.startTime),
    index("calendar_events_guest_time_idx").on(table.guestId, table.startTime),
  ],
)

// Affiliate System Tables
export const affiliateLinks = pgTable(
  "affiliateLinks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    code: text("code").unique().notNull(),
    clicks: integer("clicks").default(0).notNull(),
    conversions: integer("conversions").default(0).notNull(),
    totalRevenue: integer("totalRevenue").default(0).notNull(), // in cents
    commissionEarned: integer("commissionEarned").default(0).notNull(), // in cents
    commissionPaid: integer("commissionPaid").default(0).notNull(), // in cents
    commissionRate: integer("commissionRate").default(20).notNull(), // percentage (20 = 20%)
    status: text("status", {
      enum: ["active", "inActive"],
    })
      .notNull()
      .default("active"),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("affiliate_links_code_idx").on(table.code),
    index("affiliate_links_user_idx").on(table.userId),
    index("affiliate_links_status_idx").on(table.status),
  ],
)

export const affiliateClicks = pgTable(
  "affiliateClicks",
  {
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateLinkId: uuid("affiliateLinkId")
      .references(() => affiliateLinks.id, { onDelete: "cascade" })
      .notNull(),
    clickedOn: timestamp("clickedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    referrer: text("referrer"),
    converted: boolean("converted").notNull().default(false),
    convertedOn: timestamp("convertedOn", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("affiliate_clicks_link_idx").on(table.affiliateLinkId),
    index("affiliate_clicks_clicked_on_idx").on(table.clickedOn),
    index("affiliate_clicks_converted_idx").on(table.converted),
    index("affiliate_clicks_ip_idx").on(table.ipAddress),
    index("affiliate_clicks_converted_on_idx").on(table.convertedOn),
    index("affiliate_clicks_user_agent_idx").on(table.userAgent),
  ],
)

export const affiliateReferrals = pgTable(
  "affiliateReferrals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateLinkId: uuid("affiliate_link_id")
      .references(() => affiliateLinks.id, { onDelete: "cascade" })
      .notNull(),
    referredUserId: uuid("referredUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    referredGuestId: uuid("referredGuestId").references(() => guests.id, {
      onDelete: "set null",
    }),
    subscriptionId: uuid("subscriptionId").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    status: text("status", {
      enum: ["pending", "converted", "paid", "cancelled"],
    })
      .default("pending")
      .notNull(),
    commissionAmount: integer("commissionAmount").default(0).notNull(), // in cents
    bonusCredits: integer("bonusCredits").default(0).notNull(),
    convertedOn: timestamp("convertedOn", {
      mode: "date",
      withTimezone: true,
    }),
    paidOn: timestamp("paidOn", { mode: "date", withTimezone: true }),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("affiliate_referrals_link_idx").on(table.affiliateLinkId),
    index("affiliate_referrals_user_idx").on(table.referredUserId),
    index("affiliate_referrals_guest_idx").on(table.referredGuestId),
    index("affiliate_referrals_subscription_idx").on(table.subscriptionId),
    index("affiliate_referrals_status_idx").on(table.status),
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
    tips: jsonb("tips").$type<
      Array<{
        id: string
        content?: string
        emoji?: string
      }>
    >(),

    tipsTitle: text("tipsTitle"),

    // Structured content for app details
    highlights: jsonb("highlights").$type<
      Array<{
        id: string
        title: string
        content?: string
        emoji?: string
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
    defaultModel: text("defaultModel", {
      enum: ["deepSeek", "chatGPT", "claude", "gemini", "flux", "perplexity"],
    }).default("claude"), // Default AI model for this app
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

export const appOrders = pgTable(
  "appOrders",
  {
    appId: uuid("appId")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    storeId: uuid("storeId").references(() => stores.id, {
      onDelete: "cascade",
    }),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),
    order: integer("order").notNull(),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    {
      // Unique constraint: one app can only have one order per store+user/guest
      appStoreUserUnique: uniqueIndex("app_order_app_store_user_unique").on(
        table.appId,
        table.storeId,
        table.userId,
      ),
      appStoreGuestUnique: uniqueIndex("app_order_app_store_guest_unique").on(
        table.appId,
        table.storeId,
        table.guestId,
      ),
      // Index for fast lookups by store
      storeIdIndex: index("app_order_store_id_idx").on(table.storeId),
      // Index for fast lookups by user
      userIdIndex: index("app_order_user_id_idx").on(table.userId),
      // Index for fast lookups by guest
      guestIdIndex: index("app_order_guest_id_idx").on(table.guestId),
    },
  ],
)

export const appExtend = pgTable(
  "appExtends",
  {
    appId: uuid("appId")
      .references(() => apps.id, {
        onDelete: "cascade",
      })
      .notNull(),
    toId: uuid("toId")
      .references(() => apps.id, {
        onDelete: "cascade",
      })
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
      appIdToIdUnique: uniqueIndex("app_extends_app_id_to_id_unique").on(
        table.appId,
        table.toId,
      ),
    },
  ],
)

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

// App & Store Installs - Track which users/guests have installed which apps/stores
export const installs = pgTable(
  "installs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Either appId OR storeId must be set (not both)
    appId: uuid("appId").references(() => apps.id, { onDelete: "cascade" }),
    storeId: uuid("storeId").references(() => stores.id, {
      onDelete: "set null",
    }),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),
    installedAt: timestamp("installedAt", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    uninstalledAt: timestamp("uninstalledAt", {
      mode: "date",
      withTimezone: true,
    }), // null = still installed
    // Home screen organization
    order: integer("order").notNull().default(0), // Position on home screen (0 = first)
    isPinned: boolean("isPinned").notNull().default(false), // Pinned to top of home screen
    // PWA-specific metadata
    platform: text("platform", {
      enum: ["web", "ios", "android", "desktop"],
    }), // Where it was installed
    source: text("source", {
      enum: ["store", "share", "direct", "recommendation"],
    }), // How they found it
  },
  (table) => [
    {
      // Indexes for efficient queries
      appIdIndex: index("installs_app_idx").on(table.appId),
      storeIdIndex: index("installs_store_idx").on(table.storeId),
      userIdIndex: index("installs_user_idx").on(table.userId),
      guestIdIndex: index("installs_guest_idx").on(table.guestId),
      installedAtIndex: index("installs_installed_at_idx").on(
        table.installedAt,
      ),
      // Unique constraint: user can only install an app once (unless uninstalled)
      userAppUnique: uniqueIndex("installs_user_app_unique").on(
        table.userId,
        table.appId,
      ),
      guestAppUnique: uniqueIndex("installs_guest_app_unique").on(
        table.guestId,
        table.appId,
      ),
      // Unique constraint: user can only install a store once
      userStoreUnique: uniqueIndex("installs_user_store_unique").on(
        table.userId,
        table.storeId,
      ),
      guestStoreUnique: uniqueIndex("installs_guest_store_unique").on(
        table.guestId,
        table.storeId,
      ),
    },
  ],
)

export type install = typeof installs.$inferSelect
export type newInstall = typeof installs.$inferInsert

// Store Installs - Apps installed in stores (cross-store app sharing)
export const storeInstalls = pgTable(
  "storeInstalls",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Which store is installing the app
    storeId: uuid("storeId")
      .references(() => stores.id, { onDelete: "cascade" })
      .notNull(),

    // Which app is being installed
    appId: uuid("appId")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),

    // Store-specific customization
    customDescription: text("customDescription"), // Override app description for this store
    customIcon: text("customIcon"), // Override app icon for this store
    featured: boolean("featured").notNull().default(false), // Featured in this store
    displayOrder: integer("displayOrder").notNull().default(0), // Display order in store

    // Timestamps
    installedAt: timestamp("installedAt", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    {
      // Indexes for efficient queries
      storeIdIndex: index("store_installs_store_idx").on(table.storeId),
      appIdIndex: index("store_installs_app_idx").on(table.appId),
      featuredIndex: index("store_installs_featured_idx").on(table.featured),
      // Unique constraint: one app can only be installed once per store
      storeAppUnique: uniqueIndex("store_installs_store_app_unique").on(
        table.storeId,
        table.appId,
      ),
    },
  ],
)

export type storeInstall = typeof storeInstalls.$inferSelect
export type newStoreInstall = typeof storeInstalls.$inferInsert

// News Articles - Store news from various sources (CNN, Bloomberg, etc.)
export const newsArticles = pgTable(
  "newsArticles",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Source information
    source: text("source").notNull(), // "cnn", "bloomberg", "nyt", "techcrunch", etc.
    sourceUrl: text("sourceUrl").notNull(), // Original article URL

    // Article content
    title: text("title").notNull(),
    description: text("description"),
    content: text("content"), // Full article text
    summary: text("summary"), // AI-generated summary

    // Metadata
    author: text("author"),
    category: text("category"), // "world", "business", "tech", "sports", etc.
    tags: text("tags").array().default([]),
    imageUrl: text("imageUrl"),

    // Timestamps
    publishedAt: timestamp("publishedAt", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    fetchedAt: timestamp("fetchedAt", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),

    // Analytics
    viewCount: integer("viewCount").notNull().default(0),
    shareCount: integer("shareCount").notNull().default(0),

    // Search
    embedding: vector("embedding", { dimensions: 1536 }), // For semantic search

    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    {
      sourceIndex: index("news_articles_source_idx").on(table.source),
      categoryIndex: index("news_articles_category_idx").on(table.category),
      publishedAtIndex: index("news_articles_published_at_idx").on(
        table.publishedAt,
      ),
      embeddingIndex: index("news_articles_embedding_idx").using(
        "hnsw",
        table.embedding.op("vector_cosine_ops"),
      ),
      // Unique constraint: same article from same source
      sourceUrlUnique: uniqueIndex("news_articles_source_url_unique").on(
        table.source,
        table.sourceUrl,
      ),
    },
  ],
)

// Vex Platform API Usage - Track Vex core API (chat, LifeOS apps)
export const vexApiUsage = pgTable(
  "vexApiUsage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }), // API consumer
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),

    // Which Vex API endpoint
    endpoint: text("endpoint").notNull(), // "chat", "atlas", "bloom", "peach", "vault"

    // Request details
    requestCount: integer("requestCount").notNull().default(0),
    successCount: integer("successCount").notNull().default(0),
    errorCount: integer("errorCount").notNull().default(0),
    totalTokens: integer("totalTokens").notNull().default(0),

    // Tools

    // Billing
    amount: integer("amount").notNull().default(0), // Amount charged in cents (100% to Vex)
    currency: text("currency").default("usd"),
    billingPeriod: text("billingPeriod", {
      enum: ["hourly", "daily", "monthly"],
    })
      .notNull()
      .default("monthly"),

    // Period
    periodStart: timestamp("periodStart", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    periodEnd: timestamp("periodEnd", { mode: "date", withTimezone: true }),

    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    {
      userIdIndex: index("vex_api_usage_user_idx").on(table.userId),
      guestIdIndex: index("vex_api_usage_guest_idx").on(table.guestId),
      endpointIndex: index("vex_api_usage_endpoint_idx").on(table.endpoint),
      periodIndex: index("vex_api_usage_period_idx").on(table.periodStart),
    },
  ],
)

// Agent API Usage - Track custom agent API requests and billing
export const agentApiUsage = pgTable(
  "agentApiUsage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("appId")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }), // API consumer
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),

    // Request details
    requestCount: integer("requestCount").notNull().default(0),
    successCount: integer("successCount").notNull().default(0),
    errorCount: integer("errorCount").notNull().default(0),
    totalTokens: integer("totalTokens").notNull().default(0),

    // Billing
    amount: integer("amount").notNull().default(0), // Amount charged in cents
    currency: text("currency").default("usd"),
    billingPeriod: text("billingPeriod", {
      enum: ["hourly", "daily", "monthly"],
    })
      .notNull()
      .default("monthly"),

    // Period
    periodStart: timestamp("periodStart", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    periodEnd: timestamp("periodEnd", { mode: "date", withTimezone: true }),

    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    {
      appIdIndex: index("agent_api_usage_app_idx").on(table.appId),
      userIdIndex: index("agent_api_usage_user_idx").on(table.userId),
      guestIdIndex: index("agent_api_usage_guest_idx").on(table.guestId),
      periodIndex: index("agent_api_usage_period_idx").on(table.periodStart),
    },
  ],
)

// Agent Subscriptions - Track who subscribed to which custom agents
export const agentSubscriptions = pgTable(
  "agentSubscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("appId")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),

    // Subscription details
    status: text("status", {
      enum: ["active", "canceled", "expired", "trial"],
    })
      .notNull()
      .default("active"),
    pricing: text("pricing", {
      enum: ["free", "one-time", "subscription"],
    }).notNull(),
    amount: integer("amount").notNull().default(0), // Amount paid in cents
    currency: text("currency").default("usd"),

    // Stripe
    stripeSubscriptionId: text("stripeSubscriptionId"), // For recurring subscriptions
    stripePaymentIntentId: text("stripePaymentIntentId"), // For one-time payments

    // Dates
    startDate: timestamp("startDate", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    endDate: timestamp("endDate", { mode: "date", withTimezone: true }), // For subscriptions
    canceledAt: timestamp("canceledAt", { mode: "date", withTimezone: true }),

    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    {
      appIdIndex: index("agent_sub_app_idx").on(table.appId),
      userIdIndex: index("agent_sub_user_idx").on(table.userId),
      guestIdIndex: index("agent_sub_guest_idx").on(table.guestId),
      statusIndex: index("agent_sub_status_idx").on(table.status),
    },
  ],
)

// Agent Payouts - Track creator earnings
export const agentPayouts = pgTable(
  "agentPayouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("appId")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    creatorUserId: uuid("creatorUserId").references(() => users.id, {
      onDelete: "cascade",
    }),
    creatorGuestId: uuid("creatorGuestId").references(() => guests.id, {
      onDelete: "cascade",
    }),

    // Payout details
    amount: integer("amount").notNull(), // Amount in cents
    currency: text("currency").default("usd"),
    status: text("status", {
      enum: ["pending", "processing", "paid", "failed"],
    })
      .notNull()
      .default("pending"),

    // Period
    periodStart: timestamp("periodStart", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    periodEnd: timestamp("periodEnd", {
      mode: "date",
      withTimezone: true,
    }).notNull(),

    // Stripe
    stripePayoutId: text("stripePayoutId"),
    stripeTransferId: text("stripeTransferId"),

    // Metadata
    subscriptionCount: integer("subscriptionCount").notNull().default(0),
    totalRevenue: integer("totalRevenue").notNull().default(0), // Before revenue share
    platformFee: integer("platformFee").notNull().default(0), // Vex's cut

    paidAt: timestamp("paidAt", { mode: "date", withTimezone: true }),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    {
      appIdIndex: index("agent_payout_app_idx").on(table.appId),
      creatorUserIdIndex: index("agent_payout_creator_user_idx").on(
        table.creatorUserId,
      ),
      creatorGuestIdIndex: index("agent_payout_creator_guest_idx").on(
        table.creatorGuestId,
      ),
      statusIndex: index("agent_payout_status_idx").on(table.status),
    },
  ],
)

export const instructions = pgTable("instructions", {
  appId: uuid("appId").references(() => apps.id, { onDelete: "set null" }),
  userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guestId").references(() => guests.id, { onDelete: "cascade" }),
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  emoji: text("emoji").notNull(),
  content: text("content").notNull(),
  confidence: integer("confidence").notNull(),
  generatedAt: timestamp("generatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  requiresWebSearch: boolean("requiresWebSearch").notNull().default(false),
  createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const affiliatePayouts = pgTable(
  "affiliatePayouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateLinkId: uuid("affiliateLinkId")
      .references(() => affiliateLinks.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("userId")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    amount: integer("amount").notNull(), // in cents
    method: text("method", { enum: ["paypal", "stripe", "bank_transfer"] })
      .default("stripe")
      .notNull(),
    paypalEmail: text("paypalEmail"),
    stripeAccountId: text("stripeAccountId"),
    status: text("status", {
      enum: ["pending", "processing", "completed", "failed"],
    })
      .default("pending")
      .notNull(),
    transactionId: text("transactionId"),
    notes: text("notes"),
    requestedOn: timestamp("requestedOn", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    processedOn: timestamp("processedOn", {
      mode: "date",
      withTimezone: true,
    }),
    completedOn: timestamp("completedOn", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => [
    index("affiliate_payouts_link_idx").on(table.affiliateLinkId),
    index("affiliate_payouts_user_idx").on(table.userId),
    index("affiliate_payouts_status_idx").on(table.status),
  ],
)

export const expenseCategory = [
  "food",
  "transport",
  "entertainment",
  "shopping",
  "bills",
  "health",
  "education",
  "travel",
  "other",
] as const

export const budgetCategory = expenseCategory

// Vault (Finance) - Expense Tracking
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),
    threadId: uuid("threadId").references(() => threads.id, {
      onDelete: "set null",
    }),
    amount: integer("amount").notNull(), // in cents
    currency: text("currency").notNull().default("USD"),
    category: text("category", {
      enum: expenseCategory,
    })
      .notNull()
      .default("other"),
    description: text("description").notNull(),
    date: timestamp("date", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    receipt: text("receipt"), // Image URL
    tags: jsonb("tags").$type<string[]>().default([]),
    isShared: boolean("isShared").notNull().default(false),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("expenses_user_idx").on(table.userId),
    index("expenses_guest_idx").on(table.guestId),
    index("expenses_thread_idx").on(table.threadId),
    index("expenses_date_idx").on(table.date),
    index("expenses_category_idx").on(table.category),
  ],
)

export type expense = typeof expenses.$inferSelect
export type newExpense = typeof expenses.$inferInsert

// Vault - Budgets
export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),
    category: text("category", {
      enum: budgetCategory,
    })
      .notNull()
      .default("other"),
    amount: integer("amount").notNull(), // Budget limit in cents
    period: text("period", { enum: ["weekly", "monthly", "yearly"] })
      .notNull()
      .default("monthly"),
    startDate: timestamp("startDate", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    endDate: timestamp("endDate", { mode: "date", withTimezone: true }),
    isActive: boolean("isActive").notNull().default(true),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),

    currency: text("currency").notNull().default("USD"),
  },
  (table) => [
    index("budgets_user_idx").on(table.userId),
    index("budgets_category_idx").on(table.category),
    index("budgets_active_idx").on(table.isActive),
  ],
)

export type budget = typeof budgets.$inferSelect
export type newBudget = typeof budgets.$inferInsert

// Vault - Shared Expenses (for collaboration)
export const sharedExpenses = pgTable(
  "sharedExpenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expenseId")
      .references(() => expenses.id, { onDelete: "cascade" })
      .notNull(),
    threadId: uuid("threadId")
      .references(() => threads.id, { onDelete: "cascade" })
      .notNull(),
    splits: jsonb("splits")
      .$type<
        {
          userId?: string
          guestId?: string
          amount: number
          paid: boolean
        }[]
      >()
      .notNull(),
    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("shared_expenses_expense_idx").on(table.expenseId),
    index("shared_expenses_thread_idx").on(table.threadId),
  ],
)

export type sharedExpense = typeof sharedExpenses.$inferSelect
export type newSharedExpense = typeof sharedExpenses.$inferInsert

// ============================================
// 🍣 SUSHI - Real-time Analytics
// ============================================

// Analytics Sites (websites being tracked)
export const analyticsSites = pgTable(
  "analyticsSites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guestId").references(() => guests.id, {
      onDelete: "cascade",
    }),

    // Site details
    domain: text("domain").notNull(), // e.g., "chrry.dev"
    name: text("name").notNull(), // Display name
    timezone: text("timezone").notNull().default("UTC"),

    // Tracking
    trackingId: text("trackingId").notNull().unique(), // Public tracking ID
    isPublic: boolean("isPublic").notNull().default(false), // Public dashboard

    // Settings
    excludeIps: jsonb("excludeIps").$type<string[]>().default([]),
    excludePaths: jsonb("excludePaths").$type<string[]>().default([]),

    createdOn: timestamp("createdOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedOn: timestamp("updatedOn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("analytics_sites_user_idx").on(table.userId),
    index("analytics_sites_guest_idx").on(table.guestId),
    index("analytics_sites_tracking_idx").on(table.trackingId),
    index("analytics_sites_domain_idx").on(table.domain),
  ],
)

export type analyticsSite = typeof analyticsSites.$inferSelect
export type newAnalyticsSite = typeof analyticsSites.$inferInsert

// Analytics Events (pageviews, clicks, custom events)
export const analyticsEvents = pgTable(
  "analyticsEvents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("siteId")
      .references(() => analyticsSites.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: text("sessionId").notNull(), // Client-generated session ID

    // Event details
    type: text("type", {
      enum: ["pageview", "click", "custom"],
    })
      .notNull()
      .default("pageview"),
    name: text("name"), // Event name for custom events

    // Page details
    pathname: text("pathname").notNull(), // /about
    referrer: text("referrer"), // Where they came from

    // Visitor details
    country: text("country"), // US, GB, etc.
    city: text("city"),
    device: text("device", {
      enum: ["desktop", "mobile", "tablet"],
    }),
    browser: text("browser"), // Chrome, Safari, etc.
    os: text("os"), // macOS, Windows, iOS, Android

    // Metadata
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),

    // Duration (for pageviews)
    duration: integer("duration"), // Time on page in seconds

    timestamp: timestamp("timestamp", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("analytics_events_site_idx").on(table.siteId),
    index("analytics_events_session_idx").on(table.sessionId),
    index("analytics_events_type_idx").on(table.type),
    index("analytics_events_timestamp_idx").on(table.timestamp),
    index("analytics_events_pathname_idx").on(table.pathname),
    index("analytics_events_country_idx").on(table.country),
  ],
)

export type analyticsEvent = typeof analyticsEvents.$inferSelect
export type newAnalyticsEvent = typeof analyticsEvents.$inferInsert

// Analytics Sessions (visitor sessions)
export const analyticsSessions = pgTable(
  "analyticsSessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("siteId")
      .references(() => analyticsSites.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: text("sessionId").notNull().unique(), // Client-generated

    // Session details
    entryPage: text("entryPage").notNull(), // First page visited
    exitPage: text("exitPage"), // Last page visited
    pageviews: integer("pageviews").notNull().default(1),
    duration: integer("duration").notNull().default(0), // Total session duration

    // Visitor details
    country: text("country"),
    city: text("city"),
    device: text("device", {
      enum: ["desktop", "mobile", "tablet"],
    }),
    browser: text("browser"),
    os: text("os"),
    referrer: text("referrer"),

    // Timestamps
    startedAt: timestamp("startedAt", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("endedAt", { mode: "date", withTimezone: true }),

    // Real-time tracking
    isActive: boolean("isActive").notNull().default(true),
    lastSeenAt: timestamp("lastSeenAt", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("analytics_sessions_site_idx").on(table.siteId),
    index("analytics_sessions_session_idx").on(table.sessionId),
    index("analytics_sessions_active_idx").on(table.isActive),
    index("analytics_sessions_started_idx").on(table.startedAt),
  ],
)

export type analyticsSession = typeof analyticsSessions.$inferSelect
export type newAnalyticsSession = typeof analyticsSessions.$inferInsert
