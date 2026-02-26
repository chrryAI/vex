import { beforeEach, describe, expect, it, vi } from "vitest"

// Set env vars before importing minio
process.env.S3_ENDPOINT = "https://minio.chrry.dev"
process.env.S3_ACCESS_KEY_ID = "test"
process.env.S3_SECRET_ACCESS_KEY = "test"

// Mock S3Client and commands
vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    send = vi.fn()
  }
  return {
    S3Client,
    DeleteObjectCommand: vi.fn(),
    CreateBucketCommand: vi.fn(),
    HeadBucketCommand: vi.fn(),
    PutBucketPolicyCommand: vi.fn(),
  }
})

// Mock Upload
vi.mock("@aws-sdk/lib-storage", () => {
  class Upload {
    done = vi.fn()
  }
  return {
    Upload,
  }
})

// Mock FetchHttpHandler
vi.mock("@smithy/fetch-http-handler", () => {
  class FetchHttpHandler {}
  return {
    FetchHttpHandler,
  }
})

// Mock captureException
vi.mock("./captureException", () => ({
  default: vi.fn(),
}))

// Mock sharp
vi.mock("sharp", () => {
  return {
    default: () => ({
      metadata: async () => ({ width: 100, height: 100 }),
      resize: () => ({
        toBuffer: async () => Buffer.from("resized"),
        metadata: async () => ({ width: 50, height: 50 }),
        png: () => ({
          toBuffer: async () => Buffer.from("resized-png"),
        }),
      }),
      png: () => ({
        toBuffer: async () => Buffer.from("original-png"),
      }),
    }),
  }
})

// Mock dns
vi.mock("dns", () => ({
  default: {
    promises: {
      lookup: async () => [{ address: "1.1.1.1" }],
    },
  },
  promises: {
    lookup: async () => [{ address: "1.1.1.1" }],
  },
}))

// Mock net
vi.mock("net", () => ({
  default: {
    isIPv4: () => true,
    isIPv6: () => false,
  },
  isIPv4: () => true,
  isIPv6: () => false,
}))

// Mock tldts
vi.mock("tldts", () => ({
  parse: () => ({ domain: "chrry.dev" }),
}))

// Mock utils
vi.mock("@chrryai/chrry/utils", () => ({
  isDevelopment: false,
}))

// Mock safeFetch
vi.mock("../utils/ssrf", () => ({
  safeFetch: vi.fn(),
}))

// Import after mocks and env setup
import { safeFetch } from "../utils/ssrf"
import { upload } from "./minio"

describe("upload", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should fail when inferred type does not match strict type option", async () => {
    // Mock safeFetch to return a text file
    vi.mocked(safeFetch).mockResolvedValue(
      new Response("<html>script</html>", {
        headers: { "Content-Type": "text/html" },
      }),
    )

    await expect(
      upload({
        url: "https://minio.chrry.dev/malicious.html",
        messageId: "test",
        options: {
          type: "image", // Strict type enforcement
        },
      }),
    ).rejects.toThrow("Invalid file type: expected image, got text")
  })

  it("should fail when inferred type is image but expected text", async () => {
    // Mock safeFetch to return an image file
    vi.mocked(safeFetch).mockResolvedValue(
      new Response("image", {
        headers: { "Content-Type": "image/png" },
      }),
    )

    await expect(
      upload({
        url: "https://minio.chrry.dev/test.png",
        messageId: "test",
        options: {
          type: "text", // Strict type enforcement
        },
      }),
    ).rejects.toThrow("Invalid file type: expected text, got image")
  })

  it("should succeed when type matches", async () => {
    // Mock safeFetch to return an image
    vi.mocked(safeFetch).mockResolvedValue(
      new Response(Buffer.from("fake-image"), {
        headers: { "Content-Type": "image/png" },
      }),
    )

    await expect(
      upload({
        url: "https://minio.chrry.dev/image.png",
        messageId: "test",
        options: {
          type: "image",
        },
      }),
    ).resolves.toBeDefined()
  })

  it("should succeed with data URL", async () => {
    // Mock global fetch for data URL
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(Buffer.from("fake-image"), {
        headers: { "Content-Type": "image/png" },
      }),
    )

    await expect(
      upload({
        url: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
        messageId: "test",
        options: {
          type: "image",
        },
      }),
    ).resolves.toBeDefined()

    expect(safeFetch).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalled()
  })
})
