/**
 * Training Data Collection System for Booking Automation Fine-tuning
 * Captures successful and failed booking flows for model training
 */

import { captureException } from "./captureException"
import { generateSecureId } from "./secureRandom"

export interface TrainingDataPoint {
  // Unique identifier for this training example
  id: string
  timestamp: string

  // Context Information
  user_intent: string // Original booking request
  booking_details: {
    restaurant?: string
    date?: string
    time?: string
    party_size?: number
  }

  // Page State
  page_context: {
    url: string
    title: string
    html_structure: string // Relevant HTML elements
    visible_elements: Array<{
      type: string
      text: string
      attributes: Record<string, string>
      selector: string
    }>
    calendar_state?: {
      is_open: boolean
      displayed_month?: string
      displayed_year?: string
      available_dates?: string[]
    }
  }

  // AI Decision
  ai_response: {
    reasoning: string
    actions: Array<{
      type: string
      params: Record<string, any>
      confidence?: number
    }>
    expected_outcome: string
  }

  // Actual Outcome
  outcome: {
    success: boolean
    error_message?: string
    actual_result: string
    next_page_state?: string
  }

  // Flow Information
  flow_context: {
    step_number: number
    previous_actions: string[]
    conversation_history: Array<{
      role: string
      content: string
      metadata?: any
    }>
  }

  // Labels for Training
  labels: {
    is_positive_example: boolean // True for successful actions
    action_quality: "excellent" | "good" | "poor" | "failed"
    context_understanding: "perfect" | "good" | "partial" | "poor"
    reasoning_quality: "logical" | "acceptable" | "flawed" | "incorrect"
  }
}

export class TrainingDataCollector {
  private static instance: TrainingDataCollector
  private collectedData: TrainingDataPoint[] = []

  static getInstance(): TrainingDataCollector {
    if (!TrainingDataCollector.instance) {
      TrainingDataCollector.instance = new TrainingDataCollector()
    }
    return TrainingDataCollector.instance
  }

  /**
   * Collect a training data point from booking automation
   */
  async collectBookingFlow(data: {
    userIntent: string
    bookingDetails: any
    pageContext: any
    aiResponse: any
    outcome: any
    flowContext: any
  }): Promise<void> {
    const trainingPoint: TrainingDataPoint = {
      id: generateSecureId("booking_"),
      timestamp: new Date().toISOString(),

      user_intent: data.userIntent,
      booking_details: this.extractBookingDetails(data.bookingDetails),
      page_context: this.processPageContext(data.pageContext),
      ai_response: this.processAIResponse(data.aiResponse),
      outcome: this.processOutcome(data.outcome),
      flow_context: this.processFlowContext(data.flowContext),
      labels: this.generateLabels(data.outcome, data.aiResponse),
    }

    // Store in memory (in production, save to database)
    this.collectedData.push(trainingPoint)

    // Log for debugging
    console.log("📊 Training data collected:", {
      id: trainingPoint.id,
      success: trainingPoint.outcome.success,
      action_count: trainingPoint.ai_response.actions.length,
      step: trainingPoint.flow_context.step_number,
    })

    // Save to file system for now (in production, use proper storage)
    await this.saveToFile(trainingPoint)
  }

  /**
   * Extract structured booking details from user request
   */
  private extractBookingDetails(
    details: any,
  ): TrainingDataPoint["booking_details"] {
    return {
      restaurant:
        details.restaurant ||
        this.extractRestaurantFromText(details.userIntent),
      date: details.date,
      time: details.time,
      party_size: details.partySize || details.party_size,
    }
  }

  /**
   * Process page context for training
   */
  private processPageContext(context: any): TrainingDataPoint["page_context"] {
    return {
      url: context.url || "unknown",
      title: context.title || "unknown",
      html_structure: this.sanitizeHTML(
        context.html || context.htmlStructure || "",
      ),
      visible_elements: this.extractVisibleElements(context.elements || []),
      calendar_state: this.extractCalendarState(context),
    }
  }

  /**
   * Process AI response for training
   */
  private processAIResponse(response: any): TrainingDataPoint["ai_response"] {
    return {
      reasoning:
        response.reasoning || response.reason || "No reasoning provided",
      actions: Array.isArray(response.actions)
        ? response.actions
        : [response.action].filter(Boolean),
      expected_outcome: response.expected_outcome || "Action execution",
    }
  }

  /**
   * Process outcome for training labels
   */
  private processOutcome(outcome: any): TrainingDataPoint["outcome"] {
    return {
      success: outcome.success || false,
      error_message: outcome.error || outcome.error_message,
      actual_result:
        outcome.result || outcome.actual_result || "Unknown result",
      next_page_state: outcome.next_state || outcome.next_page_state,
    }
  }

  /**
   * Process flow context
   */
  private processFlowContext(context: any): TrainingDataPoint["flow_context"] {
    return {
      step_number: context.step || context.step_number || 1,
      previous_actions: context.previous_actions || [],
      conversation_history: context.conversation_history || [],
    }
  }

  /**
   * Generate training labels based on outcome
   */
  private generateLabels(
    outcome: any,
    aiResponse: any,
  ): TrainingDataPoint["labels"] {
    const success = outcome.success || false

    return {
      is_positive_example: success,
      action_quality: success
        ? "excellent"
        : outcome.partial_success
          ? "good"
          : "failed",
      context_understanding: this.assessContextUnderstanding(
        aiResponse,
        outcome,
      ),
      reasoning_quality: this.assessReasoningQuality(aiResponse, outcome),
    }
  }

  /**
   * Assess how well AI understood the context
   */
  private assessContextUnderstanding(
    aiResponse: any,
    outcome: any,
  ): TrainingDataPoint["labels"]["context_understanding"] {
    if (outcome.success && aiResponse.actions?.length > 0) return "perfect"
    if (outcome.partial_success) return "good"
    if (aiResponse.actions?.length > 0) return "partial"
    return "poor"
  }

  /**
   * Assess quality of AI reasoning
   */
  private assessReasoningQuality(
    aiResponse: any,
    outcome: any,
  ): TrainingDataPoint["labels"]["reasoning_quality"] {
    const hasReasoning =
      aiResponse.reasoning && aiResponse.reasoning.length > 10
    if (outcome.success && hasReasoning) return "logical"
    if (outcome.success || hasReasoning) return "acceptable"
    if (aiResponse.actions?.length > 0) return "flawed"
    return "incorrect"
  }

  /**
   * Utility methods
   */
  private extractRestaurantFromText(text: string): string | undefined {
    const match = text.match(/(?:at|restaurant)\s+([^,\n]+)/i)
    return match?.[1]?.trim()
  }

  private sanitizeHTML(html: string): string {
    // Remove sensitive data, keep structure
    return html
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[DATE]")
      .replace(/\b\d{1,2}:\d{2}\s*(AM|PM)?\b/gi, "[TIME]")
      .substring(0, 5000) // Limit size
  }

  private extractVisibleElements(
    elements: any[],
  ): TrainingDataPoint["page_context"]["visible_elements"] {
    return elements.slice(0, 50).map((el) => ({
      type: el.tagName || el.type || "unknown",
      text: (el.textContent || el.text || "").substring(0, 100),
      attributes: el.attributes || {},
      selector: el.selector || el.cssSelector || "",
    }))
  }

  private extractCalendarState(
    context: any,
  ): TrainingDataPoint["page_context"]["calendar_state"] | undefined {
    if (!context.calendar && !context.calendarState) return undefined

    const calendarData = context.calendar || context.calendarState || {}
    return {
      is_open: calendarData.isOpen || false,
      displayed_month: calendarData.month || calendarData.displayedMonth,
      displayed_year: calendarData.year || calendarData.displayedYear,
      available_dates: calendarData.availableDates || [],
    }
  }

  /**
   * Save training data to file (temporary solution)
   */
  private async saveToFile(data: TrainingDataPoint): Promise<void> {
    try {
      const fs = await import("node:fs/promises")
      const path = await import("node:path")

      const trainingDir = path.join(process.cwd(), "training-data")

      // Ensure directory exists
      try {
        await fs.access(trainingDir)
      } catch {
        await fs.mkdir(trainingDir, { recursive: true })
      }

      const filename = `${data.id}.json`
      const filepath = path.join(trainingDir, filename)

      await fs.writeFile(filepath, JSON.stringify(data, null, 2))
    } catch (error) {
      captureException(error)
      console.error("Failed to save training data:", error)
    }
  }

  /**
   * Export collected data for fine-tuning
   */
  async exportForFineTuning(
    format: "jsonl" | "json" = "jsonl",
  ): Promise<string> {
    const positiveExamples = this.collectedData.filter(
      (d) => d.labels.is_positive_example,
    )
    const negativeExamples = this.collectedData.filter(
      (d) => !d.labels.is_positive_example,
    )

    console.log(`📊 Training data summary:
    - Total examples: ${this.collectedData.length}
    - Positive examples: ${positiveExamples.length}
    - Negative examples: ${negativeExamples.length}
    - Success rate: ${((positiveExamples.length / this.collectedData.length) * 100).toFixed(1)}%`)

    if (format === "jsonl") {
      return this.collectedData
        .map((d) => JSON.stringify(this.convertToFineTuningFormat(d)))
        .join("\n")
    } else {
      return JSON.stringify(
        this.collectedData.map((d) => this.convertToFineTuningFormat(d)),
        null,
        2,
      )
    }
  }

  /**
   * Convert training data to fine-tuning format
   */
  private convertToFineTuningFormat(data: TrainingDataPoint) {
    return {
      messages: [
        {
          role: "system",
          content:
            "You are a booking automation assistant. Analyze the page context and generate appropriate actions.",
        },
        {
          role: "user",
          content: `Intent: ${data.user_intent}\nPage: ${data.page_context.title}\nElements: ${JSON.stringify(data.page_context.visible_elements.slice(0, 10))}`,
        },
        {
          role: "assistant",
          content: `Reasoning: ${data.ai_response.reasoning}\nActions: ${JSON.stringify(data.ai_response.actions)}`,
        },
      ],
      metadata: {
        success: data.outcome.success,
        quality: data.labels.action_quality,
        step: data.flow_context.step_number,
      },
    }
  }

  /**
   * Get statistics about collected data
   */
  getStats() {
    const total = this.collectedData.length
    const successful = this.collectedData.filter(
      (d) => d.outcome.success,
    ).length
    const byQuality = this.collectedData.reduce(
      (acc, d) => {
        acc[d.labels.action_quality] = (acc[d.labels.action_quality] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return {
      total_examples: total,
      success_rate:
        total > 0 ? `${((successful / total) * 100).toFixed(1)}%` : "0%",
      quality_distribution: byQuality,
      latest_collection: this.collectedData[total - 1]?.timestamp,
    }
  }
}

// Export singleton instance
export const trainingDataCollector = TrainingDataCollector.getInstance()
