import { readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const AGENTDESC_API = "https://agentdesc.com/api"

interface Task {
  id: string
  title: string
  description: string
  budget: number
  category: string
  status: string
  created_at: string
}

interface Credentials {
  agent: {
    id: string
    name: string
    api_key: string
  }
}

async function loadCredentials(agentName: string): Promise<Credentials> {
  const configDir = join(homedir(), ".config", "agentdesc")
  const credentialsPath = join(
    configDir,
    `${agentName.toLowerCase()}-credentials.json`,
  )

  try {
    const data = readFileSync(credentialsPath, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    throw new Error(
      `Failed to load credentials for ${agentName}. Run register-agentdesc.ts first.`,
    )
  }
}

async function getTasks(
  apiKey: string,
  filters?: {
    category?: string
    status?: string
  },
): Promise<Task[]> {
  const params = new URLSearchParams()
  if (filters?.category) params.set("category", filters.category)
  if (filters?.status) params.set("status", filters.status)

  const url = `${AGENTDESC_API}/tasks${params.toString() ? `?${params}` : ""}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  return data.tasks || []
}

async function getTaskDetails(apiKey: string, taskId: string): Promise<any> {
  const response = await fetch(`${AGENTDESC_API}/tasks/${taskId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }

  return await response.json()
}

async function claimTask(apiKey: string, taskId: string): Promise<void> {
  const response = await fetch(`${AGENTDESC_API}/tasks/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ taskId }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }

  const text = await response.text()
  try {
    const data = text ? JSON.parse(text) : {}
    console.log(`✅ Task claimed successfully:`, data)
  } catch {
    console.log(`✅ Task claimed successfully`)
  }
}

async function main() {
  const agentName = process.argv[2] || "sushi"
  const action = process.argv[3] || "list"

  console.log(`🤖 AgentDesc Task Manager - ${agentName}`)
  console.log("=".repeat(50))

  const credentials = await loadCredentials(agentName)
  const apiKey = credentials.agent.api_key

  if (action === "list") {
    console.log("\n📋 Fetching available tasks...")
    const tasks = await getTasks(apiKey, { status: "open" })

    if (tasks.length === 0) {
      console.log("No tasks available at the moment.")
      return
    }

    console.log(`\nFound ${tasks.length} tasks:\n`)
    tasks.forEach((task, i) => {
      console.log(`${i + 1}. [${task.category}] ${task.title}`)
      console.log(`   Budget: $${task.budget}`)
      console.log(`   ID: ${task.id}`)
      if (task.description) {
        console.log(`   ${task.description.substring(0, 100)}...`)
      }
      console.log()
    })
  } else if (action === "details") {
    const taskId = process.argv[4]
    if (!taskId) {
      console.error("❌ Please provide a task ID")
      console.log("Usage: bun run agentdesc-tasks.ts <agent> details <taskId>")
      process.exit(1)
    }

    console.log(`\n📄 Fetching task details for ${taskId}...`)
    const taskDetails = await getTaskDetails(apiKey, taskId)
    console.log("\n" + JSON.stringify(taskDetails, null, 2))
  } else if (action === "claim") {
    const taskId = process.argv[4]
    if (!taskId) {
      console.error("❌ Please provide a task ID to claim")
      console.log("Usage: bun run agentdesc-tasks.ts <agent> claim <taskId>")
      process.exit(1)
    }

    console.log(`\n🎯 Claiming task ${taskId}...`)
    await claimTask(apiKey, taskId)
  } else {
    console.log("Usage:")
    console.log("  List tasks:    bun run agentdesc-tasks.ts <agent> list")
    console.log(
      "  Task details:  bun run agentdesc-tasks.ts <agent> details <taskId>",
    )
    console.log(
      "  Claim task:    bun run agentdesc-tasks.ts <agent> claim <taskId>",
    )
    console.log(
      "\nAgents: sushi, vex, zarathustra, pear, vault, grape, bloom, chrry, popcorn, peach",
    )
  }
}

main().catch(console.error)
