const fs = require('fs');

let rateLimitingTest = fs.readFileSync('apps/api/test/lib_rate_limiting.test.ts', 'utf8');

// Replace arcjet stuff with Redis mocks
rateLimitingTest = rateLimitingTest.replace(
  'vi.mock("@arcjet/node", () => ({\n  default: () => ({\n    protect: protectMock,\n  }),\n  slidingWindow: () => ({}),\n}))',
  `
const { zremrangebyscoreMock, zaddMock, zcardMock, expireMock, execMock, pipelineMock } = vi.hoisted(() => {
  const zremrangebyscoreMock = vi.fn().mockReturnThis();
  const zaddMock = vi.fn().mockReturnThis();
  const zcardMock = vi.fn().mockReturnThis();
  const expireMock = vi.fn().mockReturnThis();
  const execMock = vi.fn().mockResolvedValue([null, null, 5]);
  const pipelineMock = vi.fn().mockReturnValue({
    zremrangebyscore: zremrangebyscoreMock,
    zadd: zaddMock,
    zcard: zcardMock,
    expire: expireMock,
    exec: execMock,
  });
  return { zremrangebyscoreMock, zaddMock, zcardMock, expireMock, execMock, pipelineMock };
});

vi.mock("ioredis", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      pipeline: pipelineMock,
    })),
  }
})
`
);

rateLimitingTest = rateLimitingTest.replace(
  'const { protectMock } = vi.hoisted(() => {\n  return { protectMock: vi.fn() }\n})',
  ''
);

// Auth test
rateLimitingTest = rateLimitingTest.replace(
  /it\("should return success when arcjet allows", async \(\) => \{\s*protectMock\.mockResolvedValue\(\{\s*isDenied: \(\) => false,\s*results: \[\{ reason: \{ isRateLimit: \(\) => true, remaining: 5 \} \}\],\s*\}\)[\s\S]*?expect\(protectMock\)\.toHaveBeenCalled\(\)\s*\}/m,
  `it("should return success when redis allows", async () => {
    execMock.mockResolvedValue([[null, 0], [null, 1], [null, 2], [null, 1]])

    const req = new Request("http://localhost/auth/signin", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
    })

    const result = await checkAuthRateLimit(req, "1.2.3.4")

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(3)
    expect(pipelineMock).toHaveBeenCalled()
  }`
);

rateLimitingTest = rateLimitingTest.replace(
  /it\("should return failure when arcjet denies", async \(\) => \{\s*protectMock\.mockResolvedValue\(\{\s*isDenied: \(\) => true,\s*results: \[\{ reason: \{ isRateLimit: \(\) => true, remaining: 0 \} \}\],\s*\}\)[\s\S]*?expect\(result\.remaining\)\.toBe\(0\)\s*\}/m,
  `it("should return failure when redis denies", async () => {
    execMock.mockResolvedValue([[null, 0], [null, 1], [null, 6], [null, 1]])

    const req = new Request("http://localhost/auth/signin", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
    })

    const result = await checkAuthRateLimit(req, "1.2.3.4")

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  }`
);

rateLimitingTest = rateLimitingTest.replace(/checkAuthRateLimit Logic/g, "checkAuthRateLimit Logic"); // Trigger replace

rateLimitingTest = rateLimitingTest.replace(
  /it\("should enforce limits for anonymous users", async \(\) => \{\s*protectMock\.mockResolvedValue\(\{\s*isDenied: \(\) => false,\s*results: \[\{ reason: \{ isRateLimit: \(\) => true, remaining: 10 \} \}\],\s*\}\)[\s\S]*?expect\(protectMock\)\.toHaveBeenCalledWith\(expect\.anything\(\), \{\s*userId: "anonymous",\s*\}\)\s*\}/m,
  `it("should enforce limits for anonymous users", async () => {
    execMock.mockResolvedValue([[null, 0], [null, 1], [null, 10], [null, 1]])

    const req = new Request("http://localhost/api/chat", { method: "POST" })
    const result = await checkRateLimit(req, {})

    expect(result.success).toBe(true)
    expect(result.isAuthenticated).toBe(false)
    expect(pipelineMock).toHaveBeenCalled()
  }`
);

rateLimitingTest = rateLimitingTest.replace(
  /it\("should enforce limits for guests", async \(\) => \{\s*protectMock\.mockResolvedValue\(\{\s*isDenied: \(\) => false,\s*results: \[\{ reason: \{ isRateLimit: \(\) => true, remaining: 20 \} \}\],\s*\}\)[\s\S]*?expect\(protectMock\)\.toHaveBeenCalledWith\(expect\.anything\(\), \{\s*userId: "guest-123",\s*\}\)\s*\}/m,
  `it("should enforce limits for guests", async () => {
    execMock.mockResolvedValue([[null, 0], [null, 1], [null, 20], [null, 1]])

    const req = new Request("http://localhost/api/chat", { method: "POST" })
    const guest = { id: "guest-123" } as any
    const result = await checkRateLimit(req, { guest })

    expect(result.success).toBe(true)
    expect(result.isAuthenticated).toBe(true)
  }`
);

rateLimitingTest = rateLimitingTest.replace(
  /it\("should enforce limits for members \(free\)", async \(\) => \{\s*protectMock\.mockResolvedValue\(\{\s*isDenied: \(\) => false,\s*results: \[\{ reason: \{ isRateLimit: \(\) => true, remaining: 30 \} \}\],\s*\}\)[\s\S]*?expect\(protectMock\)\.toHaveBeenCalledWith\(expect\.anything\(\), \{\s*userId: "user-123",\s*\}\)\s*\}/m,
  `it("should enforce limits for members (free)", async () => {
    execMock.mockResolvedValue([[null, 0], [null, 1], [null, 30], [null, 1]])

    const req = new Request("http://localhost/api/chat", { method: "POST" })
    const member = { id: "user-123" } as any
    const result = await checkRateLimit(req, { member })

    expect(result.success).toBe(true)
    expect(result.isAuthenticated).toBe(true)
  }`
);

rateLimitingTest = rateLimitingTest.replace(
  /it\("should enforce limits for pro members", async \(\) => \{\s*protectMock\.mockResolvedValue\(\{\s*isDenied: \(\) => false,\s*results: \[\{ reason: \{ isRateLimit: \(\) => true, remaining: 100 \} \}\],\s*\}\)[\s\S]*?expect\(protectMock\)\.toHaveBeenCalled\(\)\s*\}/m,
  `it("should enforce limits for pro members", async () => {
    execMock.mockResolvedValue([[null, 0], [null, 1], [null, 100], [null, 1]])

    const req = new Request("http://localhost/api/chat", { method: "POST" })
    const member = { id: "user-123", subscription: { plan: "pro" } } as any
    const result = await checkRateLimit(req, { member })

    expect(result.success).toBe(true)
    expect(result.isAuthenticated).toBe(true)
  }`
);

rateLimitingTest = rateLimitingTest.replace(
  /it\("should check both hourly and per-thread limits", async \(\) => \{\s*\/\/ Mock protect[\s\S]*?expect\(protectMock\)\.toHaveBeenCalledTimes\(2\)[\s\S]*?\}/m,
  `it("should check both hourly and per-thread limits", async () => {
    execMock.mockResolvedValue([[null, 0], [null, 1], [null, 2], [null, 1]])

    const req = new Request("http://localhost/api/generate", { method: "POST" })
    const member = { id: "user-123" } as any
    const threadId = "thread-abc"

    const result = await checkGenerationRateLimit(req, { member, threadId })

    expect(result.success).toBe(true)
    expect(pipelineMock).toHaveBeenCalledTimes(2)
  }`
);

rateLimitingTest = rateLimitingTest.replace(
  /it\("should return failure if any limit is denied", async \(\) => \{\s*\/\/ Mock protect[\s\S]*?expect\(result\.errorMessage\)\.toContain\("regenerated this title"\)\s*\}/m,
  `it("should return failure if any limit is denied", async () => {
    execMock
      .mockResolvedValueOnce([[null, 0], [null, 1], [null, 5], [null, 1]]) // Hourly allowed
      .mockResolvedValueOnce([[null, 0], [null, 1], [null, 11], [null, 1]]) // Thread denied

    const req = new Request("http://localhost/api/generate", { method: "POST" })
    const member = { id: "user-123" } as any
    const threadId = "thread-abc"

    const result = await checkGenerationRateLimit(req, { member, threadId })

    expect(result.success).toBe(false)
    expect(result.errorMessage).toContain("regenerated this title")
  }`
);

fs.writeFileSync('apps/api/test/lib_rate_limiting.test.ts', rateLimitingTest);
