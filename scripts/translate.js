const fs = require("fs")
const path = require("path")
const dotenv = require("dotenv")
dotenv.config()
const OpenAI = require("openai")

const openai = new OpenAI({
  apiKey: process.env.CHATGPT_API_TRANSLATE_KEY,
})

async function main() {
  const enPath = path.join(__dirname, "../packages/ui/locales/en.json")
  const en = JSON.parse(fs.readFileSync(enPath, "utf8"))

  const languages = ["de", "fr", "es", "ja", "ko", "pt", "zh", "nl", "tr"]

  for (const lang of languages) {
    try {
      const transPath = path.join(
        __dirname,
        `../packages/ui/locales/${lang}.json`,
      )

      // Initialize if file doesn't exist or is empty
      if (!fs.existsSync(transPath)) {
        fs.writeFileSync(transPath, "{}")
      }

      const fileContent = fs.readFileSync(transPath, "utf8")
      let existing = {}
      try {
        existing = JSON.parse(fileContent)
      } catch (parseError) {
        // If the file is not valid JSON, reset it to an empty object
        console.error(
          `Error parsing ${lang}.json: ${parseError.message}. Resetting to empty object.`,
        )
        existing = {}
      }

      const missing = Object.keys(en).filter((k) => !existing[k])

      if (missing.length === 0) {
        console.log(`${lang}.json is complete`)
        continue
      }

      // Translate missing keys using OpenAI
      const CHUNK_SIZE = 20 // Smaller chunks for better context
      for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
        const chunk = missing.slice(i, i + CHUNK_SIZE)
        const textsToTranslate = {}
        chunk.forEach((key) => {
          textsToTranslate[key] = en[key]
        })

        const prompt = `Translate these UI strings for a personal AI assistant app called "Vex" to ${lang}.

IMPORTANT RULES:
- Never translate the word "Vex" - it's the product name
- Keep technical terms consistent (API, AI, etc.)
- Maintain friendly, professional tone
- Preserve any HTML tags or special formatting
- Return ONLY valid JSON with the same keys

Strings to translate:
${JSON.stringify(textsToTranslate, null, 2)}

Return the translations as JSON:`

        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 4000,
          })

          const translatedData = JSON.parse(response.choices[0].message.content)

          Object.keys(translatedData).forEach((key) => {
            existing[key] = translatedData[key]
          })

          // Save after each chunk to prevent data loss
          fs.writeFileSync(transPath, JSON.stringify(existing, null, 2))

          console.log(
            `Translated chunk ${Math.floor(i / CHUNK_SIZE) + 1} for ${lang}`,
          )

          // Small delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (error) {
          console.error(`Error translating chunk for ${lang}:`, error.message)
          // Continue with next chunk instead of failing completely
        }
      }

      console.log(`Translated and added ${missing.length} keys to ${lang}.json`)
    } catch (e) {
      console.log(`Could not update ${lang}: ${e.message}`)
    }
  }
}

main().catch(console.error)
