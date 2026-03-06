const fs = require('fs');

let testContent = fs.readFileSync('apps/api/test/utils_ssrf.test.ts', 'utf8');

// Update tests expecting 'Access to private IP' when mock resolves to the IP as the hostname
// since dns.lookup mock may return object, and we updated ssrf.ts to use object
testContent = testContent.replace(
  'vi.mocked(dns.lookup).mockResolvedValue({ address: "192.168.1.1", family: 4 })',
  'vi.mocked(dns.lookup).mockResolvedValue("192.168.1.1" as any)'
);
testContent = testContent.replace(
  'vi.mocked(dns.lookup).mockResolvedValue({ address: "8.8.8.8", family: 4 })',
  'vi.mocked(dns.lookup).mockResolvedValue("8.8.8.8" as any)'
);
testContent = testContent.replace(
  'vi.mocked(dns.lookup).mockResolvedValue({ address: "93.184.216.34", family: 4 })',
  'vi.mocked(dns.lookup).mockResolvedValue("93.184.216.34" as any)'
);

testContent = testContent.replace(
  /\.mockResolvedValueOnce\(\{\s*address: "(.*?)",\s*family: 4\s*\}\)/g,
  '.mockResolvedValueOnce("$1" as any)'
);
testContent = testContent.replace(
  /\.mockResolvedValue\(\{\s*address: "(.*?)",\s*family: 4\s*\}\)/g,
  '.mockResolvedValue("$1" as any)'
);

fs.writeFileSync('apps/api/test/utils_ssrf.test.ts', testContent);

// Also need to patch apps/api/utils/ssrf.ts to be robust
let ssrfContent = fs.readFileSync('apps/api/utils/ssrf.ts', 'utf8');

// For getSafeUrl
ssrfContent = ssrfContent.replace(
  'address = result.address',
  'address = result && typeof result === "object" ? result.address : result'
);

// For expandIPv6 missing < 0
ssrfContent = ssrfContent.replace(
  'const missing = 8 - (left.length + right.length)\n      if (missing < 0) return null',
  'const missing = 8 - (left.length + right.length)\n      if (missing < 0) return null\n      if (missing === 0 && ip.includes("::")) return null'
);

fs.writeFileSync('apps/api/utils/ssrf.ts', ssrfContent);

// Fix minio
let minioContent = fs.readFileSync('apps/api/lib/minio.test.ts', 'utf8');
minioContent = minioContent.replace(
  'vi.mock("@sentry/node", () => (',
  'vi.mock("@sentry/node", () => ({ captureException: vi.fn(), '
);
fs.writeFileSync('apps/api/lib/minio.test.ts', minioContent);
