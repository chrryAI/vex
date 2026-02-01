import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const AGENTDESC_API = "https://agentdesc.com/api/agents/register"

interface AgentConfig {
  name: string
  description: string
  capabilities: string[]
}

interface AgentDescResponse {
  success: boolean
  agent: {
    id: string
    name: string
    api_key: string
    claim_url: string
    claim_code: string
  }
  important?: string
}

const agents: AgentConfig[] = [
  {
    name: "Sushi",
    description:
      "AI agent specialized in technical research, coding, and system architecture. Expert in TypeScript, React, and full-stack development.",
    capabilities: [
      "research",
      "coding",
      "writing",
      "architecture",
      "debugging",
    ],
  },
  {
    name: "Vex",
    description:
      "AI agent focused on creative problem-solving, content creation, and strategic planning. Excels at communication and documentation.",
    capabilities: ["writing", "research", "planning", "communication"],
  },
  {
    name: "Zarathustra",
    description:
      "AI agent specialized in philosophical reasoning, deep analysis, and complex problem-solving. Expert in abstract thinking and synthesis.",
    capabilities: ["research", "writing", "analysis", "philosophy"],
  },
  {
    name: "Pear",
    description:
      "AI agent focused on feedback analysis, quality validation, and user experience optimization. Expert in evaluating and improving AI applications.",
    capabilities: ["analysis", "writing", "research", "quality-assurance"],
  },
  {
    name: "Vault",
    description:
      "AI agent specialized in financial analytics, expense tracking, and budget management. Expert in data analysis and financial insights.",
    capabilities: ["analysis", "research", "data-processing", "finance"],
  },
  {
    name: "Grape",
    description:
      "AI agent focused on app discovery, curation, and community engagement. Expert in product evaluation and marketplace insights.",
    capabilities: ["research", "writing", "analysis", "curation"],
  },
  {
    name: "Bloom",
    description:
      "AI wellness coach with mood tracking, task management, and focus tools. Expert in holistic health, sustainability, and emotional wellbeing.",
    capabilities: ["wellness", "coaching", "tracking", "sustainability"],
  },
  {
    name: "Chrry",
    description:
      "AI app marketplace platform agent. Expert in app discovery, creation, monetization, and store management. Helps developers build and publish AI applications.",
    capabilities: [
      "app-development",
      "marketplace",
      "monetization",
      "platform",
    ],
  },
  {
    name: "Popcorn",
    description:
      "AI cinematic companion for film analysis and storytelling. Expert in scene analysis, character arcs, cinematic techniques, and visual storytelling. Decodes every frame of iconic films.",
    capabilities: [
      "film-analysis",
      "storytelling",
      "creative",
      "entertainment",
    ],
  },
  {
    name: "Peach",
    description:
      "AI social connection assistant for building meaningful relationships. Expert in social activity planning, personality matching, conversation skills, and event coordination.",
    capabilities: ["social", "networking", "planning", "communication"],
  },
]

async function registerAgent(agent: AgentConfig): Promise<void> {
  try {
    console.log(`\n🤖 Registering ${agent.name}...`)

    const response = await fetch(AGENTDESC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(agent),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    const data: AgentDescResponse = await response.json()

    if (!data.success) {
      throw new Error("Registration failed")
    }

    console.log(`✅ ${agent.name} registered successfully!`)
    console.log(`   ID: ${data.agent.id}`)
    console.log(`   API Key: ${data.agent.api_key}`)
    console.log(`   Claim URL: ${data.agent.claim_url}`)
    console.log(`   Claim Code: ${data.agent.claim_code}`)

    // Save credentials
    const configDir = join(homedir(), ".config", "agentdesc")
    mkdirSync(configDir, { recursive: true })

    const credentialsPath = join(
      configDir,
      `${agent.name.toLowerCase()}-credentials.json`,
    )
    writeFileSync(
      credentialsPath,
      JSON.stringify(
        {
          agent: data.agent,
          registered_at: new Date().toISOString(),
        },
        null,
        2,
      ),
    )

    console.log(`💾 Credentials saved to: ${credentialsPath}`)
    console.log(
      `\n⚠️  IMPORTANT: Send this claim URL to the human owner:\n   ${data.agent.claim_url}\n`,
    )
  } catch (error) {
    console.error(`❌ Failed to register ${agent.name}:`, error)
    throw error
  }
}

async function main() {
  console.log("🚀 AgentDesc Registration Script")
  console.log("=".repeat(50))

  for (const agent of agents) {
    try {
      await registerAgent(agent)
      // Wait 1 second between registrations to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`Failed to register ${agent.name}, continuing...`)
    }
  }

  console.log("\n" + "=".repeat(50))
  console.log("✅ Registration complete!")
  console.log(
    "\nNext steps:\n1. Check ~/.config/agentdesc/ for credentials\n2. Send claim URLs to human owners\n3. Start browsing tasks: GET /api/tasks",
  )
}

main().catch(console.error)
