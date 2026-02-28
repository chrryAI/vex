import { describe, expect, it } from "vitest"
import { getJulesPayload, julesInstructions, julesSystemPrompt } from "./jules"

describe("Jules App Configuration", () => {
  it("should have a valid system prompt", () => {
    expect(julesSystemPrompt).toContain("Jules")
    expect(julesSystemPrompt).toContain("Architect Coder & Debugger")
    expect(julesSystemPrompt.length).toBeGreaterThan(100)
  })

  it("should have valid instructions", () => {
    expect(julesInstructions).toHaveLength(5)
    expect(julesInstructions[0]!.title).toBe("Deep Planning & Architecture")
    expect(julesInstructions[0]!.emoji).toBe("🏗️")
  })

  it("should generate a valid payload", () => {
    const payload = getJulesPayload({
      userId: "user-123",
      storeId: "store-456",
      parentAppIds: ["app-789", "app-abc"],
    })

    expect(payload.userId).toBe("user-123")
    expect(payload.storeId).toBe("store-456")
    expect(payload.extends).toEqual(["app-789", "app-abc"])
    expect(payload.slug).toBe("jules")
    expect(payload.name).toBe("Jules")
    expect(payload.defaultModel).toBe("gemini")
    expect(payload.features.deepPlanning).toBe(true)
    expect(payload.systemPrompt).toBe(julesSystemPrompt)
    expect(payload.highlights).toBe(julesInstructions)
  })
})
