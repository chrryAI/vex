import { parse } from "@babel/parser"
import traverse from "@babel/traverse"
import * as t from "@babel/types"
import type { NodePath } from "@babel/traverse"
import fs from "fs"

export interface ASTNode {
  id: string
  type: "file" | "function" | "class" | "import" | "export"
  name: string
  filepath: string
  content: string
  startLine: number
  endLine: number
  params?: string[]
  returns?: string
  imports?: string[]
  exports?: string[]
  calls?: string[]
  metadata?: Record<string, unknown>
}

export async function parseFile(filepath: string): Promise<ASTNode[]> {
  const nodes: ASTNode[] = []

  try {
    const code = fs.readFileSync(filepath, "utf-8")

    // Add file node
    const lineCount = code.split("\n").length
    nodes.push({
      id: filepath,
      type: "file",
      name: filepath.split("/").pop() || filepath,
      filepath,
      content: code.slice(0, 500), // First 500 chars for preview
      startLine: 1,
      endLine: lineCount,
      metadata: {
        loc: lineCount,
        size: code.length,
      },
    })

    const ast = parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      errorRecovery: true, // Continue parsing even with errors
    })

    const functionCalls: string[] = []

    traverse(ast, {
      // Parse function declarations
      FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
        const node = path.node
        const functionName = node.id?.name || "anonymous"

        nodes.push({
          id: `${filepath}:${functionName}`,
          type: "function",
          name: functionName,
          filepath,
          content: code.slice(node.start!, node.end!),
          startLine: node.loc?.start.line || 0,
          endLine: node.loc?.end.line || 0,
          params: node.params.map((p: t.Node) =>
            t.isIdentifier(p) ? p.name : "unknown",
          ),
          calls: [],
          metadata: {
            async: node.async,
            generator: node.generator,
          },
        })
      },

      // Parse arrow functions assigned to variables
      VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
        if (
          t.isArrowFunctionExpression(path.node.init) &&
          t.isIdentifier(path.node.id)
        ) {
          const functionName = path.node.id.name
          const node = path.node.init

          nodes.push({
            id: `${filepath}:${functionName}`,
            type: "function",
            name: functionName,
            filepath,
            content: code.slice(node.start!, node.end!),
            startLine: node.loc?.start.line || 0,
            endLine: node.loc?.end.line || 0,
            params: node.params.map((p: t.Node) =>
              t.isIdentifier(p) ? p.name : "unknown",
            ),
            calls: [],
            metadata: {
              async: node.async,
              arrow: true,
            },
          })
        }
      },

      // Parse class declarations
      ClassDeclaration(path: NodePath<t.ClassDeclaration>) {
        const node = path.node
        const className = node.id?.name || "anonymous"

        nodes.push({
          id: `${filepath}:${className}`,
          type: "class",
          name: className,
          filepath,
          content: code.slice(node.start!, node.end!),
          startLine: node.loc?.start.line || 0,
          endLine: node.loc?.end.line || 0,
          metadata: {
            superClass: node.superClass
              ? t.isIdentifier(node.superClass)
                ? node.superClass.name
                : "unknown"
              : null,
          },
        })
      },

      // Parse imports
      ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
        const source = path.node.source.value
        const specifiers = path.node.specifiers.map((s: t.Node) =>
          t.isImportDefaultSpecifier(s)
            ? s.local.name
            : t.isImportSpecifier(s)
              ? t.isIdentifier(s.imported)
                ? s.imported.name
                : "unknown"
              : "unknown",
        )

        nodes.push({
          id: `${filepath}:import:${source}`,
          type: "import",
          name: source,
          filepath,
          content: code.slice(path.node.start!, path.node.end!),
          startLine: path.node.loc?.start.line || 0,
          endLine: path.node.loc?.end.line || 0,
          imports: specifiers,
        })
      },

      // Parse exports
      ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
        const node = path.node
        const exportNames: string[] = []

        if (node.declaration) {
          if (t.isFunctionDeclaration(node.declaration)) {
            exportNames.push(node.declaration.id?.name || "anonymous")
          } else if (t.isVariableDeclaration(node.declaration)) {
            node.declaration.declarations.forEach(
              (decl: t.VariableDeclarator) => {
                if (t.isIdentifier(decl.id)) {
                  exportNames.push(decl.id.name)
                }
              },
            )
          }
        }

        if (exportNames.length > 0) {
          nodes.push({
            id: `${filepath}:export:${exportNames.join(",")}`,
            type: "export",
            name: exportNames.join(", "),
            filepath,
            content: code.slice(node.start!, node.end!),
            startLine: node.loc?.start.line || 0,
            endLine: node.loc?.end.line || 0,
            exports: exportNames,
          })
        }
      },

      // Track function calls
      CallExpression(path: NodePath<t.CallExpression>) {
        if (t.isIdentifier(path.node.callee)) {
          functionCalls.push(path.node.callee.name)
        } else if (t.isMemberExpression(path.node.callee)) {
          if (t.isIdentifier(path.node.callee.property)) {
            functionCalls.push(path.node.callee.property.name)
          }
        }
      },
    })

    // Add function calls to function nodes
    nodes.forEach((node) => {
      if (node.type === "function") {
        node.calls = [...new Set(functionCalls)] // Deduplicate
      }
    })
  } catch (error) {
    console.error(`❌ Failed to parse ${filepath}:`, error)
    // Return file node even if parsing fails
    return nodes.filter((n) => n.type === "file")
  }

  return nodes
}

export async function parseDirectory(
  dirPath: string,
  options: {
    extensions?: string[]
    exclude?: string[]
  } = {},
): Promise<ASTNode[]> {
  const {
    extensions = [".ts", ".tsx", ".js", ".jsx"],
    exclude = ["node_modules", "dist", "build", ".next", "coverage"],
  } = options

  const allNodes: ASTNode[] = []

  async function walkDir(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = `${currentPath}/${entry.name}`

      // Skip excluded directories
      if (exclude.some((ex) => fullPath.includes(ex))) {
        continue
      }

      if (entry.isDirectory()) {
        await walkDir(fullPath)
      } else if (entry.isFile()) {
        const ext = entry.name.slice(entry.name.lastIndexOf("."))
        if (extensions.includes(ext)) {
          const nodes = await parseFile(fullPath)
          allNodes.push(...nodes)
        }
      }
    }
  }

  await walkDir(dirPath)
  return allNodes
}
