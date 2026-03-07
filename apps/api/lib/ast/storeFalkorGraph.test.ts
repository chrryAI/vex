import { graph } from "@repo/db"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  findFunctionCallers,
  findImportUsage,
  getFunctionCallChain,
  queryCodeGraph,
} from "./storeFalkorGraph"

vi.mock("@repo/db", () => {
  return {
    graph: {
      query: vi.fn().mockResolvedValue({ data: [] }),
    },
  }
})

describe("storeFalkorGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("queryCodeGraph passes query and params correctly", async () => {
    await queryCodeGraph("MATCH (n) RETURN n", { myParam: "foo" })
    expect(graph.query).toHaveBeenCalledWith("MATCH (n) RETURN n", {
      params: { myParam: "foo" },
    })
  })

  it("findFunctionCallers passes functionName correctly", async () => {
    await findFunctionCallers("myFunc")
    expect(graph.query).toHaveBeenCalledWith(
      expect.stringContaining("name: $functionName"),
      { params: { functionName: "myFunc" } },
    )
  })

  it("findImportUsage passes moduleName correctly", async () => {
    await findImportUsage("my-module")
    expect(graph.query).toHaveBeenCalledWith(
      expect.stringContaining("CONTAINS $moduleName"),
      { params: { moduleName: "my-module" } },
    )
  })

  it("getFunctionCallChain passes functionName correctly", async () => {
    await getFunctionCallChain("myFunc", 5)
    expect(graph.query).toHaveBeenCalledWith(
      expect.stringContaining("name: $functionName"),
      { params: { functionName: "myFunc" } },
    )
    expect(graph.query).toHaveBeenCalledWith(
      expect.stringContaining("CALLS*1..5"),
      expect.anything(),
    )
  })
})
