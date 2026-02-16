import { graph } from "@repo/db"
import type { ASTNode } from "./parseCodebase"

export async function storeASTInGraph(
  nodes: ASTNode[],
  repoName: string,
  commitHash: string,
) {
  console.log(
    `📊 Storing ${nodes.length} AST nodes in FalkorDB graph for ${repoName}...`,
  )

  try {
    // Create or update repository node
    await graph.query(
      `
      MERGE (r:REPO {name: $repoName})
      ON CREATE SET 
        r.createdAt = timestamp(),
        r.commitHash = $commitHash
      ON MATCH SET 
        r.updatedAt = timestamp(),
        r.commitHash = $commitHash
      RETURN r
    `,
      {
        params: {
          repoName,
          commitHash,
        },
      },
    )

    // Process nodes by type
    const fileNodes = nodes.filter((n) => n.type === "file")
    const functionNodes = nodes.filter((n) => n.type === "function")
    const classNodes = nodes.filter((n) => n.type === "class")
    const importNodes = nodes.filter((n) => n.type === "import")

    // Store file nodes
    for (const node of fileNodes) {
      await graph.query(
        `
        MATCH (r:REPO {name: $repoName})
        MERGE (f:FILE {id: $id})
        ON CREATE SET 
          f.filepath = $filepath,
          f.name = $name,
          f.content = $content,
          f.startLine = $startLine,
          f.endLine = $endLine,
          f.createdAt = timestamp()
        ON MATCH SET 
          f.updatedAt = timestamp(),
          f.content = $content
        MERGE (r)-[:CONTAINS]->(f)
        RETURN f
      `,
        {
          params: {
            repoName,
            id: node.id,
            filepath: node.filepath,
            name: node.name,
            content: node.content.slice(0, 1000), // Limit content size
            startLine: node.startLine,
            endLine: node.endLine,
          },
        },
      )
    }

    // Store function nodes
    for (const node of functionNodes) {
      await graph.query(
        `
        MATCH (f:FILE {id: $filepath})
        MERGE (fn:FUNCTION {id: $id})
        ON CREATE SET 
          fn.name = $name,
          fn.filepath = $filepath,
          fn.content = $content,
          fn.startLine = $startLine,
          fn.endLine = $endLine,
          fn.params = $params,
          fn.createdAt = timestamp()
        ON MATCH SET 
          fn.updatedAt = timestamp(),
          fn.content = $content
        MERGE (f)-[:CONTAINS]->(fn)
        RETURN fn
      `,
        {
          params: {
            filepath: node.filepath,
            id: node.id,
            name: node.name,
            content: node.content.slice(0, 1000),
            startLine: node.startLine,
            endLine: node.endLine,
            params: JSON.stringify(node.params || []),
          },
        },
      )

      // Create function call relationships
      if (node.calls && node.calls.length > 0) {
        for (const calledFunction of node.calls) {
          try {
            await graph.query(
              `
              MATCH (caller:FUNCTION {id: $callerId})
              MATCH (callee:FUNCTION)
              WHERE callee.name = $calleeName
              MERGE (caller)-[:CALLS]->(callee)
              RETURN caller, callee
            `,
              {
                params: {
                  callerId: node.id,
                  calleeName: calledFunction,
                },
              },
            )
          } catch (error) {
            // Ignore if callee doesn't exist yet
          }
        }
      }
    }

    // Store class nodes
    for (const node of classNodes) {
      await graph.query(
        `
        MATCH (f:FILE {id: $filepath})
        MERGE (c:CLASS {id: $id})
        ON CREATE SET 
          c.name = $name,
          c.filepath = $filepath,
          c.content = $content,
          c.startLine = $startLine,
          c.endLine = $endLine,
          c.createdAt = timestamp()
        ON MATCH SET 
          c.updatedAt = timestamp(),
          c.content = $content
        MERGE (f)-[:CONTAINS]->(c)
        RETURN c
      `,
        {
          params: {
            filepath: node.filepath,
            id: node.id,
            name: node.name,
            content: node.content.slice(0, 1000),
            startLine: node.startLine,
            endLine: node.endLine,
          },
        },
      )

      // Create class inheritance relationships
      if (node.metadata?.superClass) {
        try {
          await graph.query(
            `
            MATCH (child:CLASS {id: $childId})
            MATCH (parent:CLASS)
            WHERE parent.name = $parentName
            MERGE (child)-[:EXTENDS]->(parent)
            RETURN child, parent
          `,
            {
              params: {
                childId: node.id,
                parentName: node.metadata.superClass as string,
              },
            },
          )
        } catch (error) {
          // Ignore if parent class doesn't exist
        }
      }
    }

    // Store import nodes
    for (const node of importNodes) {
      await graph.query(
        `
        MATCH (f:FILE {id: $filepath})
        MERGE (i:IMPORT {id: $id})
        ON CREATE SET 
          i.source = $source,
          i.specifiers = $specifiers,
          i.createdAt = timestamp()
        ON MATCH SET 
          i.updatedAt = timestamp()
        MERGE (f)-[:IMPORTS]->(i)
        RETURN i
      `,
        {
          params: {
            filepath: node.filepath,
            id: node.id,
            source: node.name,
            specifiers: JSON.stringify(node.imports || []),
          },
        },
      )
    }

    console.log(`✅ Stored ${nodes.length} nodes in FalkorDB graph`)
  } catch (error) {
    console.error("❌ Failed to store AST in FalkorDB:", error)
    throw error
  }
}

export async function queryCodeGraph(query: string): Promise<any> {
  try {
    const result = await graph.query(query)
    return result
  } catch (error) {
    console.error("❌ Failed to query code graph:", error)
    throw error
  }
}

// Helper: Find all functions that call a specific function
export async function findFunctionCallers(functionName: string): Promise<any> {
  return queryCodeGraph(`
    MATCH (caller:FUNCTION)-[:CALLS]->(callee:FUNCTION {name: '${functionName}'})
    RETURN caller.name, caller.filepath, caller.startLine
  `)
}

// Helper: Find all files that import a specific module
export async function findImportUsage(moduleName: string): Promise<any> {
  return queryCodeGraph(`
    MATCH (f:FILE)-[:IMPORTS]->(i:IMPORT)
    WHERE i.source CONTAINS '${moduleName}'
    RETURN f.filepath, i.source, i.specifiers
  `)
}

// Helper: Get function call chain
export async function getFunctionCallChain(
  functionName: string,
  depth: number = 3,
): Promise<any> {
  return queryCodeGraph(`
    MATCH path = (f:FUNCTION {name: '${functionName}'})-[:CALLS*1..${depth}]->(called:FUNCTION)
    RETURN path
  `)
}
