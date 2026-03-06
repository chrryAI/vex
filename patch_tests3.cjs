const fs = require('fs');

let content = fs.readFileSync('apps/api/test/lib_rate_limiting.test.ts', 'utf8');

content = content.replace(
  'execMock.mockResolvedValue([null, null, [null, 2]])',
  'execMock.mockResolvedValue([[null, 0], [null, 1], [null, 2], [null, 1]])'
);
content = content.replace(
  'execMock.mockResolvedValue([null, null, [null, 6]])',
  'execMock.mockResolvedValue([[null, 0], [null, 1], [null, 6], [null, 1]])'
);
content = content.replace(
  'execMock.mockResolvedValue([null, null, [null, 10]]) // zcard results',
  'execMock.mockResolvedValue([[null, 0], [null, 1], [null, 10], [null, 1]])'
);
content = content.replace(
  'execMock.mockResolvedValue([null, null, [null, 50]])',
  'execMock.mockResolvedValue([[null, 0], [null, 1], [null, 50], [null, 1]])'
);
content = content.replace(
  'execMock.mockResolvedValue([null, null, [null, 100]])',
  'execMock.mockResolvedValue([[null, 0], [null, 1], [null, 100], [null, 1]])'
);
content = content.replace(
  'execMock.mockResolvedValue([null, null, [null, 100]])',
  'execMock.mockResolvedValue([[null, 0], [null, 1], [null, 100], [null, 1]])'
);
content = content.replace(
  'execMock.mockResolvedValueOnce([null, null, [null, 5]])',
  'execMock.mockResolvedValueOnce([[null, 0], [null, 1], [null, 5], [null, 1]])'
);
content = content.replace(
  'execMock.mockResolvedValueOnce([null, null, [null, 11]])',
  'execMock.mockResolvedValueOnce([[null, 0], [null, 1], [null, 11], [null, 1]])'
);

fs.writeFileSync('apps/api/test/lib_rate_limiting.test.ts', content);
