import { db } from "./index"
import { apps, pearFeedback, users } from "./src/schema"

// NOSONAR - Math.random() is acceptable for non-security-critical seed data
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]! // NOSONAR
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

// ─── Feedback corpus (all tiers, types, and categories) ────────────────────

const FEEDBACK_POOL: Array<{
  content: string
  feedbackType:
    | "complaint"
    | "suggestion"
    | "praise"
    | "bug"
    | "feature_request"
  category:
    | "ux"
    | "performance"
    | "feature"
    | "bug"
    | "keyboard_shortcuts"
    | "ui_design"
    | "analytics"
    | "other"
  sentimentScore: number
  specificityScore: number
  actionabilityScore: number
  emotionalTags?: string[]
  firstImpression?: boolean
}> = [
  // ── 5-credit tier: praise / basic feedback ──────────────────────────────
  {
    content:
      "I really like the clean design and the color scheme feels modern.",
    feedbackType: "praise",
    category: "ui_design",
    sentimentScore: 0.2,
    specificityScore: 0.5,
    actionabilityScore: 0.4,
  },
  {
    content: "The app feels fast and responsive on my machine.",
    feedbackType: "praise",
    category: "performance",
    sentimentScore: 0.2,
    specificityScore: 0.5,
    actionabilityScore: 0.4,
  },
  {
    content: "Love the dark mode option — easy on the eyes at night.",
    feedbackType: "praise",
    category: "ui_design",
    sentimentScore: 0.2,
    specificityScore: 0.5,
    actionabilityScore: 0.4,
    emotionalTags: ["comfortable"],
  },
  {
    content:
      "The onboarding experience is smooth. Got started in under a minute.",
    feedbackType: "praise",
    category: "ux",
    sentimentScore: 0.2,
    specificityScore: 0.5,
    actionabilityScore: 0.4,
    firstImpression: true,
  },
  {
    content: "Nice overall, I use it daily now.",
    feedbackType: "praise",
    category: "ux",
    sentimentScore: 0.2,
    specificityScore: 0.5,
    actionabilityScore: 0.4,
  },
  {
    content: "The UI looks professional and modern. Good job.",
    feedbackType: "praise",
    category: "ui_design",
    sentimentScore: 0.2,
    specificityScore: 0.5,
    actionabilityScore: 0.4,
  },
  {
    content: "Navigation feels intuitive. Everything is where I expect it.",
    feedbackType: "praise",
    category: "ux",
    sentimentScore: 0.2,
    specificityScore: 0.5,
    actionabilityScore: 0.4,
  },
  {
    content: "Animations are smooth, doesn't feel laggy at all.",
    feedbackType: "praise",
    category: "performance",
    sentimentScore: 0.2,
    specificityScore: 0.5,
    actionabilityScore: 0.4,
  },

  // ── 10-credit tier: complaint / specific issue ───────────────────────────
  {
    content:
      "The fire icon in the top menu is confusing — I thought it was a delete button. A tooltip would help.",
    feedbackType: "complaint",
    category: "ux",
    sentimentScore: 0.5,
    specificityScore: 0.7,
    actionabilityScore: 0.7,
  },
  {
    content:
      "When I tap Save quickly twice the form submits twice. The button should be disabled after first press.",
    feedbackType: "bug",
    category: "bug",
    sentimentScore: 0.5,
    specificityScore: 0.7,
    actionabilityScore: 0.7,
  },
  {
    content:
      "The font size in the settings panel is too small on mobile. Hard to read without zooming in.",
    feedbackType: "complaint",
    category: "ui_design",
    sentimentScore: 0.5,
    specificityScore: 0.7,
    actionabilityScore: 0.7,
  },
  {
    content:
      "The back button on the detail screen goes to home instead of the previous list. That's unexpected.",
    feedbackType: "bug",
    category: "ux",
    sentimentScore: 0.5,
    specificityScore: 0.7,
    actionabilityScore: 0.7,
  },
  {
    content:
      "Search results don't highlight the matched keyword. Hard to see why a result appeared.",
    feedbackType: "complaint",
    category: "feature",
    sentimentScore: 0.5,
    specificityScore: 0.7,
    actionabilityScore: 0.7,
  },
  {
    content:
      "The loading spinner has no timeout — if network is slow it just spins forever with no message to the user.",
    feedbackType: "bug",
    category: "ux",
    sentimentScore: 0.5,
    specificityScore: 0.7,
    actionabilityScore: 0.7,
  },
  {
    content:
      "Empty state screens show nothing. Even a short 'No items yet' message would greatly improve clarity.",
    feedbackType: "complaint",
    category: "ui_design",
    sentimentScore: 0.5,
    specificityScore: 0.7,
    actionabilityScore: 0.7,
  },
  {
    content:
      "The sidebar collapses on page refresh. Annoying when I'm in a specific view and lose my position.",
    feedbackType: "complaint",
    category: "ux",
    sentimentScore: 0.5,
    specificityScore: 0.7,
    actionabilityScore: 0.7,
  },
  {
    content:
      "Error messages are all identical ('Something went wrong'). No way to tell if it's a network error or a server error.",
    feedbackType: "complaint",
    category: "ux",
    sentimentScore: 0.5,
    specificityScore: 0.7,
    actionabilityScore: 0.7,
  },
  {
    content:
      "The modal closes when I accidentally click outside it and I lose all my input. Please add a confirmation.",
    feedbackType: "complaint",
    category: "ux",
    sentimentScore: 0.5,
    specificityScore: 0.7,
    actionabilityScore: 0.7,
  },
  {
    content:
      "App takes about 4 seconds to load on first visit. Even a skeleton UI would make it feel faster.",
    feedbackType: "complaint",
    category: "performance",
    sentimentScore: 0.5,
    specificityScore: 0.7,
    actionabilityScore: 0.7,
  },

  // ── 15-credit tier: suggestion / actionable ──────────────────────────────
  {
    content:
      "Adding keyboard shortcuts (like Cmd+K for search) would significantly speed up workflow for power users.",
    feedbackType: "suggestion",
    category: "keyboard_shortcuts",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "You should add bulk actions to the list view. Right now I have to delete items one by one — very tedious with 50+ items.",
    feedbackType: "feature_request",
    category: "ux",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "A 'recently viewed' section on the dashboard would save a lot of time. I constantly navigate to the same 3-4 items.",
    feedbackType: "feature_request",
    category: "ux",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "Please add a confirmation dialog before permanently deleting items. I accidentally deleted something I couldn't recover.",
    feedbackType: "suggestion",
    category: "ux",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "The export to CSV is missing date filters. I'd like to export only the last 30 days, not everything.",
    feedbackType: "feature_request",
    category: "feature",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "Notifications don't group by category. My panel gets flooded. Grouping like iOS would be ideal.",
    feedbackType: "suggestion",
    category: "ux",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "Please add drag-and-drop reordering. Having to use up/down arrows for each move is frustrating.",
    feedbackType: "feature_request",
    category: "ux",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "The session expires silently. I only realize I'm logged out when a request fails. Show a 'Session expired' banner instead.",
    feedbackType: "suggestion",
    category: "ux",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "Would love to be able to pin important conversations to the top. Right now older chats get buried.",
    feedbackType: "feature_request",
    category: "feature",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "Please add a 'copy to clipboard' button on code blocks. I find myself manually selecting text every time.",
    feedbackType: "suggestion",
    category: "ux",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "Markdown rendering in the chat is inconsistent — tables render fine but headers sometimes appear as plain text.",
    feedbackType: "bug",
    category: "bug",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },

  // ── 20-credit tier: exceptional / detailed UX analysis ───────────────────
  {
    content:
      "The checkout flow has 5 steps but steps 3 and 4 (address + billing) could be combined into one. Users drop off heavily at step 3 in typical e-commerce patterns. Reducing to 3 steps would likely improve conversion significantly.",
    feedbackType: "suggestion",
    category: "ux",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "The analytics dashboard loads all chart data on mount even when tabs are hidden. Lazy-loading data per tab would cut initial load time by ~60%. Also the chart tooltips disappear too fast on mobile — they need a tap-to-hold interaction.",
    feedbackType: "suggestion",
    category: "analytics",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "Camera permission fires immediately on app open before any context. Most users deny it. Showing the request only when the user first tries to use the camera would dramatically increase accept rates.",
    feedbackType: "suggestion",
    category: "ux",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "Search uses full-text exact matching. Adding fuzzy search (e.g. Fuse.js) would handle typos. Also adding 'Sort by relevance / date / name' would make search much more usable for power users.",
    feedbackType: "feature_request",
    category: "feature",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "Mobile nav has 6 bottom tabs — too many. The last two (Settings, Help) are rarely accessed and could move into a profile menu, freeing space for a more prominent primary action.",
    feedbackType: "suggestion",
    category: "ui_design",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "The image upload flow has no progress indicator. After tapping upload the button just grays out and the user has no idea if it's working. A progress bar reduces abandonment significantly per UX research.",
    feedbackType: "suggestion",
    category: "ux",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "AI responses sometimes cut off mid-sentence with no indication. Adding a 'Response was cut off' message and a 'Continue' button would prevent confusion and make long-form AI interactions much more usable.",
    feedbackType: "suggestion",
    category: "feature",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "The permission request for location access fires with a generic system dialog. Adding a pre-permission screen explaining WHY you need location (e.g. 'to show nearby events') significantly increases user opt-in rates.",
    feedbackType: "suggestion",
    category: "ux",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "Profile pages load a full feed of activity without pagination. On users with >100 entries this causes noticeable jank. Virtual scrolling (react-window) or cursor-based pagination would fix this completely.",
    feedbackType: "suggestion",
    category: "performance",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
  {
    content:
      "Error recovery is non-existent: when a network request fails the UI shows an error but offers no retry button. A simple 'Retry' CTA would recover >80% of transient failures without requiring a full page reload.",
    feedbackType: "suggestion",
    category: "ux",
    sentimentScore: 0.8,
    specificityScore: 0.9,
    actionabilityScore: 0.9,
  },
]

// ─── Main seeder ─────────────────────────────────────────────────────────────

export async function seedPearFeedback() {
  console.log("🍐 Seeding Pear feedback data...")

  try {
    const allApps = await db
      .select({ id: apps.id, slug: apps.slug })
      .from(apps)
      .limit(20)

    if (allApps.length === 0) {
      console.log("⚠️ No apps found — skipping Pear feedback seed")
      return
    }

    // Grab one user to attach as reviewer (optional, can be null)
    const [firstUser] = await db.select({ id: users.id }).from(users).limit(1)

    let inserted = 0
    const TOTAL = 50 // Insert 50 rows spread across apps over the last 30 days

    for (let i = 0; i < TOTAL; i++) {
      const app = pick(allApps)
      const template = pick(FEEDBACK_POOL)

      // Spread timestamps across last 30 days
      const daysBack = Math.random() * 30 // NOSONAR
      const hoursBack = Math.random() * 24 // NOSONAR
      const createdOn = new Date(
        Date.now() -
          daysBack * 24 * 60 * 60 * 1000 -
          hoursBack * 60 * 60 * 1000,
      )

      await db.insert(pearFeedback).values({
        appId: app.id,
        userId: firstUser?.id ?? undefined,
        content: template.content,
        feedbackType: template.feedbackType,
        category: template.category,
        sentimentScore: template.sentimentScore,
        specificityScore: template.specificityScore,
        actionabilityScore: template.actionabilityScore,
        emotionalTags: template.emotionalTags ?? undefined,
        firstImpression: template.firstImpression ?? false,
        status: "reviewed",
        createdOn,
        updatedOn: createdOn,
      })

      inserted++
      console.log(
        `🍐 [${inserted}/${TOTAL}] ${app.slug}: "${template.content.substring(0, 60)}..."`,
      )
    }

    console.log(
      `\n✅ Pear feedback seeding complete! Inserted ${inserted} rows across ${allApps.length} apps.`,
    )
  } catch (error) {
    console.error("❌ Error seeding Pear feedback:", error)
    throw error
  }
}
