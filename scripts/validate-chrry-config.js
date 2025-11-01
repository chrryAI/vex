#!/usr/bin/env node

/**
 * Chrry Config Validator CLI
 * 
 * Usage:
 *   node scripts/validate-chrry-config.js
 *   node scripts/validate-chrry-config.js ./path/to/chrry.config.js
 */

import { loadAndValidateConfig, printValidationResults } from '../packages/ui/utils/chrryConfigValidator.js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  // Get config path from args or use default
  const configPath = process.argv[2] || resolve(__dirname, '../chrry.config.js')
  
  console.log('🔍 Validating Chrry config...')
  console.log(`📄 Config file: ${configPath}\n`)
  
  try {
    const result = await loadAndValidateConfig(configPath)
    printValidationResults(result)
    
    // Exit with error code if validation failed
    process.exit(result.valid ? 0 : 1)
  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  }
}

main()
