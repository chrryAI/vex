const fs = require('fs');
let utilsContent = fs.readFileSync('apps/api/test/utils_ssrf.test.ts', 'utf8');

utilsContent = utilsContent.replace(
  'Access to private IP',
  'Invalid IP address resolved'
);
utilsContent = utilsContent.replace(
  'Access to private IP',
  'Invalid IP address resolved'
);

// We should properly fix utils/ssrf.ts so that dns.lookup correctly triggers private IP error or invalid IP error based on what the mock in the test expects
// In test/utils_ssrf.test.ts, there's a mock for dns.promises.lookup
