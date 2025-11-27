import { parse } from "@babel/parser"
import traverse, { NodePath } from "@babel/traverse"
import generate from "@babel/generator"
import * as t from "@babel/types"
import fs from "fs"
import path from "path"

export interface ConvertedRoute {
  path: string
  method: string
  handler: string
  imports: string[]
  needsManualReview: boolean
  complexity: "simple" | "moderate" | "complex"
}

export interface ConversionResult {
  routes: ConvertedRoute[]
  honoCode: string
  warnings: string[]
  stats: {
    total: number
    autoConverted: number
    needsReview: number
  }
}

/**
 * Parse a Next.js API route file and extract handlers
 * @param baseDepth - Number of extra ../ levels needed for imports (default: 0)
 */
export function parseNextJSRoute(
  filePath: string,
  basePath: string,
  baseDepth: number = 0,
): ConvertedRoute[] {
  const code = fs.readFileSync(filePath, "utf8")
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  })

  const routes: ConvertedRoute[] = []
  const imports: string[] = []
  let needsManualReview = false
  let complexity: "simple" | "moderate" | "complex" = "simple"

  // Extract imports and adjust depth
  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value
      // Skip Next.js specific imports
      if (!source.includes("next/server") && !source.includes("next/headers")) {
        let adjustedSource = source

        // Adjust relative imports based on baseDepth
        if (source.startsWith("../") || source.startsWith("./")) {
          const extraLevels = "../".repeat(baseDepth)
          adjustedSource = extraLevels + source
        }

        const newImport = generate(path.node).code.replace(
          source,
          adjustedSource,
        )
        imports.push(newImport)
      }
    },
  })

  // Extract route handlers
  traverse(ast, {
    ExportNamedDeclaration(path) {
      const declaration = path.node.declaration
      if (!declaration || declaration.type !== "FunctionDeclaration") return

      const func = declaration as t.FunctionDeclaration
      const methodName = func.id?.name
      if (
        !methodName ||
        !["GET", "POST", "PUT", "DELETE", "PATCH"].includes(methodName)
      ) {
        return
      }

      // Convert file path to route path
      const routePath = filePath
        .replace(basePath, "")
        .replace(/\/route\.(ts|tsx|js|jsx)$/, "")
        .replace(/\[\.\.\.([^\]]+)\]/g, ":$1*") // [...slug] → :slug*
        .replace(/\[([^\]]+)\]/g, ":$1") // [id] → :id
        .replace(/^\/?/, "/") // Ensure leading slash

      // Analyze complexity
      const bodyCode = generate(func.body).code
      if (
        bodyCode.includes("ReadableStream") ||
        bodyCode.includes(".stream(")
      ) {
        complexity = "complex"
        needsManualReview = true
      } else if (
        bodyCode.includes("formData") ||
        bodyCode.includes("uploadFile")
      ) {
        complexity = "moderate"
        needsManualReview = true
      }

      // Convert handler body
      const convertedHandler = convertHandlerBody(func, methodName)

      routes.push({
        path: routePath,
        method: methodName.toLowerCase(),
        handler: convertedHandler,
        imports,
        needsManualReview,
        complexity,
      })
    },
  })

  return routes
}

/**
 * Convert Next.js handler body to Hono using AST transformations
 */
function convertHandlerBody(
  func: t.FunctionDeclaration,
  method: string,
): string {
  // Clone the function to avoid mutating the original AST
  const funcClone = t.cloneNode(func, true)

  // Transform the entire function
  const program = t.file(t.program([funcClone]))
  traverse(program, {
    // Transform function parameters: request -> c
    enter(path) {
      // Transform function params with proper type narrowing
      if (
        path.isFunctionDeclaration() ||
        path.isArrowFunctionExpression() ||
        path.isFunctionExpression()
      ) {
        const node = path.node
        if (
          "params" in node &&
          Array.isArray(node.params) &&
          node.params.length > 0
        ) {
          const firstParam = node.params[0]
          if (t.isIdentifier(firstParam, { name: "request" })) {
            firstParam.name = "c"
            if ("typeAnnotation" in firstParam) {
              firstParam.typeAnnotation = undefined
            }
          }
        }
      }

      // Transform CallExpression nodes
      if (path.isCallExpression()) {
        const callee = path.node.callee

        // NextResponse.json() -> c.json()
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: "NextResponse" }) &&
          t.isIdentifier(callee.property, { name: "json" })
        ) {
          const args = path.node.arguments

          // Case: NextResponse.json(data, { status: 403 })
          if (args.length === 2 && t.isObjectExpression(args[1])) {
            const statusProp = (args[1] as t.ObjectExpression).properties.find(
              (prop) =>
                t.isObjectProperty(prop) &&
                t.isIdentifier(prop.key, { name: "status" }),
            ) as t.ObjectProperty | undefined

            if (statusProp && t.isNumericLiteral(statusProp.value)) {
              path.replaceWith(
                t.callExpression(
                  t.memberExpression(t.identifier("c"), t.identifier("json")),
                  [args[0], statusProp.value],
                ),
              )
              return
            }
          }

          // Case: NextResponse.json(data)
          path.replaceWith(
            t.callExpression(
              t.memberExpression(t.identifier("c"), t.identifier("json")),
              [args[0]],
            ),
          )
        }

        // request.headers.get() -> c.req.header()
        if (
          t.isMemberExpression(callee) &&
          t.isMemberExpression(callee.object) &&
          t.isIdentifier(callee.object.object, { name: "request" }) &&
          t.isIdentifier(callee.object.property, { name: "headers" }) &&
          t.isIdentifier(callee.property, { name: "get" })
        ) {
          path.replaceWith(
            t.callExpression(
              t.memberExpression(
                t.memberExpression(t.identifier("c"), t.identifier("req")),
                t.identifier("header"),
              ),
              path.node.arguments,
            ),
          )
        }

        // url.searchParams.get() -> c.req.query()
        if (
          t.isMemberExpression(callee) &&
          t.isMemberExpression(callee.object) &&
          t.isIdentifier(callee.object.object, { name: "url" }) &&
          t.isIdentifier(callee.object.property, { name: "searchParams" }) &&
          t.isIdentifier(callee.property, { name: "get" })
        ) {
          path.replaceWith(
            t.callExpression(
              t.memberExpression(
                t.memberExpression(t.identifier("c"), t.identifier("req")),
                t.identifier("query"),
              ),
              path.node.arguments,
            ),
          )
        }

        // request.json/formData/text() -> c.req.json/formData/text()
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: "request" })
        ) {
          const method = callee.property
          if (
            t.isIdentifier(method) &&
            ["json", "formData", "text"].includes(method.name)
          ) {
            const calleePath = path.get("callee")
            if (!Array.isArray(calleePath)) {
              ;(calleePath as NodePath<t.MemberExpression>).replaceWith(
                t.memberExpression(
                  t.memberExpression(t.identifier("c"), t.identifier("req")),
                  method,
                ),
              )
            }
          }
        }
      }

      // Transform NewExpression: new URL(request.url) -> new URL(c.req.url)
      if (path.isNewExpression()) {
        if (
          t.isIdentifier(path.node.callee, { name: "URL" }) &&
          path.node.arguments.length > 0
        ) {
          const arg = path.node.arguments[0]
          if (
            t.isMemberExpression(arg) &&
            t.isIdentifier(arg.object, { name: "request" }) &&
            t.isIdentifier(arg.property, { name: "url" })
          ) {
            path.node.arguments[0] = t.memberExpression(
              t.memberExpression(t.identifier("c"), t.identifier("req")),
              t.identifier("url"),
            )
          }
        }
      }

      // Transform MemberExpression: params.id -> c.req.param("id")
      if (path.isMemberExpression()) {
        if (
          t.isIdentifier(path.node.object, { name: "params" }) &&
          t.isIdentifier(path.node.property) &&
          !path.node.computed
        ) {
          const paramName = path.node.property.name
          path.replaceWith(
            t.callExpression(
              t.memberExpression(
                t.memberExpression(t.identifier("c"), t.identifier("req")),
                t.identifier("param"),
              ),
              [t.stringLiteral(paramName)],
            ),
          )
        }
      }

      // Transform Identifier: request -> c.req (but not in param declarations)
      if (path.isIdentifier({ name: "request" })) {
        const parent = path.parent
        // Skip if it's a function parameter
        if (
          !t.isFunctionDeclaration(parent) &&
          !t.isArrowFunctionExpression(parent) &&
          !t.isFunctionExpression(parent) &&
          !path.isBindingIdentifier()
        ) {
          ;(path as NodePath).replaceWith(
            t.memberExpression(t.identifier("c"), t.identifier("req")),
          )
        }
      }
    },
  })

  // Generate code from transformed AST
  let code = generate(funcClone.body).code

  // Remove outer braces
  code = code.replace(/^\{|\}$/g, "").trim()

  return code
}

/**
 * Generate complete Hono app code
 */
export function generateHonoApp(
  routes: ConvertedRoute[],
  basePath = "/api",
): string {
  // Collect all unique imports
  const allImports = new Set<string>()
  routes.forEach((route) => route.imports.forEach((imp) => allImports.add(imp)))

  // Generate route registrations
  const routeCode = routes
    .map((route) => {
      const comment = route.needsManualReview
        ? `\n  // ⚠️  MANUAL REVIEW REQUIRED - ${route.complexity} complexity\n`
        : ""

      return `${comment}app.${route.method}('${route.path}', async (c) => {
${indent(route.handler, 2)}
})`
    })
    .join("\n\n")

  return `import { Hono } from 'hono'
import { handle } from 'hono/vercel'
${Array.from(allImports).join("\n")}

const app = new Hono().basePath('${basePath}')

${routeCode}

// Export handlers for Next.js catch-all route
export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const PATCH = handle(app)
`
}

/**
 * Indent code by specified number of spaces
 */
function indent(code: string, spaces: number): string {
  const indentation = " ".repeat(spaces)
  return code
    .split("\n")
    .map((line) => indentation + line)
    .join("\n")
}

/**
 * Convert all routes in a directory
 * @param baseDepth - Number of extra ../ levels for imports (e.g., 1 for /api/hono/[[...route]]/)
 */
export function convertDirectory(
  apiDir: string,
  baseDepth: number = 0,
): ConversionResult {
  const routeFiles: string[] = []

  // Find all route files recursively
  function findRoutes(dir: string) {
    const files = fs.readdirSync(dir, { withFileTypes: true })
    for (const file of files) {
      const fullPath = path.join(dir, file.name)
      if (file.isDirectory()) {
        findRoutes(fullPath)
      } else if (/route\.(ts|tsx|js|jsx)$/.test(file.name)) {
        routeFiles.push(fullPath)
      }
    }
  }

  findRoutes(apiDir)

  // Convert all routes
  const allRoutes: ConvertedRoute[] = []
  const warnings: string[] = []

  for (const file of routeFiles) {
    try {
      const routes = parseNextJSRoute(file, apiDir, baseDepth)
      allRoutes.push(...routes)

      if (routes.some((r) => r.needsManualReview)) {
        warnings.push(`${file}: Contains complex logic requiring manual review`)
      }
    } catch (error) {
      warnings.push(`${file}: Failed to parse - ${(error as Error).message}`)
    }
  }

  // Generate Hono app
  const honoCode = generateHonoApp(allRoutes)

  // Calculate stats
  const stats = {
    total: allRoutes.length,
    autoConverted: allRoutes.filter((r) => !r.needsManualReview).length,
    needsReview: allRoutes.filter((r) => r.needsManualReview).length,
  }

  return {
    routes: allRoutes,
    honoCode,
    warnings,
    stats,
  }
}
