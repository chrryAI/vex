
import { describe, it, expect, vi, afterAll } from "vitest";

// Mock dependencies BEFORE importing the module under test
vi.mock("sharp", () => {
  return {
    default: () => ({
      metadata: async () => ({ width: 100, height: 100 }),
      resize: () => ({
        toBuffer: async () => Buffer.from("resized"),
      }),
    }),
  };
});

vi.mock("../../lib/minio", () => ({
  upload: async () => ({ url: "http://minio/uploaded" }),
}));

// We need to export validateUrl as well since it might be used
vi.mock("../../utils/ssrf", () => ({
  getSafeUrl: async (url: string) => {
    if (url.includes("private")) {
      throw new Error("Access to private IP denied");
    }
    return { safeUrl: url, originalHost: "example.com" };
  },
  validateUrl: async (url: string) => {
     if (url.includes("private")) {
      throw new Error("Access to private IP denied");
    }
  }
}));

// Import after mocks
import { resize } from "./resize";

describe("GET /resize SSRF Protection", () => {
  const originalFetch = global.fetch;

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("should throw error when too many redirects occur", async () => {
    // Mock global fetch to always redirect
    global.fetch = vi.fn(async () => {
      return new Response(null, {
        status: 302,
        headers: { Location: "http://example.com/redirect" },
      });
    });

    const req = new Request("http://localhost/?url=http://example.com&w=100");
    const res = await resize.fetch(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch image: Too many redirects");
  });

  it("should fail if redirect target is blocked by getSafeUrl", async () => {
    // Mock fetch to redirect to a "private" url
    global.fetch = vi.fn(async (req) => {
      // Handle both Request object and URL string
      // @ts-ignore
      const url = typeof req === 'string' ? req : req.url;

      // If we are fetching the initial URL (not private)
      if (!url.includes("private")) {
         return new Response(null, {
          status: 302,
          headers: { Location: "http://example.com/private" },
        });
      }
      return new Response("ok");
    });

    const req = new Request("http://localhost/?url=http://example.com/initial&w=100");
    const res = await resize.fetch(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch image: Requested URL is not allowed");
  });
});
