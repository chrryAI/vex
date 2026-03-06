const fs = require('fs');

let rateLimitingContent = fs.readFileSync('apps/api/test/lib_rate_limiting.test.ts', 'utf8');

// For "should return success when redis allows":
// Expected 5 to be 3
// execMock returns [null, null, 2], so currentCount = 2, max = 5. remaining = 5 - 2 = 3.
// But test fails because it got 5.
// Why did it get 5? Let's check slidingWindowCheck implementation.
// count?.[1] is where currentCount comes from.
// Oh, if `execMock.mockResolvedValue([null, null, 2])`, then `count` is `2`.
// `count?.[1]` is `undefined` because 2[1] is undefined (number has no index 1).
// So `currentCount` falls back to `0`. `remaining = max - 0 = 5`.
// That's why we were passing arrays before! `[[null, 0], [null, 1], [null, 2], [null, 1]]` -> count is `[null, 2]`. Then count[1] is `2`.
// Let's use `[[null, 0], [null, 1], [null, 2], [null, 1]]` in the mocks.

rateLimitingContent = rateLimitingContent.replace(
  'mockResolvedValue([null, null, 2])',
  'mockResolvedValue([[null, 0], [null, 1], [null, 2], [null, 1]])'
);
rateLimitingContent = rateLimitingContent.replace(
  'mockResolvedValue([null, null, 6])',
  'mockResolvedValue([[null, 0], [null, 1], [null, 6], [null, 1]])'
);
rateLimitingContent = rateLimitingContent.replace(
  'mockResolvedValue([null, null, 10])',
  'mockResolvedValue([[null, 0], [null, 1], [null, 10], [null, 1]])'
);
rateLimitingContent = rateLimitingContent.replace(
  'mockResolvedValue([null, null, 20])',
  'mockResolvedValue([[null, 0], [null, 1], [null, 20], [null, 1]])'
);
rateLimitingContent = rateLimitingContent.replace(
  'mockResolvedValue([null, null, 30])',
  'mockResolvedValue([[null, 0], [null, 1], [null, 30], [null, 1]])'
);
rateLimitingContent = rateLimitingContent.replace(
  'mockResolvedValue([null, null, 100])',
  'mockResolvedValue([[null, 0], [null, 1], [null, 100], [null, 1]])'
);
rateLimitingContent = rateLimitingContent.replace(
  'mockResolvedValueOnce([null, null, 5])',
  'mockResolvedValueOnce([[null, 0], [null, 1], [null, 5], [null, 1]])'
);
rateLimitingContent = rateLimitingContent.replace(
  'mockResolvedValueOnce([null, null, 11])',
  'mockResolvedValueOnce([[null, 0], [null, 1], [null, 11], [null, 1]])'
);

fs.writeFileSync('apps/api/test/lib_rate_limiting.test.ts', rateLimitingContent);
