const fs = require('fs');

let rateLimitingContent = fs.readFileSync('apps/api/test/lib_rate_limiting.test.ts', 'utf8');

rateLimitingContent = rateLimitingContent.replace(
  'return {\n    default: vi.fn().mockImplementation(() => ({\n      on: vi.fn(),\n      pipeline: pipelineMock,\n    })),\n  }',
  'const RedisMock = vi.fn().mockImplementation(() => ({\n    on: vi.fn(),\n    pipeline: pipelineMock,\n  }));\n  return { default: RedisMock }'
);

fs.writeFileSync('apps/api/test/lib_rate_limiting.test.ts', rateLimitingContent);

let rateLimitingMainContent = fs.readFileSync('apps/api/lib/rateLimiting.test.ts', 'utf8');

rateLimitingMainContent = rateLimitingMainContent.replace(
  'return {\n    default: vi.fn().mockImplementation(() => ({\n      on: vi.fn(),\n      pipeline: () => pipeline,\n    })),\n  }',
  'const RedisMock = vi.fn().mockImplementation(() => ({\n    on: vi.fn(),\n    pipeline: () => pipeline,\n  }));\n  return { default: RedisMock }'
);

fs.writeFileSync('apps/api/lib/rateLimiting.test.ts', rateLimitingMainContent);
