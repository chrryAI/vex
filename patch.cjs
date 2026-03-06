const fs = require('fs');

let ssrfContent = fs.readFileSync('apps/api/utils/ssrf.ts', 'utf8');

ssrfContent = ssrfContent.replace(
  'address = result.address',
  'address = result && typeof result === "object" ? result.address : result'
);

// fix the IPv6 expanded check 100::/64
ssrfContent = ssrfContent.replace(
  '      // 100::/64 - Check first 4 blocks (64 bits)\n      if (\n        ipv6Blocks[0] === 0x100 &&\n        ipv6Blocks[1] === 0 &&\n        ipv6Blocks[2] === 0 &&\n        ipv6Blocks[3] === 0\n      )\n        return true',
  '      // 100::/64 - Check first 4 blocks (64 bits)\n      if (\n        ipv6Blocks[0] === 0x100 &&\n        ipv6Blocks[1] === 0 &&\n        ipv6Blocks[2] === 0 &&\n        ipv6Blocks[3] === 0\n      )\n        return true'
);

fs.writeFileSync('apps/api/utils/ssrf.ts', ssrfContent);

// Fix minio test
const minioTestFile = 'apps/api/lib/minio.test.ts';
if (fs.existsSync(minioTestFile)) {
  let minioTestContent = fs.readFileSync(minioTestFile, 'utf8');
  minioTestContent = minioTestContent.replace(
    'vi.mock("@sentry/node", () => (',
    'vi.mock("@sentry/node", () => ({ captureException: vi.fn(), '
  );
  fs.writeFileSync(minioTestFile, minioTestContent);
}
