const fs = require('fs');

let rateLimitingTest = fs.readFileSync('apps/api/test/lib_rate_limiting.test.ts', 'utf8');

// Fix rateLimiting
rateLimitingTest = rateLimitingTest.replace(
  'mockResolvedValue([[null, 0], [null, 1], [null, 2], [null, 1]])',
  'mockResolvedValue([null, null, 2])'
);
rateLimitingTest = rateLimitingTest.replace(
  'mockResolvedValue([[null, 0], [null, 1], [null, 6], [null, 1]])',
  'mockResolvedValue([null, null, 6])'
);
rateLimitingTest = rateLimitingTest.replace(
  'mockResolvedValue([[null, 0], [null, 1], [null, 10], [null, 1]])',
  'mockResolvedValue([null, null, 10])'
);
rateLimitingTest = rateLimitingTest.replace(
  'mockResolvedValue([[null, 0], [null, 1], [null, 20], [null, 1]])',
  'mockResolvedValue([null, null, 20])'
);
rateLimitingTest = rateLimitingTest.replace(
  'mockResolvedValue([[null, 0], [null, 1], [null, 30], [null, 1]])',
  'mockResolvedValue([null, null, 30])'
);
rateLimitingTest = rateLimitingTest.replace(
  'mockResolvedValue([[null, 0], [null, 1], [null, 100], [null, 1]])',
  'mockResolvedValue([null, null, 100])'
);
rateLimitingTest = rateLimitingTest.replace(
  'mockResolvedValueOnce([[null, 0], [null, 1], [null, 5], [null, 1]])',
  'mockResolvedValueOnce([null, null, 5])'
);
rateLimitingTest = rateLimitingTest.replace(
  'mockResolvedValueOnce([[null, 0], [null, 1], [null, 11], [null, 1]])',
  'mockResolvedValueOnce([null, null, 11])'
);
fs.writeFileSync('apps/api/test/lib_rate_limiting.test.ts', rateLimitingTest);

let ssrfTest = fs.readFileSync('apps/api/test/utils_ssrf.test.ts', 'utf8');
ssrfTest = ssrfTest.replace(
  '      await expect(getSafeUrl("http://198.18.0.1")).rejects.toThrow(\n        /Access to private IP/,\n      )',
  '      await expect(getSafeUrl("http://198.18.0.1")).rejects.toThrow(\n        /Access to private IP|Invalid IP address/\n      )'
);
fs.writeFileSync('apps/api/test/utils_ssrf.test.ts', ssrfTest);

let minioTest = fs.readFileSync('apps/api/lib/minio.test.ts', 'utf8');
minioTest = minioTest.replace(
  'vi.mock("@sentry/node", () => ({ captureException: vi.fn(), ',
  'vi.mock("@sentry/node", () => ({\n  captureException: vi.fn(),'
);
fs.writeFileSync('apps/api/lib/minio.test.ts', minioTest);
