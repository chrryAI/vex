import { createHmac } from "node:crypto"
import type { newSonarMetric } from "@repo/db"
import { db, sonarIssues, sonarMetrics } from "@repo/db"
import { Hono } from "hono"
import { captureException } from "../../lib/captureException"

const SONAR_WEBHOOK_SECRET = process.env.SONAR_WEBHOOK_SECRET
const SONAR_CLOUD_URL = "https://sonarcloud.io/api"
const SONAR_TOKEN = process.env.SONAR_TOKEN

export const sonarWebhook = new Hono()

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifySignature(payload: string, signature: string): boolean {
  if (!SONAR_WEBHOOK_SECRET) {
    console.warn("⚠️ SONAR_WEBHOOK_SECRET not configured, skipping verification")
    return true // Allow in dev/testing
  }

  const expectedSignature = createHmac("sha256", SONAR_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex")
    .toLowerCase()

  return expectedSignature === signature.toLowerCase()
}

/**
 * Fetch detailed issue information from SonarCloud API
 */
async function fetchIssueDetails(issueKey: string) {
  if (!SONAR_TOKEN) {
    console.error("❌ SONAR_TOKEN not configured")
    return null
  }

  try {
    const url = new URL(`${SONAR_CLOUD_URL}/issues/search`)
    url.searchParams.set("issues", issueKey)

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${SONAR_TOKEN}`,
      },
    })

    if (!response.ok) {
      throw new Error(`SonarCloud API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.issues?.[0] || null
  } catch (error) {
    console.error(`❌ Failed to fetch issue ${issueKey}:`, error)
    captureException(error)
    return null
  }
}

/**
 * Fetch metrics from SonarCloud API
 */
async function fetchMetrics(projectKey: string) {
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
      "ncloc",
      "sqale_index",
      "reliability_rating",
      "security_rating",
      "sqale_rating",
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
    return data.component.measures || []
  } catch (error) {
    console.error("❌ Failed to fetch metrics:", error)
    captureException(error)
    return []
  }
}

/**
 * SonarCloud Webhook Handler
 *
 * Receives notifications when:
 * - A project analysis is complete
 * - An issue type, severity, or status is updated
 */
sonarWebhook.post("/", async (c) => {
  try {
    const rawBody = await c.req.text()
    const signature = c.req.header("X-Sonar-Webhook-HMAC-SHA256")

    // Verify signature
    if (signature && !verifySignature(rawBody, signature)) {
      console.error("❌ Invalid webhook signature")
      return c.json({ error: "Invalid signature" }, 401)
    }

    const payload = JSON.parse(rawBody)

    console.log("🔔 SonarCloud webhook received:", {
      project: payload.project?.key,
      status: payload.qualityGate?.status,
      analysedAt: payload.analysedAt,
    })

    // Extract project info
    const projectKey = payload.project?.key
    if (!projectKey) {
      console.error("❌ Missing project key in webhook payload")
      return c.json({ error: "Missing project key" }, 400)
    }

    // Store metrics snapshot
    const measuredAt = new Date(payload.analysedAt)
    const metrics = await fetchMetrics(projectKey)

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

    console.log(`✅ Stored ${metrics.length} metrics for ${projectKey}`)

    // Handle quality gate status change
    if (payload.qualityGate) {
      const status = payload.qualityGate.status
      console.log(`📊 Quality Gate Status: ${status}`)

      // You can add notifications here (e.g., Slack, Discord, email)
      if (status === "ERROR") {
        console.warn(`⚠️ Quality gate failed for ${projectKey}`)
        // TODO: Send alert to team
      }
    }

    // Handle issue updates (if provided in payload)
    // Note: SonarCloud webhooks don't include full issue details,
    // so we'd need to fetch them separately if needed
    if (payload.properties?.["sonar.analysis.issueKey"]) {
      const issueKey = payload.properties["sonar.analysis.issueKey"]
      const issueDetails = await fetchIssueDetails(issueKey)

      if (issueDetails) {
        // Update issue in database
        const filePath = issueDetails.component.replace(
          `${issueDetails.project}:`,
          "",
        )

        await db
          .insert(sonarIssues)
          .values({
            id: issueDetails.key,
            projectKey: issueDetails.project,
            ruleKey: issueDetails.rule,
            severity: issueDetails.severity,
            type: issueDetails.type,
            status: issueDetails.status,
            filePath,
            lineNumber: issueDetails.line,
            message: issueDetails.message,
            createdAt: new Date(issueDetails.creationDate),
            updatedAt: new Date(issueDetails.updateDate),
            resolvedAt: issueDetails.closeDate
              ? new Date(issueDetails.closeDate)
              : null,
            syncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: sonarIssues.id,
            set: {
              status: issueDetails.status,
              updatedAt: new Date(issueDetails.updateDate),
              resolvedAt: issueDetails.closeDate
                ? new Date(issueDetails.closeDate)
                : null,
              syncedAt: new Date(),
            },
          })

        console.log(`✅ Updated issue ${issueKey}`)
      }
    }

    return c.json({ success: true })
  } catch (error) {
    console.error("❌ SonarCloud webhook error:", error)
    captureException(error)
    return c.json({ error: "Internal server error" }, 500)
  }
})
