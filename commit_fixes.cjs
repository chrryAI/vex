const { execSync } = require('child_process');

try {
  execSync('git add apps/api/utils/ssrf.ts apps/api/test/utils_ssrf.test.ts apps/api/test/lib_rate_limiting.test.ts apps/api/lib/rateLimiting.test.ts apps/api/lib/minio.test.ts', { stdio: 'inherit' });
  execSync('git commit -m "Fix tests and ssrf protections for CI check suite"', { stdio: 'inherit' });
  execSync('git push origin sentinel-fix-injection-vulnerabilities-15781562299706880232', { stdio: 'inherit' });
} catch (e) {
  console.error(e);
}
