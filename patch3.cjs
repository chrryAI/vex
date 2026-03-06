const fs = require('fs');
let content = fs.readFileSync('apps/api/utils/ssrf.ts', 'utf8');

content = content.replace(
  'address = result.address',
  'address = result && typeof result === "object" ? result.address : result'
);

content = content.replace(
  '      if (missing < 0) return null',
  '      if (missing < 0) return null\n      if (missing === 0 && ip.includes("::")) return null'
);

fs.writeFileSync('apps/api/utils/ssrf.ts', content);

let minioContent = fs.readFileSync('apps/api/lib/minio.test.ts', 'utf8');
minioContent = minioContent.replace(
  'vi.mock("@sentry/node", () => (',
  'vi.mock("@sentry/node", () => ({ captureException: vi.fn(), '
);
fs.writeFileSync('apps/api/lib/minio.test.ts', minioContent);
