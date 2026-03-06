const fs = require('fs');
let ssrfContent = fs.readFileSync('apps/api/utils/ssrf.ts', 'utf8');

// For 100::/64
// We need to modify expandIPv6 or the checks.
ssrfContent = ssrfContent.replace(
  '      // 100::/64 - Check first 4 blocks (64 bits)\n      if (\n        ipv6Blocks[0] === 0x100 &&\n        ipv6Blocks[1] === 0 &&\n        ipv6Blocks[2] === 0 &&\n        ipv6Blocks[3] === 0\n      )\n        return true',
  '      // 100::/64 - Check first 4 blocks (64 bits)\n      if (\n        ipv6Blocks[0] === 0x100 &&\n        ipv6Blocks[1] === 0 &&\n        ipv6Blocks[2] === 0 &&\n        ipv6Blocks[3] === 0\n      )\n        return true'
);

// Actually, wait, let's fix expandIPv6
ssrfContent = ssrfContent.replace(
  'const missing = 8 - (left.length + right.length)\n      if (missing < 0) return null',
  'const missing = 8 - (left.length + right.length)\n      if (missing < 0) return null\n      if (missing === 0 && ip.includes("::")) return null'
);

// But wait, the test says expect(isPrivateIP("100:1::")).toBe(false)
// In expandIPv6("100:1::"), it expands to 100:1:0:0:0:0:0:0
// Let's look at the blocks: ipv6Blocks[0] = 0x100, ipv6Blocks[1] = 0x1
// So the current check for 100::/64 should be correct, because it checks ipv6Blocks[1] === 0
// Wait, why did the test fail?
// Let's check test output again:
// FAIL utils/ssrf-ip.test.ts > isPrivateIP > should handle IPv6 CIDR boundaries correctly
// AssertionError: expected true to be false
// ❯ utils/ssrf-ip.test.ts:119
// 118|     expect(isPrivateIP("64:ff9b::ffff:ffff")).toBe(true)
// 119|     expect(isPrivateIP("64:ff9b:1::")).toBe(false) // Outside /96
// Aha! 64:ff9b:1:: is returning true!

// Let's look at isPrivateIP IPv6 check for 64:ff9b
// It currently has: if (normalizedIP.startsWith("64:ff9b:")) return true
ssrfContent = ssrfContent.replace(
  '// 64:ff9b::/96 (IPv4/IPv6 translation)\n    if (normalizedIP.startsWith("64:ff9b:")) return true\n    // 100::/64 (Discard-Only)\n    if (normalizedIP.startsWith("100:")) return true\n    // 2001:db8::/32 (Documentation)\n    if (normalizedIP.startsWith("2001:db8:")) return true',
  '// 64:ff9b::/96 (IPv4/IPv6 translation)'
);

fs.writeFileSync('apps/api/utils/ssrf.ts', ssrfContent);
