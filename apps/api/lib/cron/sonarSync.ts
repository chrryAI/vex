import type { newSonarIssue, newSonarMetric } from "@repo/db"
import { db, desc, eq, sonarIssues, sonarMetrics } from "@repo/db"
import { syncIssuesToGraph, syncMetricsToGraph } from "../graph/sonarGraphSync"

const SONAR_CLOUD_URL = "https://sonarcloud.io/api"
const SONAR_TOKEN = process.env.SONAR_TOKEN
const PROJECT_KEY = "chrryAI_vex"

/**
 * Check if there's a new analysis since last sync
 */
async function _hasNewAnalysis(projectKey: string): Promise<{
  hasNew: boolean
  lastAnalysis?: Date
  lastSync?: Date
}> {
  try {
    // Get last analysis time from SonarCloud
    const url = new URL(`${SONAR_CLOUD_URL}/project_analyses/search`)
    url.searchParams.set("project", projectKey)
    url.searchParams.set("ps", "1") // Only get the latest

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${SONAR_TOKEN}`,
      },
    })

    if (!response.ok) {
      console.warn("⚠️ Could not fetch analysis history, proceeding with sync")
      return { hasNew: true }
    }

    const data = await response.json()
    const lastAnalysis = data.analyses?.[0]?.date
      ? new Date(data.analyses[0].date)
      : null

    if (!lastAnalysis) {
      console.log("ℹ️ No analysis found, skipping sync")
      return { hasNew: false }
    }

    // Get last sync time from our database
    const lastMetric = await db
      .select()
      .from(sonarMetrics)
      .where(eq(sonarMetrics.projectKey, projectKey))
      .orderBy(desc(sonarMetrics.measuredAt))
      .limit(1)

    const lastSync = lastMetric[0]?.measuredAt

    if (!lastSync) {
      console.log("🆕 First sync, proceeding...")
      return { hasNew: true, lastAnalysis }
    }

    const hasNew = lastAnalysis > lastSync

    if (hasNew) {
      console.log(
        `🔔 New analysis detected: ${lastAnalysis.toISOString()} (last sync: ${lastSync.toISOString()})`,
      )
    } else {
      console.log(
        `✓ Already up to date (last analysis: ${lastAnalysis.toISOString()})`,
      )
    }

    return { hasNew, lastAnalysis, lastSync }
  } catch (error) {
    console.error("❌ Error checking analysis time:", error)
    // On error, proceed with sync to be safe
    return { hasNew: true }
  }
}

interface SonarIssue {
  key: string
  rule: string
  severity: string
  component: string
  project: string
  line?: number
  message: string
  status: string
  type: string
  creationDate: string
  updateDate: string
  closeDate?: string
}

interface SonarMetric {
  metric: string
  value: string
}

/**
 * Fetch issues from SonarCloud API
 */
async function fetchSonarIssues(projectKey: string): Promise<SonarIssue[]> {
  if (!SONAR_TOKEN) {
    console.error("❌ SONAR_TOKEN not configured")
    return []
  }

  const issues: SonarIssue[] = []
  let page = 1
  const pageSize = 500

  try {
    while (true) {
      const url = new URL(`${SONAR_CLOUD_URL}/issues/search`)
      url.searchParams.set("componentKeys", projectKey)
      url.searchParams.set("p", page.toString())
      url.searchParams.set("ps", pageSize.toString())
      url.searchParams.set("resolved", "false") // Only unresolved issues

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${SONAR_TOKEN}`,
        },
      })

      if (!response.ok) {
        throw new Error(`SonarCloud API error: ${response.statusText}`)
      }

      const data = await response.json()
      issues.push(...data.issues)

      // Check if there are more pages
      if (data.paging.pageIndex * data.paging.pageSize >= data.paging.total) {
        break
      }

      page++
    }

    console.log(`✅ Fetched ${issues.length} issues from SonarCloud`)
    return issues
  } catch (error) {
    console.error("❌ Failed to fetch SonarCloud issues:", error)
    return []
  }
}

/**
 * Fetch metrics from SonarCloud API
 */
async function fetchSonarMetrics(projectKey: string): Promise<SonarMetric[]> {
  if (!SONAR_TOKEN) {
    console.error("❌ SONAR_TOKEN not configured")
    return []
  }

  try {
    const metricKeys = [
      "bugs",
      "vulnerabilities",
      "code_smells",
      "security_hotspots",
      "coverage",
      "duplicated_lines_density",
      "ncloc", // Lines of code
      "sqale_index", // Technical debt
      "reliability_rating",
      "security_rating",
      "sqale_rating", // Maintainability rating
    ]

    const url = new URL(`${SONAR_CLOUD_URL}/measures/component`)
    url.searchParams.set("component", projectKey)
    url.searchParams.set("metricKeys", metricKeys.join(","))

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${SONAR_TOKEN}`,
      },
    })

    if (!response.ok) {
      throw new Error(`SonarCloud API error: ${response.statusText}`)
    }

    const data = await response.json()
    const metrics = data.component.measures.map((m: any) => ({
      metric: m.metric,
      value: m.value,
    }))

    console.log(`✅ Fetched ${metrics.length} metrics from SonarCloud`)
    return metrics
  } catch (error) {
    console.error("❌ Failed to fetch SonarCloud metrics:", error)
    return []
  }
}

/**
 * Upsert issues into database
 */
async function upsertIssues(issues: SonarIssue[]): Promise<void> {
  for (const issue of issues) {
    // Extract file path from component (remove project key prefix)
    const filePath = issue.component.replace(`${issue.project}:`, "")

    const dbIssue: newSonarIssue = {
      id: issue.key,
      projectKey: issue.project,
      ruleKey: issue.rule,
      severity: issue.severity as any,
      type: issue.type as any,
      status: issue.status as any,
      filePath,
      lineNumber: issue.line,
      message: issue.message,
      createdAt: new Date(issue.creationDate),
      updatedAt: new Date(issue.updateDate),
      resolvedAt: issue.closeDate ? new Date(issue.closeDate) : null,
      syncedAt: new Date(),
    }

    try {
      // Upsert: insert or update if exists
      await db
        .insert(sonarIssues)
        .values(dbIssue)
        .onConflictDoUpdate({
          target: sonarIssues.id,
          set: {
            status: dbIssue.status,
            updatedAt: dbIssue.updatedAt,
            resolvedAt: dbIssue.resolvedAt,
            syncedAt: dbIssue.syncedAt,
          },
        })
    } catch (error) {
      console.error(`❌ Failed to upsert issue ${issue.key}:`, error)
    }
  }

  console.log(`✅ Upserted ${issues.length} issues to database`)
}

/**
 * Insert metrics into database
 */
async function insertMetrics(
  projectKey: string,
  metrics: SonarMetric[],
): Promise<void> {
  const measuredAt = new Date()

  for (const metric of metrics) {
    const dbMetric: newSonarMetric = {
      projectKey,
      metricKey: metric.metric,
      value: parseFloat(metric.value) || 0,
      measuredAt,
      syncedAt: new Date(),
    }

    try {
      await db.insert(sonarMetrics).values(dbMetric)
    } catch (error) {
      console.error(`❌ Failed to insert metric ${metric.metric}:`, error)
    }
  }

  console.log(`✅ Inserted ${metrics.length} metrics to database`)
}

/**
 * Main sync function - called by cron
 */
export async function syncSonarCloud(): Promise<void> {
  console.log("🔄 Starting SonarCloud sync...")

  const projects = [PROJECT_KEY]

  for (const project of projects) {
    console.log(`📊 Syncing project: ${project}`)

    // Fetch and upsert issues
    const issues = await fetchSonarIssues(project)
    if (issues.length > 0) {
      await upsertIssues(issues)

      // Sync issues to graph database
      try {
        const graphIssues = issues.map((issue) => ({
          key: issue.key,
          severity: issue.severity,
          type: issue.type,
          message: issue.message,
          status: issue.status,
          filePath: issue.component.replace(`${issue.project}:`, ""),
          lineNumber: issue.line,
          ruleKey: issue.rule,
        }))
        await syncIssuesToGraph(graphIssues)
      } catch (error) {
        console.error("⚠️ Graph sync failed for issues:", error)
      }
    }

    // Fetch and insert metrics
    const metrics = await fetchSonarMetrics(project)
    if (metrics.length > 0) {
      const measuredAt = new Date()
      await insertMetrics(project, metrics)

      // Sync metrics to graph database
      try {
        const graphMetrics = metrics.map((m) => ({
          metricKey: m.metric,
          value: parseFloat(m.value) || 0,
        }))
        await syncMetricsToGraph(project, graphMetrics, measuredAt)
      } catch (error) {
        console.error("⚠️ Graph sync failed for metrics:", error)
      }
    }
  }

  console.log("✅ SonarCloud sync completed")
}
