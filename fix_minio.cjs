const fs = require('fs');

let minioContent = fs.readFileSync('apps/api/lib/minio.test.ts', 'utf8');

minioContent = minioContent.replace(
  'vi.mock("./captureException", () => ({\n  default: vi.fn(),\n}))',
  'vi.mock("./captureException", () => ({\n  default: vi.fn(),\n  captureException: vi.fn()\n}))'
);

fs.writeFileSync('apps/api/lib/minio.test.ts', minioContent);
