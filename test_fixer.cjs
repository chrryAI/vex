const fs = require('fs');

let rateLimitingTest = fs.readFileSync('apps/api/test/lib_rate_limiting.test.ts', 'utf8');
// Fix lib_rate_limiting mock by returning properly formatted result

rateLimitingTest = rateLimitingTest.replace(
  'mockResolvedValue([[null, 0], [null, 1], [null, 2], [null, 1]])',
  'mockResolvedValue([[null, 0], [null, 1], [null, 2], [null, 1]])'
);

// Actually, wait, let's look at lib/rateLimiting.ts slidingWindowCheck
// The mock return value isn't matching what exec returns when mapped?
// `const currentCount = (count?.[1] as number) ?? 0`
// where count is the third element of the pipeline array!
// So count is `[null, 2]`. Then count?.[1] is 2. This seems correct.

// Let's read what the test fails on
// `expected true to be false // Object.is equality`
//     expect(result.success).toBe(false)
// wait, the result is `success: true`.

// Look at the arcjet test
//   it("should return failure when arcjet denies", async () => {
// But there is no Arcjet anymore!
