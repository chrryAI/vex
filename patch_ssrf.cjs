const fs = require('fs');

let ssrfContent = fs.readFileSync('apps/api/utils/ssrf.ts', 'utf8');

ssrfContent = ssrfContent.replace(
  'const missing = 8 - (left.length + right.length)\n      if (missing < 0) return null\n      if (missing === 0 && ip.includes("::")) return null\n      if (missing === 0 && ip.includes("::")) return null',
  'const missing = 8 - (left.length + right.length)\n      if (missing < 0) return null\n      if (missing === 0 && ip.includes("::") && left.length + right.length === 8) return null'
);

ssrfContent = ssrfContent.replace(
  '// 64:ff9b::/96 (IPv4/IPv6 translation)\n    if (normalizedIP.startsWith("64:ff9b:")) return true\n    // 100::/64 (Discard-Only)\n    if (normalizedIP.startsWith("100:")) return true\n    // 2001:db8::/32 (Documentation)\n    if (normalizedIP.startsWith("2001:db8:")) return true\n    // fc00::/7 (Unique Local)\n    if (normalizedIP.startsWith("fc") || normalizedIP.startsWith("fd"))\n      return true',
  'const ipv6Blocks = expandIPv6(normalizedIP);\n    if (ipv6Blocks) {\n      if (ipv6Blocks[0] === 0x64 && ipv6Blocks[1] === 0xff9b && ipv6Blocks[2] === 0 && ipv6Blocks[3] === 0 && ipv6Blocks[4] === 0 && ipv6Blocks[5] === 0) return true;\n      if (ipv6Blocks[0] === 0x100 && ipv6Blocks[1] === 0 && ipv6Blocks[2] === 0 && ipv6Blocks[3] === 0) return true;\n      if (ipv6Blocks[0] === 0x2001 && ipv6Blocks[1] === 0xdb8) return true;\n    }\n    // fc00::/7 (Unique Local)\n    if (normalizedIP.startsWith("fc") || normalizedIP.startsWith("fd"))\n      return true'
);

fs.writeFileSync('apps/api/utils/ssrf.ts', ssrfContent);
