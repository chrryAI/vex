const fs = require('fs');

let rateLimitingContent = fs.readFileSync('apps/api/test/lib_rate_limiting.test.ts', 'utf8');

rateLimitingContent = rateLimitingContent.replace(
  'const RedisMock = vi.fn().mockImplementation(() => ({\n    on: vi.fn(),\n    pipeline: pipelineMock,\n  }));',
  'class RedisMock {\n    on = vi.fn();\n    pipeline = pipelineMock;\n  }'
);

fs.writeFileSync('apps/api/test/lib_rate_limiting.test.ts', rateLimitingContent);

let rateLimitingMainContent = fs.readFileSync('apps/api/lib/rateLimiting.test.ts', 'utf8');

rateLimitingMainContent = rateLimitingMainContent.replace(
  'const RedisMock = vi.fn().mockImplementation(() => ({\n    on: vi.fn(),\n    pipeline: () => pipeline,\n  }));',
  'class RedisMock {\n    on = vi.fn();\n    pipeline = () => pipeline;\n  }'
);

fs.writeFileSync('apps/api/lib/rateLimiting.test.ts', rateLimitingMainContent);
