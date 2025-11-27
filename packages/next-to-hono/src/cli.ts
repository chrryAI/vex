#!/usr/bin/env node
import { Command } from "commander"
import { convertDirectory } from "./converter.js"
import chalk from "chalk"
import ora from "ora"
import fs from "fs"
import path from "path"

const program = new Command()

program
  .name("next-to-hono")
  .description("Convert Next.js API routes to Hono")
  .version("0.1.0")

program
  .command("convert")
  .description("Convert Next.js API routes to Hono")
  .argument("<api-dir>", "Path to Next.js app/api directory")
  .option(
    "-o, --output <file>",
    "Output file for Hono app",
    "app/api/[[...route]]/route.ts",
  )
  .option(
    "-d, --depth <number>",
    "Extra nesting depth for imports (e.g., 1 for /api/hono/[[...route]]/)",
    "0",
  )
  .option("--dry-run", "Show conversion preview without writing files")
  .option("--stats", "Show detailed statistics")
  .action(async (apiDir: string, options) => {
    const spinner = ora("Analyzing Next.js routes...").start()

    try {
      // Validate directory
      if (!fs.existsSync(apiDir)) {
        spinner.fail(chalk.red(`Directory not found: ${apiDir}`))
        process.exit(1)
      }

      // Convert routes
      const baseDepth = parseInt(options.depth, 10)
      const result = convertDirectory(apiDir, baseDepth)

      spinner.succeed(
        chalk.green(
          `Found ${result.stats.total} routes (${result.stats.autoConverted} auto-converted, ${result.stats.needsReview} need review)`,
        ),
      )

      // Show warnings
      if (result.warnings.length > 0) {
        console.log(chalk.yellow("\n⚠️  Warnings:"))
        result.warnings.forEach((warning) =>
          console.log(chalk.yellow(`  ${warning}`)),
        )
      }

      // Show stats
      if (options.stats) {
        console.log(chalk.cyan("\n📊 Conversion Statistics:"))
        result.routes.forEach((route) => {
          const icon = route.needsManualReview ? "⚠️ " : "✅"
          const complexity = route.needsManualReview
            ? chalk.yellow(`[${route.complexity}]`)
            : chalk.green("[simple]")
          console.log(
            `  ${icon} ${route.method.toUpperCase().padEnd(6)} ${route.path.padEnd(30)} ${complexity}`,
          )
        })
      }

      // Write output
      if (!options.dryRun) {
        const outputPath = path.resolve(options.output)
        const outputDir = path.dirname(outputPath)

        // Create directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true })
        }

        fs.writeFileSync(outputPath, result.honoCode)
        console.log(chalk.green(`\n✅ Generated: ${outputPath}`))

        // Next steps
        console.log(chalk.cyan("\n📋 Next Steps:"))
        console.log(
          `  1. Install Hono: ${chalk.gray("npm install hono @hono/node-server")}`,
        )
        console.log(`  2. Review routes marked with ⚠️  for manual fixes`)
        console.log(`  3. Test converted routes: ${chalk.gray("npm run dev")}`)
        console.log(
          `  4. Compare performance: ${chalk.gray("ab -n 1000 -c 100 http://localhost:3000/api/...")}`,
        )

        if (result.stats.needsReview > 0) {
          console.log(
            chalk.yellow(
              `\n⚠️  ${result.stats.needsReview} routes need manual review (see comments in generated file)`,
            ),
          )
        }
      } else {
        console.log(chalk.cyan("\n📄 Dry run - Generated code preview:"))
        console.log(chalk.gray("─".repeat(80)))
        console.log(result.honoCode.split("\n").slice(0, 50).join("\n"))
        console.log(chalk.gray("─".repeat(80)))
        console.log(
          chalk.gray(`... (${result.honoCode.split("\n").length} total lines)`),
        )
      }
    } catch (error) {
      spinner.fail(chalk.red(`Conversion failed: ${(error as Error).message}`))
      if (process.env.DEBUG) {
        console.error(error)
      }
      process.exit(1)
    }
  })

program
  .command("init")
  .description("Initialize a new Hono project with recommended setup")
  .action(() => {
    console.log(chalk.cyan("🎉 Creating Hono setup...\n"))

    const steps = [
      {
        name: "Install dependencies",
        command: "npm install hono @hono/node-server",
      },
      {
        name: "Create catch-all route",
        file: "app/api/[[...route]]/route.ts",
      },
      {
        name: "Update tsconfig.json",
        hint: 'Add "moduleResolution": "bundler"',
      },
    ]

    steps.forEach((step, i) => {
      console.log(chalk.cyan(`${i + 1}. ${step.name}`))
      if (step.command) console.log(chalk.gray(`   Run: ${step.command}`))
      if (step.file) console.log(chalk.gray(`   Create: ${step.file}`))
      if (step.hint) console.log(chalk.gray(`   Hint: ${step.hint}`))
      console.log()
    })

    console.log(chalk.green("✅ Ready to convert! Run:"))
    console.log(chalk.cyan("   next-to-hono convert app/api\n"))
  })

program.parse()
