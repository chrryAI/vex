#!/usr/bin/env node

/**
 * AI-Powered Commit Message Generator
 * Analyzes git diff and generates a meaningful commit message using OpenAI
 */

const { execSync } = require("node:child_process")
const fs = require("fs")
const path = require("node:path")
const OpenAI = require("openai").default

// Load .env file
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env")
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8")
    envContent.split("\n").forEach((line) => {
      const match = line.match(/^([^=:#]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim().replace(/^["']|["']$/g, "")
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    })
  }
}

loadEnv()

async function generateCommitMessage() {
  try {
    // Get staged changes
    const diff = execSync("git diff --cached --stat", { encoding: "utf-8" })
    const diffDetails = execSync("git diff --cached", {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 10,
    })

    if (!diff.trim()) {
      console.error("No staged changes found.")
      process.exit(0)
    }

    console.error("📊 Analyzing changes...\n")
    console.error(diff)

    // Check for DeepSeek API key (fallback to OpenAI)
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
    const baseURL = process.env.DEEPSEEK_API_KEY
      ? "https://api.deepseek.com"
      : undefined

    if (!apiKey) {
      console.error("⚠️  DEEPSEEK_API_KEY or OPENAI_API_KEY not found in .env.")
      console.error(
        "💡 Add DEEPSEEK_API_KEY to .env for AI-generated messages.",
      )
      console.error("   Get your key at: https://platform.deepseek.com/")
      return "🚀"
    }

    const openai = new OpenAI({
      apiKey,
      baseURL,
    })

    console.error(`🤖 Using ${baseURL ? "DeepSeek" : "OpenAI"}...`)

    // Generate commit message using AI
    const response = await openai.chat.completions.create({
      model: process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a commit message generator. Analyze git diffs and generate concise, meaningful commit messages.

Rules:
- Use conventional commits format when appropriate (feat:, fix:, refactor:, etc.)
- Be specific but concise (max 72 characters for title)
- Focus on WHAT changed and WHY, not HOW
- Use present tense ("Add feature" not "Added feature")
- Start with an emoji if it adds clarity (🎨 style, 🐛 fix, ✨ feature, 📝 docs, ♻️ refactor, ⚡️ perf, 🔧 config)
- If changes are minor/unclear, just return "🚀" as a fun placeholder

Examples:
- "✨ Add multi-size image optimization for PWA icons"
- "🐛 Fix favicon not updating on app switch"
- "♻️ Refactor Image component with smart size selection"
- "🎨 Update metadata with proper icon sizes"
- "🚀" (for minor/experimental changes)`,
        },
        {
          role: "user",
          content: `Generate a commit message for these changes:\n\nFiles changed:\n${diff}\n\nDiff preview (first 3000 chars):\n${diffDetails.slice(0, 3000)}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    })

    const message = response.choices[0].message.content.trim()
    console.error("\n✨ Generated commit message:")
    console.error(`   "${message}"`)
    console.error(`\n🔍 Debug: Model used: ${response.model}`)
    console.error(`🔍 Debug: Tokens: ${response.usage?.total_tokens || "N/A"}`)

    return message
  } catch (error) {
    console.error("❌ Error generating commit message:", error.message)
    console.error("🔍 Full error:", error)
    return "🚀"
  }
}

// Run if called directly
if (require.main === module) {
  generateCommitMessage().then((message) => {
    console.log(message)
  })
}

module.exports = { generateCommitMessage }
