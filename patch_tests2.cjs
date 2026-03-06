const fs = require('fs');

let rateLimitingContent = fs.readFileSync('apps/api/test/lib_rate_limiting.test.ts', 'utf8');
rateLimitingContent = rateLimitingContent.replace(
  'mockResolvedValue([null, null, 2])',
  'mockResolvedValue([null, null, [null, 2]])'
);
rateLimitingContent = rateLimitingContent.replace(
  'mockResolvedValue([null, null, 6])',
  'mockResolvedValue([null, null, [null, 6]])'
);
rateLimitingContent = rateLimitingContent.replace(
  'mockResolvedValueOnce([null, null, [null, 5]])',
  'mockResolvedValueOnce([null, null, [null, 5]])'
);
rateLimitingContent = rateLimitingContent.replace(
  'mockResolvedValueOnce([null, null, [null, 11]])',
  'mockResolvedValueOnce([null, null, [null, 11]])'
);

// We need to fix the test checkRateLimit Logic
// The mock data structure we return is [ [null, 0], [null, 1], [null, count], [null, 1] ]
// The actual implementation expects `count` to be at index 2 (count?.[1] maybe not if not pipeline?)

fs.writeFileSync('apps/api/test/lib_rate_limiting.test.ts', rateLimitingContent);

// Actually let's look at the implementation of slidingWindowCheck
//     const [, , count] = await redis
//      .pipeline()
//      ...
//      .exec()
//      .then((res) => res ?? [])
//    const currentCount = (count?.[1] as number) ?? 0

// So exec() should return [ [err, res], [err, res], [err, res], ... ]
// The mock should return `[[null, 0], [null, 1], [null, 10], [null, 1]]`
