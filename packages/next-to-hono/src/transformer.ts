import * as t from "@babel/types"
import traverse, { NodePath } from "@babel/traverse"
import generate from "@babel/generator"

/**
 * AST-based transformer for converting Next.js API code to Hono
 * This replaces regex-based conversion for more reliable transformations
 */

/**
 * Transform NextResponse.json() calls to c.json()
 */
export function transformNextResponse(path: NodePath<t.CallExpression>) {
  const callee = path.node.callee

  // Match: NextResponse.json(...)
  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.object, { name: "NextResponse" }) &&
    t.isIdentifier(callee.property, { name: "json" })
  ) {
    const args = path.node.arguments

    // Case 1: NextResponse.json(data, { status: 403 })
    if (args.length === 2 && t.isObjectExpression(args[1])) {
      const statusProp = args[1].properties.find(
        (prop) =>
          t.isObjectProperty(prop) &&
          t.isIdentifier(prop.key, { name: "status" }),
      ) as t.ObjectProperty | undefined

      if (statusProp && t.isNumericLiteral(statusProp.value)) {
        // Transform to: c.json(data, status)
        path.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier("c"), t.identifier("json")),
            [args[0], statusProp.value],
          ),
        )
        return
      }
    }

    // Case 2: NextResponse.json(data)
    // Transform to: c.json(data)
    path.replaceWith(
      t.callExpression(
        t.memberExpression(t.identifier("c"), t.identifier("json")),
        [args[0]],
      ),
    )
  }
}

/**
 * Transform request.headers.get() to c.req.header()
 */
export function transformHeaders(path: NodePath<t.CallExpression>) {
  const callee = path.node.callee

  // Match: request.headers.get("header-name")
  if (
    t.isMemberExpression(callee) &&
    t.isMemberExpression(callee.object) &&
    t.isIdentifier(callee.object.object, { name: "request" }) &&
    t.isIdentifier(callee.object.property, { name: "headers" }) &&
    t.isIdentifier(callee.property, { name: "get" })
  ) {
    // Transform to: c.req.header("header-name")
    path.replaceWith(
      t.callExpression(
        t.memberExpression(
          t.memberExpression(
            t.memberExpression(t.identifier("c"), t.identifier("req")),
            t.identifier("header"),
          ),
          t.identifier(""),
        ),
        path.node.arguments,
      ),
    )

    // Simplify to c.req.header(...)
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
}

/**
 * Transform url.searchParams.get() to c.req.query()
 */
export function transformQueryParams(path: NodePath<t.CallExpression>) {
  const callee = path.node.callee

  // Match: url.searchParams.get("param")
  if (
    t.isMemberExpression(callee) &&
    t.isMemberExpression(callee.object) &&
    t.isIdentifier(callee.object.object, { name: "url" }) &&
    t.isIdentifier(callee.object.property, { name: "searchParams" }) &&
    t.isIdentifier(callee.property, { name: "get" })
  ) {
    // Transform to: c.req.query("param")
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
}

/**
 * Transform request body parsing methods
 */
export function transformBodyParsing(path: NodePath<t.CallExpression>) {
  const callee = path.node.callee

  // Match: await request.json() / formData() / text()
  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.object, { name: "request" })
  ) {
    const method = callee.property
    if (
      t.isIdentifier(method) &&
      ["json", "formData", "text"].includes(method.name)
    ) {
      // Transform to: await c.req.json() etc
      path
        .get("callee")
        .replaceWith(
          t.memberExpression(
            t.memberExpression(t.identifier("c"), t.identifier("req")),
            method,
          ),
        )
    }
  }
}

/**
 * Transform params.id to c.req.param("id")
 */
export function transformParams(path: NodePath<t.MemberExpression>) {
  // Match: params.someParam
  if (
    t.isIdentifier(path.node.object, { name: "params" }) &&
    t.isIdentifier(path.node.property)
  ) {
    const paramName = path.node.property.name

    // Transform to: c.req.param("paramName")
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

/**
 * Transform request references to c.req
 */
export function transformRequestReferences(path: NodePath) {
  // Handle identifier: request -> c.req
  if (path.isIdentifier({ name: "request" })) {
    // Don't transform if it's a parameter declaration
    const parent = path.parent
    if (
      t.isFunctionDeclaration(parent) ||
      t.isArrowFunctionExpression(parent) ||
      t.isFunctionExpression(parent)
    ) {
      return
    }

    path.replaceWith(t.memberExpression(t.identifier("c"), t.identifier("req")))
  }
}

/**
 * Main AST transformer that applies all transformations
 */
export function transformNextJSToHono(ast: t.File): t.File {
  traverse(ast, {
    // Transform function parameters first
    FunctionDeclaration(path) {
      if (path.node.params.length > 0) {
        const firstParam = path.node.params[0]
        if (t.isIdentifier(firstParam) && firstParam.name === "request") {
          // Change parameter name from request to c
          firstParam.name = "c"

          // Update type annotation if present
          if (firstParam.typeAnnotation) {
            firstParam.typeAnnotation = undefined
          }
        }
      }
    },

    // Transform call expressions
    CallExpression(path) {
      transformNextResponse(path)
      transformHeaders(path)
      transformQueryParams(path)
      transformBodyParsing(path)
    },

    // Transform member expressions
    MemberExpression(path) {
      transformParams(path)
    },

    // Transform new URL(request.url) -> new URL(c.req.url)
    NewExpression(path) {
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
          // Transform to: new URL(c.req.url)
          path.node.arguments[0] = t.memberExpression(
            t.memberExpression(t.identifier("c"), t.identifier("req")),
            t.identifier("url"),
          )
        }
      }
    },
  })

  return ast
}
