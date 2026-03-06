const fs = require('fs');

let content = fs.readFileSync('apps/api/utils/ssrf.ts', 'utf8');

content = content.replace(
  'address = result.address',
  'address = result && typeof result === "object" ? result.address : result'
);

content = content.replace(
  'const missing = 8 - (left.length + right.length)\n      if (missing < 0) return null',
  'const missing = 8 - (left.length + right.length)\n      if (missing < 0) return null\n      if (missing === 0 && ip.includes("::") && left.length + right.length === 8) return null'
);

content = content.replace(
  '// 64:ff9b::/96 (IPv4/IPv6 translation)\n    if (normalizedIP.startsWith("64:ff9b:")) return true\n    // 100::/64 (Discard-Only)\n    if (normalizedIP.startsWith("100:")) return true\n    // 2001:db8::/32 (Documentation)\n    if (normalizedIP.startsWith("2001:db8:")) return true\n    // fc00::/7 (Unique Local)\n    if (normalizedIP.startsWith("fc") || normalizedIP.startsWith("fd"))\n      return true',
  'const ipv6Blocks = expandIPv6(normalizedIP);\n    if (ipv6Blocks) {\n      if (ipv6Blocks[0] === 0x64 && ipv6Blocks[1] === 0xff9b && ipv6Blocks[2] === 0 && ipv6Blocks[3] === 0 && ipv6Blocks[4] === 0 && ipv6Blocks[5] === 0) return true;\n      if (ipv6Blocks[0] === 0x100 && ipv6Blocks[1] === 0 && ipv6Blocks[2] === 0 && ipv6Blocks[3] === 0) return true;\n      if (ipv6Blocks[0] === 0x2001 && ipv6Blocks[1] === 0xdb8) return true;\n    }\n    // fc00::/7 (Unique Local)\n    if (normalizedIP.startsWith("fc") || normalizedIP.startsWith("fd"))\n      return true'
);

fs.writeFileSync('apps/api/utils/ssrf.ts', content);

let minioTestContent = fs.readFileSync('apps/api/lib/minio.test.ts', 'utf8');
minioTestContent = minioTestContent.replace(
  'vi.mock("@sentry/node", () => (',
  'vi.mock("@sentry/node", () => ({ captureException: vi.fn(), '
);
fs.writeFileSync('apps/api/lib/minio.test.ts', minioTestContent);

let ssrfTestContent = fs.readFileSync('apps/api/test/utils_ssrf.test.ts', 'utf8');

ssrfTestContent = ssrfTestContent.replace(
  'vi.mocked(dns.lookup).mockResolvedValue({ address: "192.168.1.1", family: 4 })',
  'vi.mocked(dns.lookup).mockResolvedValue("192.168.1.1" as any)'
);
ssrfTestContent = ssrfTestContent.replace(
  'vi.mocked(dns.lookup).mockResolvedValue({\n        address: "192.168.1.1",\n        family: 4,\n      })',
  'vi.mocked(dns.lookup).mockResolvedValue("192.168.1.1" as any)'
);
ssrfTestContent = ssrfTestContent.replace(
  'vi.mocked(dns.lookup).mockResolvedValue({\n        address: "93.184.216.34",\n        family: 4,\n      })',
  'vi.mocked(dns.lookup).mockResolvedValue("93.184.216.34" as any)'
);

fs.writeFileSync('apps/api/test/utils_ssrf.test.ts', ssrfTestContent);

let rateLimitingContent = fs.readFileSync('apps/api/test/lib_rate_limiting.test.ts', 'utf8');

rateLimitingContent = rateLimitingContent.replace(
  'pipeline: () => pipeline',
  'pipeline: pipelineMock'
);

rateLimitingContent = rateLimitingContent.replace(
  '      on: vi.fn(),\n      pipeline: () => pipeline,',
  '      on: vi.fn(),\n      pipeline: pipelineMock,'
);

rateLimitingContent = rateLimitingContent.replace(
  'const { mockIsDevelopment, mockIsE2E, mockSlidingWindow } = vi.hoisted(() => {',
  'const { mockIsDevelopment, mockIsE2E, mockSlidingWindow, pipelineMock } = vi.hoisted(() => {\n  const p = {\n    zremrangebyscore: () => p,\n    zadd: () => p,\n    zcard: () => p,\n    expire: () => p,\n    exec: vi.fn().mockResolvedValue([null, null, 5])\n  };\n  return {\n    mockIsDevelopment: { value: false },\n    mockIsE2E: { value: false },\n    mockSlidingWindow: p.exec,\n    pipelineMock: () => p,\n  }'
);

rateLimitingContent = rateLimitingContent.replace(
  '    mockSlidingWindow: vi\n      .fn()\n      .mockResolvedValue({ success: true, remaining: 5 }),\n  }\n})',
  ''
);


fs.writeFileSync('apps/api/test/lib_rate_limiting.test.ts', rateLimitingContent);
