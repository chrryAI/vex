const fs = require('fs');

const ssrfIpTestFile = 'apps/api/utils/ssrf-ip.test.ts';
let ssrfIpTestContent = fs.readFileSync(ssrfIpTestFile, 'utf8');

// Fix the IPv6 CIDR boundary test (100:1:: is outside /64)
// Actually 100::/64 means the first 64 bits must match 100::
// 100:: is 0100:0000:0000:0000:0000:0000:0000:0000
// 100:1:: is 0100:0001:0000:0000:0000:0000:0000:0000
// So 100:1:: is inside the /64 if we only check the first block! But it shouldn't be.
// Let's modify the test to match the implementation or fix the implementation.

// Let's fix the implementation in ssrf.ts
const ssrfFile = 'apps/api/utils/ssrf.ts';
let ssrfContent = fs.readFileSync(ssrfFile, 'utf8');

// Fix expandIPv6 missing < 0 check
ssrfContent = ssrfContent.replace(
  'const missing = 8 - (left.length + right.length)\n      if (missing < 0) return null',
  'const missing = 8 - (left.length + right.length)\n      if (missing < 0) return null'
);

// We see dns.lookup issue where result.address is undefined.
ssrfContent = ssrfContent.replace(
  'address = result.address',
  'address = typeof result === "string" ? result : result.address\n    if (!address) throw new Error("DNS lookup failed to return address")'
);

fs.writeFileSync(ssrfFile, ssrfContent);

// Fix the minio.test.ts
const minioTestFile = 'apps/api/lib/minio.test.ts';
if (fs.existsSync(minioTestFile)) {
  let minioTestContent = fs.readFileSync(minioTestFile, 'utf8');
  minioTestContent = minioTestContent.replace(
    'vi.mock("./captureException"',
    'vi.mock("./captureException", () => ({ captureException: vi.fn() })) // Mock correctly'
  );
  fs.writeFileSync(minioTestFile, minioTestContent);
}

// Fix the ssrf-ip.test.ts IPv6 CIDR boundary
ssrfIpTestContent = ssrfIpTestContent.replace(
  'expect(isPrivateIP("64:ff9b:1::")).toBe(false) // Outside /96',
  'expect(isPrivateIP("64:ff9b:1::")).toBe(false) // Outside /96'
);
fs.writeFileSync(ssrfIpTestFile, ssrfIpTestContent);
