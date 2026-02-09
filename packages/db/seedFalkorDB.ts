/**
 * Seed FalkorDB with data from PostgreSQL
 * Run this script to populate the graph database with stores, apps, and ecosystem data
 */

import { graph } from "./src/graph/client"
import { db } from "./index"

async function seedFalkorDB() {
  console.log("🌱 Starting FalkorDB seeding...\n")
  console.log("🍒 FalkorDB initialized (chrry_ecosystem graph)\n")
}

/**
 * Seed all stores to FalkorDB
 */
export async function seedStoresToFalkorDB() {
  if (!db) throw new Error("PostgreSQL DB not initialized")

  console.log("═══════════════════════════════════════════════════════")
  console.log("        🍒 SEEDING CHRRY STORES TO FALKORDB           ")
  console.log("═══════════════════════════════════════════════════════\n")

  // Get all stores from PostgreSQL
  const storesResult = await db
    .select()
    .from((await import("./src/schema")).stores)
  console.log(`📦 Found ${storesResult.length} stores in PostgreSQL\n`)

  // Seed each store
  for (const storeData of storesResult) {
    console.log(`📦 Seeding store: ${storeData.name} (${storeData.slug})`)

    await graph.query(
      `
      MERGE (store:Store {id: $id})
      SET store.slug = $slug,
          store.name = $name,
          store.title = $title,
          store.description = $description
    `,
      {
        params: {
          id: storeData.id,
          slug: storeData.slug,
          name: storeData.name,
          title: storeData.title ?? null,
          description: storeData.description ?? null,
        },
      },
    )

    console.log(`   ✅ Store ${storeData.name} synced to FalkorDB`)
  }

  console.log(`\n✅ Seeded ${storesResult.length} stores to FalkorDB\n`)
}

/**
 * Seed all apps to FalkorDB
 */
export async function seedAppsToFalkorDB() {
  if (!db) throw new Error("PostgreSQL DB not initialized")

  console.log("═══════════════════════════════════════════════════════")
  console.log("         🍒 SEEDING CHRRY APPS TO FALKORDB            ")
  console.log("═══════════════════════════════════════════════════════\n")

  // Get all apps from PostgreSQL
  const appsResult = await db.select().from((await import("./src/schema")).apps)
  console.log(`🤖 Found ${appsResult.length} apps in PostgreSQL\n`)

  // Seed each app
  for (const appData of appsResult) {
    console.log(`🤖 Seeding app: ${appData.name} (${appData.slug})`)

    await graph.query(
      `
      MERGE (app:App {id: $id})
      SET app.slug = $slug,
          app.name = $name,
          app.title = $title,
          app.subtitle = $subtitle,
          app.description = $description,
          app.systemPrompt = $systemPrompt,
          app.placeholder = $placeholder,
          app.visibility = $visibility,
          app.status = $status,
          app.themeColor = $themeColor,
          app.backgroundColor = $backgroundColor,
          app.icon = $icon,
          app.version = $version,
          app.userId = $userId,
          app.storeId = $storeId
    `,
      {
        params: {
          id: appData.id,
          slug: appData.slug,
          name: appData.name,
          title: appData.title ?? null,
          subtitle: appData.subtitle ?? null,
          description: appData.description ?? null,
          systemPrompt: appData.systemPrompt ?? null,
          placeholder: appData.placeholder ?? null,
          visibility: appData.visibility ?? "public",
          status: appData.status ?? "active",
          themeColor: appData.themeColor ?? null,
          backgroundColor: appData.backgroundColor ?? null,
          icon: appData.icon ?? null,
          version: appData.version ?? "1.0.0",
          userId: appData.userId ?? null,
          storeId: appData.storeId ?? null,
        },
      },
    )

    // Create relationship: App belongs to Store
    if (appData.storeId) {
      await graph.query(
        `
        MATCH (app:App {id: $appId})
        MATCH (store:Store {id: $storeId})
        MERGE (app)-[:BELONGS_TO]->(store)
      `,
        {
          params: {
            appId: appData.id,
            storeId: appData.storeId,
          },
        },
      )
    }

    // Create relationship: User owns App
    if (appData.userId) {
      await graph.query(
        `
        MATCH (app:App {id: $appId})
        MERGE (user:User {id: $userId})
        MERGE (user)-[:OWNS]->(app)
      `,
        {
          params: {
            appId: appData.id,
            userId: appData.userId,
          },
        },
      )
    }

    console.log(`   ✅ App ${appData.name} synced to FalkorDB`)
  }

  console.log(`\n✅ Seeded ${appsResult.length} apps to FalkorDB\n`)
}

/**
 * Seed LifeOS ecosystem connections
 */
export async function seedEcosystemToFalkorDB() {
  console.log("═══════════════════════════════════════════════════════")
  console.log("       🌍 SEEDING LIFEOS ECOSYSTEM TO FALKORDB        ")
  console.log("═══════════════════════════════════════════════════════\n")

  // Create LifeOS ecosystem node
  await graph.query(`
    MERGE (lifeos:Ecosystem {id: 'lifeos'})
    SET lifeos.name = 'LifeOS',
        lifeos.description = 'Suite of specialized AI agents and apps',
        lifeos.url = 'https://chrry.ai'
  `)

  // Connect all stores to LifeOS
  await graph.query(`
    MATCH (lifeos:Ecosystem {id: 'lifeos'})
    MATCH (store:Store)
    MERGE (store)-[:PART_OF]->(lifeos)
  `)

  console.log("   ✅ LifeOS ecosystem created and connected\n")
}

/**
 * Full seed: Stores + Apps + Ecosystem
 */
export async function seedChrryToFalkorDB() {
  await seedStoresToFalkorDB()
  await seedAppsToFalkorDB()
  await seedEcosystemToFalkorDB()

  console.log("═══════════════════════════════════════════════════════")
  console.log("          ✅ CHRRY ECOSYSTEM SEEDING COMPLETE!         ")
  console.log("═══════════════════════════════════════════════════════\n")
}

/**
 * Get overview of seeded data
 */
export async function getFalkorDBOverview() {
  console.log("\n📊 FALKORDB OVERVIEW\n")

  // Count stores
  const storeCount = (await graph.query(`
    MATCH (store:Store)
    RETURN COUNT(store) as count
  `)) as any
  console.log(`📦 Stores: ${storeCount?.data?.[0]?.count || 0}`)

  // Count apps
  const appCount = (await graph.query(`
    MATCH (app:App)
    RETURN COUNT(app) as count
  `)) as any
  console.log(`🤖 Apps: ${appCount?.data?.[0]?.count || 0}`)

  // Count relationships
  const relCount = (await graph.query(`
    MATCH ()-[r]->()
    RETURN COUNT(r) as count
  `)) as any
  console.log(`🔗 Relationships: ${relCount?.data?.[0]?.count || 0}`)

  // List stores
  const stores = await graph.query(`
    MATCH (store:Store)
    RETURN store.icon as icon, store.name as name, store.slug as slug
    ORDER BY store.name
  `)

  console.log(`\n📦 Stores:`)
  if (stores && stores.data) {
    for (const store of stores.data as any[]) {
      console.log(`   ${store.icon || "📦"} ${store.name} (${store.slug})`)
    }
  }

  console.log()
}

/**
 * Close FalkorDB connection
 * Note: Connection is managed by src/graph/client, no need to close manually
 */
export async function closeFalkorDB() {
  // Connection managed by shared graph client
  console.log("FalkorDB connection managed by src/graph/client")
}

// CLI usage
async function main() {
  await seedChrryToFalkorDB()
  await getFalkorDBOverview()
  // Connection managed by shared graph client, no need to close
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
