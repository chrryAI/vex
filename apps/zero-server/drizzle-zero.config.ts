import { drizzleZeroConfig } from "drizzle-zero"
// Import your existing Drizzle schema
import * as schema from "@repo/db/src/schema"

// Define which tables/columns to sync with Zero
// Start with just messages and threads for prototype
export default drizzleZeroConfig(schema, {
  tables: {
    // Messages table
    messages: {
      id: true,
      threadId: true,
      message: true,
      role: true,
      createdAt: true,
      userId: true,
      guestId: true,
      type: true,
      model: true,
      // Add other fields as needed
    },

    // Threads table
    threads: {
      id: true,
      title: true,
      userId: true,
      guestId: true,
      createdAt: true,
      updatedAt: true,
      appId: true,
      isArchived: true,
    },

    // Users table (for relationships)
    users: {
      id: true,
      email: true,
      name: true,
      image: true,
      userName: true,
      language: true,
      theme: true,
      isOnline: true,
      favouriteAgent: true,
    },

    // Guests table (for relationships)
    guests: {
      id: true,
      fingerprint: true,
      favouriteAgent: true,
      language: true,
      appId: true,
      isOnline: true,
    },

    // Apps table
    apps: {
      id: true,
      name: true,
      description: true,
      storeId: true,
      createdOn: true,
    },

    // Stores table
    stores: {
      id: true,
      name: true,
      domain: true,
      createdOn: true,
    },

    // AI Agents table
    aiAgents: {
      id: true,
      name: true,
      displayName: true,
      description: true,
      model: true,
      systemPrompt: true,
      isActive: true,
    },

    // Add more tables as you migrate features
    // memories: { ... },
    // characterProfiles: { ... },
    // collaborations: { ... },
  },

  // Many-to-many relationships (if needed)
  // manyToMany: {
  //   user: {
  //     threads: ["userThreads", "thread"],
  //   },
  // },
})
