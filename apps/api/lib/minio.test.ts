import { describe, it, expect, vi, beforeEach } from "vitest"

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

// Import after mocks and env setup
import { upload } from "./minio"

describe("upload", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should fail when inferred type does not match strict type option", async () => {
    // Mock fetch to return a text file
    global.fetch = vi.fn(async () => {
      return new Response("<html>script</html>", {
        headers: { "Content-Type": "text/html" },
      })
    })

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
    // Mock fetch to return an image file
    global.fetch = vi.fn(async () => {
      return new Response("image", {
        headers: { "Content-Type": "image/png" },
      })
    })

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
    // Mock fetch to return an image
    global.fetch = vi.fn(async () => {
      // Return valid image buffer
      const buffer = Buffer.from("fake-image")
      return new Response(buffer, {
        headers: { "Content-Type": "image/png" },
      })
    })

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
})
