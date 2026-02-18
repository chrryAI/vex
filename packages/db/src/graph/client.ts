import { FalkorDB } from "falkordb"

const FALKORDB_HOST = process.env.FALKORDB_HOST || "localhost"
const FALKORDB_PORT = Number.parseInt(process.env.FALKORDB_PORT || "6379", 10)

// Initialize FalkorDB connection
// Note: In production, you might want to reuse a connection from a pool or similar
// using top-level await as FalkorDB requires async connection and we are in ESM/Bun environment
export const falkor = await FalkorDB.connect({
  socket: {
    host: FALKORDB_HOST,
    port: FALKORDB_PORT,
  },
})

// Select the 'Vex' graph
export const graph = falkor.selectGraph("Vex")

export async function checkGraphConnection() {
  try {
    // Connection is established at module load, verify it works
    await falkor.info()
    console.log(`✅ Connected to FalkorDB at ${FALKORDB_HOST}:${FALKORDB_PORT}`)
    return true
  } catch (error) {
    console.error("❌ Failed to connect to FalkorDB:", error)
    return false
  }
}
