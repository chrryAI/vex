import Parser from "rss-parser"
import { db, eq, and, desc, sql, cosineDistance } from "@repo/db"
import { newsArticles } from "@repo/db/src/schema"
import { embed } from "ai"
import { getEmbeddingProvider } from "./getModelProvider"
import { asc } from "drizzle-orm"

const parser = new Parser()

/**
 * News sources configuration
 */
const NEWS_SOURCES = {
  cnn: {
    name: "CNN",
    feeds: [
      { url: "http://rss.cnn.com/rss/cnn_topstories.rss", category: "top" },
      { url: "http://rss.cnn.com/rss/cnn_world.rss", category: "world" },
      { url: "http://rss.cnn.com/rss/cnn_us.rss", category: "us" },
      { url: "http://rss.cnn.com/rss/cnn_tech.rss", category: "tech" },
      { url: "http://rss.cnn.com/rss/money_latest.rss", category: "business" },
    ],
  },
  bloomberg: {
    name: "Bloomberg",
    feeds: [
      {
        url: "https://www.bloomberg.com/feed/podcast/etf-iq.xml",
        category: "finance",
      },
    ],
  },
  techcrunch: {
    name: "TechCrunch",
    feeds: [{ url: "https://techcrunch.com/feed/", category: "tech" }],
  },
  // nyt: {
  //   name: "New York Times",
  //   feeds: [
  //     {
  //       url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  //       category: "top",
  //     },
  //     {
  //       url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
  //       category: "world",
  //     },
  //     {
  //       url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
  //       category: "tech",
  //     },
  //   ],
  // },
}

/**
 * Generate embedding for text
 */
async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const provider = await getEmbeddingProvider()
    const { embedding } = await embed({
      model: provider.embedding("text-embedding-3-small"),
      value: text,
    })
    return embedding
  } catch (error) {
    console.error("❌ Error generating embedding:", error)
    return null
  }
}

/**
 * Fetch news from a single RSS feed
 */
async function fetchFeed(
  source: string,
  feedUrl: string,
  category: string,
): Promise<void> {
  try {
    const feed = await parser.parseURL(feedUrl)
    const validItems = feed.items.filter((item) => item.link && item.title)

    // Process in batches of 5 to avoid rate limits
    const BATCH_SIZE = 5
    for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
      const batch = validItems.slice(i, i + BATCH_SIZE)

      await Promise.all(
        batch.map(async (item) => {
          try {
            if (!item.link || !item.title) return

            // Check if article already exists
            const existing = await db
              .select()
              .from(newsArticles)
              .where(
                and(
                  eq(newsArticles.source, source),
                  eq(newsArticles.sourceUrl, item.link),
                ),
              )
              .limit(1)

            if (existing.length > 0) return

            // Generate embedding
            const contentText =
              `${item.title || ""} ${item.contentSnippet || item.content || ""} ${item.categories?.join(" ") || ""}`.trim()
            const embedding = await getEmbedding(contentText)

            // Insert new article
            await db.insert(newsArticles).values({
              source,
              sourceUrl: item.link,
              title: item.title,
              description: item.contentSnippet || item.content || null,
              content: item.content || null,
              author: item.creator || null,
              category,
              tags: item.categories || [],
              imageUrl: item.enclosure?.url || null,
              publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
              fetchedAt: new Date(),
              embedding,
            })

            console.log(`✅ Fetched: ${source} - ${item.title}`)
          } catch (err) {
            console.error(
              `❌ Error processing item ${item.title} from ${source}:`,
              err,
            )
          }
        }),
      )
    }
  } catch (error) {
    console.error(`❌ Error fetching ${source} feed:`, error)
  }
}

/**
 * Fetch all news from all sources
 */
export async function fetchAllNews(): Promise<void> {
  console.log("🗞️ Starting news fetch...")

  for (const [sourceKey, sourceConfig] of Object.entries(NEWS_SOURCES)) {
    console.log(`📰 Fetching ${sourceConfig.name}...`)

    for (const feed of sourceConfig.feeds) {
      await fetchFeed(sourceKey, feed.url, feed.category)
    }
  }

  console.log("✅ News fetch complete!")
}

/**
 * Get latest news by source (only recent articles from last 7 days)
 */
export async function getNewsBySource(
  source: string,
  limit: number = 20,
): Promise<any[]> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  return await db
    .select()
    .from(newsArticles)
    .where(
      and(
        eq(newsArticles.source, source),
        sql`${newsArticles.publishedAt} >= ${sevenDaysAgoISO}`,
      ),
    )
    .orderBy(desc(newsArticles.publishedAt))
    .limit(limit)
}

/**
 * Get latest news by category
 */
export async function getNewsByCategory(
  category: string,
  limit: number = 20,
): Promise<any[]> {
  return await db
    .select()
    .from(newsArticles)
    .where(eq(newsArticles.category, category))
    .orderBy(desc(newsArticles.publishedAt))
    .limit(limit)
}

/**
 * Get latest news (all sources, only recent articles from last 7 days)
 */
export async function getLatestNews(limit: number = 50): Promise<any[]> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  return await db
    .select()
    .from(newsArticles)
    .where(sql`${newsArticles.publishedAt} >= ${sevenDaysAgoISO}`)
    .orderBy(desc(newsArticles.publishedAt))
    .limit(limit)
}

/**
 * Search news by query
 */
export async function searchNews(
  query: string,
  limit: number = 20,
): Promise<any[]> {
  // Vector search with embeddings
  const embedding = await getEmbedding(query)

  if (embedding) {
    return await db
      .select()
      .from(newsArticles)
      .orderBy(asc(cosineDistance(newsArticles.embedding, embedding)))
      .limit(limit)
  }

  // Fallback: simple text search
  return await db
    .select()
    .from(newsArticles)
    .where(
      // @ts-ignore - SQL LIKE search
      sql`${newsArticles.title} ILIKE ${"%" + query + "%"} OR ${newsArticles.description} ILIKE ${"%" + query + "%"}`,
    )
    .orderBy(desc(newsArticles.publishedAt))
    .limit(limit)
}

/**
 * Increment view count
 */
export async function incrementViewCount(articleId: string): Promise<void> {
  await db
    .update(newsArticles)
    .set({
      viewCount: sql`${newsArticles.viewCount} + 1`,
    })
    .where(eq(newsArticles.id, articleId))
}
