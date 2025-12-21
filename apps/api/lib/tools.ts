import { z } from "zod"
import {
  updateCalendarEvent,
  getCalendarEvent,
  createCalendarEvent,
  deleteCalendarEvent,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  createSharedExpense,
  getSharedExpenses,
  updateSharedExpense,
  deleteSharedExpense,
  budgetCategory,
  user,
  subscription,
  guest,
  getCalendarEvents,
  createMood,
  createTask,
  updateTask,
  deleteTask,
  updateTimer,
  getLastMood,
  updateMood,
} from "@repo/db"
import { expenseCategoryType } from "@chrryai/chrry/utils"

import { notify } from "./notify"

export const getTools = ({
  member,
  guest,
  currentThreadId,
  currentMessageId,
}: {
  member?: user & { subscription?: subscription }
  guest?: guest
  currentThreadId?: string
  currentMessageId?: string
}) => {
  const calendarTools = {
    createCalendarEvent: {
      description:
        "Create a new calendar event for the user. Use this when the user wants to schedule something, add an event, or remember a date. IMPORTANT: Use the current date and time as reference. Today is " +
        new Date().toISOString().split("T")[0] +
        ". The current time is " +
        new Date().toISOString() +
        ".",
      inputSchema: z.object({
        title: z.string().describe("The title/name of the event"),
        description: z
          .string()
          .optional()
          .describe("Optional description or notes about the event"),
        startTime: z
          .string()
          .describe(
            "Start time in ISO 8601 format with timezone (e.g., 2024-01-15T14:30:00+01:00). Use the user's timezone if known, otherwise use UTC.",
          ),
        endTime: z
          .string()
          .describe(
            "End time in ISO 8601 format with timezone (e.g., 2024-01-15T16:00:00+01:00). Use the user's timezone if known, otherwise use UTC.",
          ),
        location: z
          .string()
          .optional()
          .describe("Optional location of the event"),
      }),
      execute: async ({
        title,
        description,
        startTime,
        endTime,
        location,
      }: {
        title: string
        description?: string
        startTime: string
        endTime: string
        location?: string
      }) => {
        console.log("📆 Creating calendar event:", {
          title,
          description,
          startTime,
          endTime,
          location,
          parsedStartTime: new Date(startTime),
          parsedEndTime: new Date(endTime),
        })

        const event = await createCalendarEvent({
          title,
          description,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          location,
          userId: member?.id,
          guestId: guest?.id,
          threadId: currentThreadId,
        })

        console.log("✅ Calendar event created:", {
          id: event?.id,
          title: event?.title,
          startTime: event?.startTime,
          endTime: event?.endTime,
        })
        return {
          success: true,
          eventId: event?.id,
          event,
          message: `Created event "${title}" (ID: ${event?.id}). You can update or delete this event by referencing this ID.`,
        }
      },
    },
    updateCalendarEvent: {
      description:
        "Update an existing calendar event. Use this when the user wants to modify, reschedule, or change event details. If no event ID is provided, it will find the most recent event in this conversation thread.",
      inputSchema: z.object({
        id: z
          .string()
          .optional()
          .describe(
            "The ID of the event to update. If not provided, will use the most recent event from this conversation.",
          ),
        title: z.string().optional().describe("New title for the event"),
        description: z
          .string()
          .optional()
          .describe("New description for the event"),
        startTime: z
          .string()
          .optional()
          .describe("New start time in ISO 8601 format"),
        endTime: z
          .string()
          .optional()
          .describe("New end time in ISO 8601 format"),
        location: z.string().optional().describe("New location for the event"),
      }),
      execute: async ({
        id,
        title,
        description,
        startTime,
        endTime,
        location,
      }: {
        id?: string
        title?: string
        description?: string
        startTime?: string
        endTime?: string
        location?: string
      }) => {
        console.log("📝 Updating calendar event:", {
          id,
          title,
          description,
          startTime,
          endTime,
          location,
        })

        // If no ID provided, find the most recent event in this thread
        let eventToUpdate
        if (id) {
          eventToUpdate = await getCalendarEvent({
            id,
            userId: member?.id,
            guestId: guest?.id,
          })
        } else {
          // Get all events from this thread
          const threadEvents = await getCalendarEvents({
            userId: member?.id,
            guestId: guest?.id,
          })
          // Filter by threadId and get the most recent
          const eventsInThread = threadEvents.filter(
            (e: any) => e.threadId === currentThreadId,
          )
          eventToUpdate = eventsInThread[0] // Most recent (already ordered by desc)
        }

        if (!eventToUpdate) {
          console.log("❌ Event not found:", id || "no ID (searched thread)")
          return {
            success: false,
            message: id
              ? "Event not found"
              : "No calendar events found in this conversation",
          }
        }

        console.log("📋 Existing event:", {
          title: eventToUpdate.title,
          startTime: eventToUpdate.startTime,
          endTime: eventToUpdate.endTime,
        })

        const event = await updateCalendarEvent({
          ...eventToUpdate,
          ...(title && { title }),
          ...(description && { description }),
          ...(startTime && { startTime: new Date(startTime) }),
          ...(endTime && { endTime: new Date(endTime) }),
          ...(location && { location }),
          updatedOn: new Date(),
        })

        console.log("✅ Event updated:", {
          title: event?.title,
          startTime: event?.startTime,
          endTime: event?.endTime,
        })

        return {
          success: true,
          event,
          message: `Updated event "${event?.title}". New details: ${startTime ? `Start: ${new Date(startTime).toLocaleString()}` : ""} ${endTime ? `End: ${new Date(endTime).toLocaleString()}` : ""}`,
        }
      },
    },
    deleteCalendarEvent: {
      description:
        "Delete a calendar event. Use this when the user wants to cancel or remove an event. If no event ID is provided, it will delete the most recent event in this conversation thread.",
      inputSchema: z.object({
        id: z
          .string()
          .optional()
          .describe(
            "The ID of the event to delete. If not provided, will delete the most recent event from this conversation.",
          ),
      }),
      execute: async ({ id }: { id?: string }) => {
        console.log("🗑️ Deleting calendar event:", { id })

        // If no ID provided, find the most recent event in this thread
        let eventToDelete
        if (id) {
          eventToDelete = await getCalendarEvent({
            id,
            userId: member?.id,
            guestId: guest?.id,
          })
        } else {
          // Get all events from this thread
          const threadEvents = await getCalendarEvents({
            userId: member?.id,
            guestId: guest?.id,
          })
          // Filter by threadId and get the most recent
          const eventsInThread = threadEvents.filter(
            (e: any) => e.threadId === currentThreadId,
          )
          eventToDelete = eventsInThread[0] // Most recent (already ordered by desc)
        }

        if (!eventToDelete) {
          console.log("❌ Event not found:", id || "no ID (searched thread)")
          return {
            success: false,
            message: id
              ? "Event not found"
              : "No calendar events found in this conversation",
          }
        }

        console.log("🗑️ Deleting event:", {
          id: eventToDelete.id,
          title: eventToDelete.title,
        })

        await deleteCalendarEvent({ id: eventToDelete.id })

        console.log("✅ Event deleted:", eventToDelete.title)

        return {
          success: true,
          message: `Deleted event: ${eventToDelete.title}`,
        }
      },
    },
  }

  // Define Vault (expense tracking) tools for AI agents
  const vaultTools = {
    createExpense: {
      description:
        "REQUIRED: Track a NEW expense for the user. You MUST call this tool when the user says they spent money, made a purchase, or paid for something (e.g., 'I spent $45 on groceries', 'I bought lunch for $20'). ALWAYS use this tool for new expenses - do NOT just respond with text. Today's date is " +
        new Date().toISOString().split("T")[0] +
        ".",
      inputSchema: z.object({
        amount: z
          .number()
          .describe("Amount in the user's currency (e.g., 45.50 for $45.50)"),
        currency: z
          .string()
          .optional()
          .default("USD")
          .describe("Currency code (USD, EUR, GBP, etc.)"),
        category: z
          .enum([
            "food",
            "transport",
            "entertainment",
            "shopping",
            "bills",
            "health",
            "education",
            "travel",
            "other",
          ])
          .describe("Category of the expense"),
        description: z
          .string()
          .describe("Description of what was purchased or paid for"),
        date: z
          .string()
          .optional()
          .describe(
            "Date of expense in ISO format (YYYY-MM-DD). If not specified, use today.",
          ),
      }),
      execute: async ({
        amount,
        currency = "USD",
        category,
        description,
        date,
      }: {
        amount: number
        currency?: string
        category: string
        description: string
        date?: string
      }) => {
        console.log("💰 Creating expense:", {
          amount,
          currency,
          category,
          description,
          date,
        })

        const amountInCents = Math.round(amount * 100)
        const expenseDate = date ? new Date(date) : new Date()

        const expense = await createExpense({
          amount: amountInCents,
          currency,
          category: category as expenseCategoryType,
          description,
          date: expenseDate,
          userId: member?.id,
          guestId: guest?.id,
          threadId: currentThreadId,
        })

        console.log("✅ Expense created:", {
          id: expense?.id,
          amount: expense?.amount,
          category: expense?.category,
        })

        // Return message that tells AI to respond to user
        const responseMessage = `Expense logged successfully: ${currency} ${amount.toFixed(2)} for ${description} (${category}). Now respond to the user confirming this action in a friendly way.`

        return {
          success: true,
          expenseId: expense?.id,
          expense,
          message: responseMessage,
        }
      },
    },
    updateExpense: {
      description:
        "REQUIRED: Update an existing expense. You MUST call this tool when the user wants to MODIFY or CORRECT a previously logged expense (e.g., 'Actually, that was $50' or 'Change the category to transport'). ALWAYS use this tool for corrections - do NOT just respond with text. If no expense ID is provided, it will automatically update the most recent expense in this conversation.",
      inputSchema: z.object({
        id: z
          .string()
          .optional()
          .describe(
            "The ID of the expense to update. If not provided, will use the most recent expense from this conversation.",
          ),
        amount: z
          .number()
          .optional()
          .describe("New amount in the user's currency"),
        category: z
          .enum([
            "food",
            "transport",
            "entertainment",
            "shopping",
            "bills",
            "health",
            "education",
            "travel",
            "other",
          ])
          .optional()
          .describe("New category"),
        description: z.string().optional().describe("New description"),
      }),
      execute: async ({
        id,
        amount,
        category,
        description,
      }: {
        id?: string
        amount?: number
        category?: string
        description?: string
      }) => {
        console.log("💰 Updating expense:", {
          id,
          amount,
          category,
          description,
        })

        let expenseToUpdate
        if (id) {
          expenseToUpdate = await getExpenses({
            id,
            userId: member?.id,
            guestId: guest?.id,
          })
          expenseToUpdate = expenseToUpdate.expenses[0]
        } else {
          const threadExpenses = await getExpenses({
            threadId: currentThreadId,
            userId: member?.id,
            guestId: guest?.id,
            pageSize: 1,
          })
          expenseToUpdate = threadExpenses.expenses[0]
        }

        if (!expenseToUpdate) {
          console.log("❌ Expense not found")
          return {
            success: false,
            message: id
              ? "Expense not found"
              : "No expenses found in this conversation",
          }
        }

        const updated = await updateExpense({
          ...expenseToUpdate,
          ...(amount && { amount: Math.round(amount * 100) }),
          ...(category && { category: category as expenseCategoryType }),
          ...(description && { description }),
        })

        console.log("✅ Expense updated:", {
          id: updated?.id,
          amount: updated?.amount,
        })

        return {
          success: true,
          expense: updated,
          message: `Updated expense: ${updated?.description}. Now respond to the user confirming the update.`,
        }
      },
    },
    deleteExpense: {
      description:
        "REQUIRED: Delete an expense. You MUST call this tool when the user wants to remove, delete, or cancel an expense entry (e.g., 'delete it', 'remove that expense', 'cancel that'). ALWAYS use this tool for deletions - do NOT just respond with text. If no expense ID is provided, it will delete the most recent expense in this conversation.",
      inputSchema: z.object({
        id: z
          .string()
          .optional()
          .describe(
            "The ID of the expense to delete. If not provided, will delete the most recent expense from this conversation.",
          ),
      }),
      execute: async ({ id }: { id?: string }) => {
        console.log("🗑️ Deleting expense:", { id })

        let expenseToDelete
        if (id) {
          const result = await getExpenses({
            id,
            userId: member?.id,
            guestId: guest?.id,
          })
          expenseToDelete = result.expenses[0]
        } else {
          const threadExpenses = await getExpenses({
            threadId: currentThreadId,
            userId: member?.id,
            guestId: guest?.id,
            pageSize: 1,
          })
          console.log("📊 Thread expenses found:", {
            count: threadExpenses.expenses.length,
            expenses: threadExpenses.expenses.map((e) => ({
              id: e.id,
              description: e.description,
              amount: e.amount,
            })),
          })
          expenseToDelete = threadExpenses.expenses[0]
        }

        if (!expenseToDelete) {
          console.log("❌ Expense not found in thread:", currentThreadId)
          return {
            success: false,
            message: id
              ? "Expense not found with that ID"
              : "No expenses found in this conversation. Please create an expense first before trying to delete it.",
          }
        }

        await deleteExpense({ id: expenseToDelete.id })

        console.log("✅ Expense deleted:", expenseToDelete.description)

        return {
          success: true,
          message: `Deleted expense: ${expenseToDelete.description}. Now respond to the user confirming the deletion.`,
        }
      },
    },
    getExpenseSummary: {
      description:
        "REQUIRED: Get a summary of expenses for the user. You MUST call this tool when the user asks about their spending, wants to see expenses by category, or asks 'how much did I spend on X'. ALWAYS use this tool for spending queries - do NOT just respond with text or make up numbers.",
      inputSchema: z.object({
        category: z
          .enum([
            "food",
            "transport",
            "entertainment",
            "shopping",
            "bills",
            "health",
            "education",
            "travel",
            "other",
          ])
          .optional()
          .describe("Filter by specific category"),
        startDate: z
          .string()
          .optional()
          .describe("Start date in ISO format (YYYY-MM-DD)"),
        endDate: z
          .string()
          .optional()
          .describe("End date in ISO format (YYYY-MM-DD)"),
      }),
      execute: async ({
        category,
        startDate,
        endDate,
      }: {
        category?: string
        startDate?: string
        endDate?: string
      }) => {
        console.log("📊 Getting expense summary:", {
          category,
          startDate,
          endDate,
        })

        const expenses = await getExpenses({
          userId: member?.id,
          guestId: guest?.id,
          category: category as any,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          pageSize: 1000,
        })

        const total = expenses.expenses.reduce(
          (sum, exp) => sum + exp.amount,
          0,
        )
        const totalInDollars = (total / 100).toFixed(2)

        const byCategory = expenses.expenses.reduce(
          (acc, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + exp.amount
            return acc
          },
          {} as Record<string, number>,
        )

        console.log("✅ Expense summary:", {
          count: expenses.expenses.length,
          total: totalInDollars,
        })

        return {
          success: true,
          summary: {
            category: category || "all",
            count: expenses.expenses.length,
            total: totalInDollars,
            currency: "USD",
          },
          message: `Found ${expenses.expenses.length} expense(s) totaling $${totalInDollars}${category ? ` in category: ${category}` : ""}. Now respond to the user with this information in a helpful way.`,
        }
      },
    },
    createBudget: {
      description:
        "REQUIRED: Create a monthly budget for a specific category. You MUST call this tool when the user wants to set a spending limit (e.g., 'Set a $500 budget for groceries', 'I want to limit my food spending to $300/month'). ALWAYS use this tool for budget creation - do NOT just respond with text.",
      inputSchema: z.object({
        category: z
          .enum([
            "food",
            "transport",
            "entertainment",
            "shopping",
            "bills",
            "health",
            "education",
            "travel",
            "other",
          ])
          .describe("Budget category"),
        amount: z
          .number()
          .describe("Monthly budget amount in the user's currency"),
        currency: z.string().optional().default("USD").describe("Currency"),
      }),
      execute: async ({
        category,
        amount,
        currency = "USD",
      }: {
        category: string
        amount: number
        currency?: string
      }) => {
        console.log("💰 Creating budget:", { category, amount, currency })

        const amountInCents = Math.round(amount * 100)

        const budget = await createBudget({
          category: category as budgetCategory,
          amount: amountInCents,
          currency: currency || "USD",
          userId: member?.id,
          guestId: guest?.id,
        })

        console.log("✅ Budget created:", {
          id: budget?.id,
          category: budget?.category,
          amount: budget?.amount,
        })

        return {
          success: true,
          budgetId: budget?.id,
          budget,
          message: `Budget created: ${currency} ${amount} per month for ${category}. Now respond to the user confirming this budget in a friendly way.`,
        }
      },
    },
    updateBudget: {
      description:
        "REQUIRED: Update an existing budget. You MUST call this tool when the user wants to modify a budget amount (e.g., 'Change my food budget to $600', 'Increase my entertainment budget'). ALWAYS use this tool for budget updates - do NOT just respond with text.",
      inputSchema: z.object({
        category: z
          .enum([
            "food",
            "transport",
            "entertainment",
            "shopping",
            "bills",
            "health",
            "education",
            "travel",
            "other",
          ])
          .describe("Budget category to update"),
        amount: z
          .number()
          .describe("New monthly budget amount in the user's currency"),
      }),
      execute: async ({
        category,
        amount,
      }: {
        category: string
        amount: number
      }) => {
        console.log("💰 Updating budget:", { category, amount })

        // Find the budget for this category
        const budgets = await getBudgets({
          category: category as budgetCategory,
          userId: member?.id,
          guestId: guest?.id,
        })

        if (!budgets.budgets || budgets.budgets.length === 0) {
          return {
            success: false,
            message: `No budget found for ${category}. Create one first with createBudget.`,
          }
        }

        const budgetToUpdate = budgets.budgets[0]
        if (!budgetToUpdate) {
          return {
            success: false,
            message: `No budget found for ${category}.`,
          }
        }

        const amountInCents = Math.round(amount * 100)

        const updated = await updateBudget({
          ...budgetToUpdate,
          amount: amountInCents,
        })

        console.log("✅ Budget updated:", {
          id: updated?.id,
          category: updated?.category,
          amount: updated?.amount,
        })

        return {
          success: true,
          budget: updated,
          message: `Updated ${category} budget to $${amount}. Now respond to the user confirming the update.`,
        }
      },
    },
    deleteBudget: {
      description:
        "REQUIRED: Delete a budget. You MUST call this tool when the user wants to remove a budget (e.g., 'Delete my food budget', 'Remove the entertainment budget'). ALWAYS use this tool for deletions - do NOT just respond with text.",
      inputSchema: z.object({
        category: z
          .enum([
            "food",
            "transport",
            "entertainment",
            "shopping",
            "bills",
            "health",
            "education",
            "travel",
            "other",
          ])
          .describe("Budget category to delete"),
      }),
      execute: async ({ category }: { category: string }) => {
        console.log("🗑️ Deleting budget:", { category })

        const budgets = await getBudgets({
          category: category as budgetCategory,
          userId: member?.id,
          guestId: guest?.id,
        })

        if (!budgets.budgets || budgets.budgets.length === 0) {
          return {
            success: false,
            message: `No budget found for ${category}.`,
          }
        }

        const budgetToDelete = budgets.budgets[0]
        if (!budgetToDelete) {
          return {
            success: false,
            message: `No budget found for ${category}.`,
          }
        }

        await deleteBudget({ id: budgetToDelete.id })

        console.log("✅ Budget deleted:", budgetToDelete.category)

        return {
          success: true,
          message: `Deleted ${category} budget. Now respond to the user confirming the deletion.`,
        }
      },
    },
    getBudgetStatus: {
      description:
        "REQUIRED: Get budget status and spending comparison. You MUST call this tool when the user asks about their budget status (e.g., 'How am I doing with my budget?', 'Am I over budget?'). ALWAYS use this tool - do NOT make up numbers.",
      inputSchema: z.object({
        category: z
          .enum([
            "food",
            "transport",
            "entertainment",
            "shopping",
            "bills",
            "health",
            "education",
            "travel",
            "other",
          ])
          .optional()
          .describe("Optional: specific category to check"),
      }),
      execute: async ({ category }: { category?: string }) => {
        console.log("📊 Getting budget status:", { category })

        const budgets = await getBudgets({
          category: category as budgetCategory | undefined,
          userId: member?.id,
          guestId: guest?.id,
        })

        if (!budgets.budgets || budgets.budgets.length === 0) {
          return {
            success: false,
            message: category
              ? `No budget set for ${category}.`
              : "No budgets set yet.",
          }
        }

        // Get expenses for comparison
        const expenses = await getExpenses({
          category: category as budgetCategory | undefined,
          userId: member?.id,
          guestId: guest?.id,
          threadId: currentThreadId,
        })

        const totalSpent = expenses.expenses.reduce(
          (sum, exp) => sum + exp.amount,
          0,
        )
        const totalSpentDollars = (totalSpent / 100).toFixed(2)

        const budgetStatus = budgets.budgets.map((b) => {
          const budgetAmount = (b.amount / 100).toFixed(2)
          const categoryExpenses = expenses.expenses.filter(
            (e) => e.category === b.category,
          )
          const categorySpent = categoryExpenses.reduce(
            (sum, exp) => sum + exp.amount,
            0,
          )
          const categorySpentDollars = (categorySpent / 100).toFixed(2)
          const remaining = b.amount - categorySpent
          const remainingDollars = (remaining / 100).toFixed(2)
          const percentUsed = ((categorySpent / b.amount) * 100).toFixed(0)

          return {
            category: b.category,
            budget: budgetAmount,
            spent: categorySpentDollars,
            remaining: remainingDollars,
            percentUsed,
            isOverBudget: categorySpent > b.amount,
          }
        })

        return {
          success: true,
          budgetStatus,
          message: `Budget status retrieved. Now respond to the user with this information in a helpful way, highlighting any categories that are over budget.`,
        }
      },
    },
    createSharedExpense: {
      description:
        "REQUIRED: Create a shared expense AND split it among multiple people in ONE action. You MUST call this tool when the user wants to split an expense (e.g., 'I paid $100 for dinner, split 4 ways', 'Split this $60 with John and Sarah'). This tool will create BOTH the expense AND the splits automatically. ALWAYS use this tool for shared expenses - do NOT just respond with text.",
      inputSchema: z.object({
        totalAmount: z
          .number()
          .describe("Total amount of the expense (e.g., 100 for $100)"),
        currency: z
          .string()
          .optional()
          .default("USD")
          .describe("Currency code"),
        category: z
          .enum([
            "food",
            "transport",
            "entertainment",
            "shopping",
            "bills",
            "health",
            "education",
            "travel",
            "other",
          ])
          .describe("Category of the expense"),
        description: z
          .string()
          .describe("Description of the expense (e.g., 'Dinner with friends')"),
        numberOfPeople: z
          .number()
          .describe("How many people to split among (including yourself)"),
        date: z
          .string()
          .optional()
          .describe("Date of expense in ISO format (YYYY-MM-DD)"),
      }),
      execute: async ({
        totalAmount,
        currency = "USD",
        category,
        description,
        numberOfPeople,
        date,
      }: {
        totalAmount: number
        currency?: string
        category: string
        description: string
        numberOfPeople: number
        date?: string
      }) => {
        console.log("🤝 Creating shared expense:", {
          totalAmount,
          currency,
          category,
          description,
          numberOfPeople,
        })

        // First, create the expense
        const amountInCents = Math.round(totalAmount * 100)
        const expenseDate = date ? new Date(date) : new Date()

        const expense = await createExpense({
          amount: amountInCents,
          currency,
          category: category as expenseCategoryType,
          description,
          date: expenseDate,
          userId: member?.id,
          guestId: guest?.id,
          threadId: currentThreadId,
        })

        console.log("✅ Expense created:", {
          id: expense?.id,
          amount: expense?.amount,
        })

        // Then create the splits
        const splitAmount = totalAmount / numberOfPeople
        const splitAmountInCents = Math.round(splitAmount * 100)

        // Create splits array (excluding the payer, so numberOfPeople - 1)
        const splits = Array.from({ length: numberOfPeople - 1 }, () => ({
          amount: splitAmountInCents,
          paid: false,
        }))

        const sharedExpense = await createSharedExpense({
          expenseId: expense!.id,
          threadId: currentThreadId || "",
          splits,
        })

        console.log("✅ Shared expense created:", {
          id: sharedExpense?.id,
          splitsCount: splits.length,
          splitAmount: splitAmount.toFixed(2),
        })

        return {
          success: true,
          expenseId: expense?.id,
          sharedExpenseId: sharedExpense?.id,
          expense,
          sharedExpense,
          message: `Shared expense created: ${currency} ${totalAmount} for ${description}, split ${numberOfPeople} ways (${currency} ${splitAmount.toFixed(2)} each). ${numberOfPeople - 1} people owe you. IMPORTANT: The shared expense ID is ${sharedExpense?.id} - remember this ID in case the user wants to modify or delete this split later. Now respond to the user confirming this split.`,
        }
      },
    },
    getSharedExpenses: {
      description:
        "REQUIRED: Get all shared expenses. You MUST call this tool when the user asks about shared bills, who owes them money, or what they owe others. ALWAYS use this tool - do NOT make up numbers.",
      inputSchema: z.object({
        expenseId: z
          .string()
          .optional()
          .describe("Filter by specific expense ID"),
      }),
      execute: async ({ expenseId }: { expenseId?: string }) => {
        console.log("📊 Getting shared expenses:", { expenseId })

        const sharedExpenses = await getSharedExpenses({
          expenseId,
          threadId: currentThreadId,
        })

        // Calculate total owed (unpaid splits) and paid splits
        let totalOwed = 0
        let totalPaid = 0
        let unpaidCount = 0
        let paidCount = 0

        sharedExpenses.sharedExpenses.forEach((se) => {
          se.splits.forEach((split) => {
            if (split.paid) {
              totalPaid += split.amount
              paidCount++
            } else {
              totalOwed += split.amount
              unpaidCount++
            }
          })
        })

        const totalOwedDollars = (totalOwed / 100).toFixed(2)
        const totalPaidDollars = (totalPaid / 100).toFixed(2)

        console.log("✅ Shared expenses retrieved:", {
          count: sharedExpenses.sharedExpenses.length,
          totalOwed: totalOwedDollars,
          totalPaid: totalPaidDollars,
          unpaidCount,
          paidCount,
        })

        const sharedExpenseIds = sharedExpenses.sharedExpenses
          .map((se) => se.id)
          .join(", ")

        return {
          success: true,
          sharedExpenses: sharedExpenses.sharedExpenses,
          totalOwed: totalOwedDollars,
          totalPaid: totalPaidDollars,
          unpaidCount,
          paidCount,
          message: `Found ${sharedExpenses.sharedExpenses.length} shared expense(s). ${paidCount} people have paid ($${totalPaidDollars}), ${unpaidCount} people still owe ($${totalOwedDollars}). ${sharedExpenses.sharedExpenses.length > 0 ? `IMPORTANT: Shared expense IDs: ${sharedExpenseIds} - remember these IDs if the user wants to modify or delete them.` : ""} Now respond to the user with this breakdown.`,
        }
      },
    },
    markSplitAsPaid: {
      description:
        "REQUIRED: Mark a person's split as paid in a shared expense. You MUST call this tool when the user says someone paid them back (e.g., 'John paid me back', 'Sarah paid her share', 'Someone paid me back'). CRITICAL: ALWAYS call this tool when payment is mentioned - do NOT just respond with text or call getSharedExpenses. This tool UPDATES the payment status. You must provide the shared expense ID from when it was created or retrieved.",
      inputSchema: z.object({
        sharedExpenseId: z
          .string()
          .describe(
            "The ID of the shared expense to update. Use the ID from createSharedExpense or getSharedExpenses.",
          ),
        splitIndex: z
          .number()
          .describe(
            "Which person paid (0 for first person, 1 for second, etc.). If user doesn't specify, use 0 for the first unpaid person.",
          ),
      }),
      execute: async ({
        sharedExpenseId,
        splitIndex,
      }: {
        sharedExpenseId: string
        splitIndex: number
      }) => {
        console.log("💰 Marking split as paid:", {
          sharedExpenseId,
          splitIndex,
        })

        // Get the specific shared expense
        const sharedExpenses = await getSharedExpenses({
          threadId: currentThreadId,
        })

        const sharedExpenseToUpdate = sharedExpenses.sharedExpenses.find(
          (se) => se.id === sharedExpenseId,
        )

        if (!sharedExpenseToUpdate) {
          return {
            success: false,
            message: `Shared expense with ID ${sharedExpenseId} not found. Use getSharedExpenses to get the correct ID.`,
          }
        }

        // Update the specific split to paid
        const updatedSplits = [...sharedExpenseToUpdate.splits]
        if (splitIndex >= 0 && splitIndex < updatedSplits.length) {
          const currentSplit = updatedSplits[splitIndex]
          if (currentSplit) {
            updatedSplits[splitIndex] = {
              userId: currentSplit.userId,
              guestId: currentSplit.guestId,
              amount: currentSplit.amount,
              paid: true,
            }
          }
        } else {
          return {
            success: false,
            message: `Invalid split index. This expense has ${updatedSplits.length} splits.`,
          }
        }

        const updated = await updateSharedExpense({
          ...sharedExpenseToUpdate,
          splits: updatedSplits,
        })

        console.log("✅ Split marked as paid:", {
          id: updated?.id,
          splitIndex,
        })

        const paidCount = updatedSplits.filter((s) => s.paid).length
        const splitAmount = (
          (updatedSplits[splitIndex]?.amount || 0) / 100
        ).toFixed(2)

        return {
          success: true,
          sharedExpense: updated,
          message: `Marked split ${splitIndex + 1} as paid ($${splitAmount}). ${paidCount}/${updatedSplits.length} people have paid. Now respond to the user confirming the payment.`,
        }
      },
    },
    deleteSharedExpense: {
      description:
        "REQUIRED: Delete a shared expense. You MUST call this tool when the user wants to cancel or remove a split. ALWAYS use this tool - do NOT just respond with text. You must provide the shared expense ID from when it was created or retrieved.",
      inputSchema: z.object({
        sharedExpenseId: z
          .string()
          .describe(
            "The ID of the shared expense to delete. Use the ID from createSharedExpense or getSharedExpenses.",
          ),
      }),
      execute: async ({ sharedExpenseId }: { sharedExpenseId: string }) => {
        console.log("🗑️ Deleting shared expense:", { sharedExpenseId })

        await deleteSharedExpense({ id: sharedExpenseId })

        console.log("✅ Shared expense deleted:", sharedExpenseId)

        return {
          success: true,
          message: `Deleted shared expense ${sharedExpenseId}. Now respond to the user confirming the deletion.`,
        }
      },
    },
  }

  const focusTools = {
    createTask: {
      description:
        "Create a new focus task for the user. Use this when the user wants to add a task, create a to-do, or track work on something.",
      inputSchema: z.object({
        title: z.string().describe("The title/name of the task"),
        description: z
          .string()
          .optional()
          .describe("Optional description or notes about the task"),
      }),
      execute: async ({
        title,
        description,
      }: {
        title: string
        description?: string
      }) => {
        console.log("✅ Creating task:", { title, description })

        const task = await createTask({
          title,
          description,
          userId: member?.id,
          guestId: guest?.id,
        })

        notify(member?.id || guest?.id || "", {
          type: "tasks",
          data: task,
        })

        console.log("✅ Task created:", { id: task?.id, title: task?.title })
        return {
          success: true,
          taskId: task?.id,
          task,
          message: `Created task "${title}" (ID: ${task?.id}). You can update or delete this task by referencing this ID.`,
        }
      },
    },
    updateTask: {
      description:
        "Update an existing task. Use this when the user wants to modify, rename, or change task details.",
      inputSchema: z.object({
        taskId: z.string().describe("The ID of the task to update"),
        title: z.string().optional().describe("New title for the task"),
        description: z
          .string()
          .optional()
          .describe("New description for the task"),
      }),
      execute: async ({
        taskId,
        title,
        description,
      }: {
        taskId: string
        title?: string
        description?: string
      }) => {
        console.log("📝 Updating task:", { taskId, title, description })

        const updateData: any = { id: taskId }
        if (title !== undefined) updateData.title = title
        if (description !== undefined) updateData.description = description

        const updated = await updateTask(updateData)

        notify(member?.id || guest?.id || "", {
          type: "tasks",
          data: updated,
        })

        console.log("✅ Task updated:", { id: updated?.id })
        return {
          success: true,
          task: updated,
          message: `Updated task "${title || updated?.title}" (ID: ${taskId}).`,
        }
      },
    },
    deleteTask: {
      description:
        "Delete a task. Use this when the user wants to remove or cancel a task.",
      inputSchema: z.object({
        taskId: z.string().describe("The ID of the task to delete"),
      }),
      execute: async ({ taskId }: { taskId: string }) => {
        console.log("🗑️ Deleting task:", { taskId })

        await deleteTask({ id: taskId })

        console.log("✅ Task deleted:", taskId)
        return {
          success: true,
          message: `Deleted task ${taskId}.`,
        }
      },
    },
    createMood: {
      description:
        "Log a mood for the user. IMPORTANT: Only use this if the user has character profiles enabled (characterProfilesEnabled: true). If not enabled, you must ask the user for permission first before logging moods. Use this when the user explicitly tells you how they're feeling or wants to track their emotional state. The mood will be linked to this conversation.",
      inputSchema: z.object({
        type: z
          .enum(["happy", "sad", "angry", "astonished", "inlove", "thinking"])
          .describe(
            "The mood type: happy (positive, cheerful), sad (down, melancholic), angry (frustrated, upset), astonished (surprised, amazed), inlove (affectionate, passionate), thinking (contemplative, analytical)",
          ),
      }),
      execute: async ({
        type,
      }: {
        type: "happy" | "sad" | "angry" | "astonished" | "inlove" | "thinking"
      }) => {
        // Check if character profiles are enabled (consent for mood tracking)
        const characterProfilesEnabled =
          member?.characterProfilesEnabled || guest?.characterProfilesEnabled

        if (!characterProfilesEnabled) {
          console.log(
            "⚠️ Mood creation blocked: Character profiles not enabled",
          )
          return {
            success: false,
            requiresConsent: true,
            message:
              "I'd like to log your mood, but I need your permission first. Would you like to enable character profiles? This allows me to track your moods and provide better wellness insights.",
          }
        }

        let mood = await getLastMood(member?.id, guest?.id)

        // Check if last mood was created today
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const isToday = mood && new Date(mood.createdOn) >= today

        if (mood && isToday) {
          // Update today's mood
          const updatedMood = await updateMood({
            ...mood,
            type,
            updatedOn: new Date(),
          })

          mood = updatedMood
        } else {
          // Create new mood (first mood today or no mood exists)
          mood = await createMood({
            type,
            userId: member?.id,
            guestId: guest?.id,
          })
        }

        const moodEmojis = {
          happy: "😊",
          sad: "😢",
          angry: "😠",
          astonished: "😲",
          inlove: "😍",
          thinking: "🤔",
        }

        notify(member?.id! || guest?.id!, {
          type: "mood",
          data: mood,
        })

        console.log("✅ Mood logged:", {
          id: mood?.id,
          type,
          linkedToMessage: currentMessageId,
        })
        return {
          success: true,
          moodId: mood?.id,
          mood,
          message: `Logged mood: ${moodEmojis[type]} ${type}. This mood is linked to our conversation.`,
        }
      },
    },
    updateTimer: {
      description:
        "Update the user's focus timer preferences or control timer state. Use this to start/stop the timer or change presets.",
      inputSchema: z.object({
        isCountingDown: z
          .boolean()
          .optional()
          .describe("Set to true to START the timer, false to STOP/PAUSE it"),
        preset1: z
          .number()
          .optional()
          .describe("First timer preset in minutes (default: 25)"),
        preset2: z
          .number()
          .optional()
          .describe("Second timer preset in minutes (default: 15)"),
        preset3: z
          .number()
          .optional()
          .describe("Third timer preset in minutes (default: 5)"),
      }),
      execute: async ({
        isCountingDown,
        preset1,
        preset2,
        preset3,
      }: {
        isCountingDown?: boolean
        preset1?: number
        preset2?: number
        preset3?: number
      }) => {
        console.log("⏱️ Updating timer:", {
          isCountingDown,
          preset1,
          preset2,
          preset3,
        })

        const updateData: any = { userId: member?.id! }
        if (isCountingDown !== undefined)
          updateData.isCountingDown = isCountingDown
        if (preset1 !== undefined) updateData.preset1 = preset1
        if (preset2 !== undefined) updateData.preset2 = preset2
        if (preset3 !== undefined) updateData.preset3 = preset3

        const updated = await updateTimer(updateData)

        console.log("✅ Timer updated:", {
          isCountingDown: updated?.isCountingDown,
          preset1: updated?.preset1,
          preset2: updated?.preset2,
          preset3: updated?.preset3,
        })

        notify(member?.id! || guest?.id!, {
          type: "timer-ai",
          data: updated,
        })

        // Build response message
        let message = ""
        if (isCountingDown === true) {
          message = `⏱️ Timer started! Focus mode activated. You got this! 💪`
        } else if (isCountingDown === false) {
          message = `⏸️ Timer stopped. Great work! Take a break. 🎉`
        } else if (preset1 || preset2 || preset3) {
          message = `Updated timer presets: ${preset1 || updated?.preset1}min, ${preset2 || updated?.preset2}min, ${preset3 || updated?.preset3}min`
        }

        return {
          success: true,
          timer: updated,
          message,
        }
      },
    },
  }

  const imageTools = {
    generateImage: {
      description:
        "Generate an image using AI based on the user's description. Use this when the user asks to create, generate, draw, design, or visualize something as an image. Examples: 'create a logo', 'draw a sunset', 'design a poster', 'show me what X looks like'.",
      inputSchema: z.object({
        prompt: z
          .string()
          .describe(
            "Detailed description of the image to generate. Be specific about style, colors, composition, and mood.",
          ),
        aspectRatio: z
          .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
          .optional()
          .default("1:1")
          .describe(
            "Aspect ratio of the generated image. Use 1:1 for square, 16:9 for landscape, 9:16 for portrait.",
          ),
      }),
      execute: async ({
        prompt,
        aspectRatio = "1:1",
      }: {
        prompt: string
        aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
      }) => {
        console.log("🎨 Generating image:", { prompt, aspectRatio })

        try {
          const Replicate = (await import("replicate")).default
          const replicate = new Replicate({
            auth: process.env.REPLICATE_API_KEY,
          })

          console.log("🎨 Calling Flux via Replicate...")
          const output = await replicate.run(
            "black-forest-labs/flux-1.1-pro" as any,
            {
              input: {
                prompt,
                aspect_ratio: aspectRatio,
                output_format: "webp",
                output_quality: 90,
                safety_tolerance: 2,
              },
            },
          )

          // Extract URL from output (could be array, string, URL object, or FileOutput)
          let imageUrl: string
          if (Array.isArray(output)) {
            imageUrl = output[0]
          } else if (typeof output === "string") {
            imageUrl = output
          } else if (typeof (output as any)?.url === "function") {
            // Replicate FileOutput has a url() method that returns URL object
            const urlObj = await (output as any).url()
            imageUrl = urlObj?.href || String(urlObj)
          } else if ((output as any)?.href) {
            // It's a URL object with href property
            imageUrl = (output as any).href
          } else if (typeof (output as any)?.url === "string") {
            // Or it might be a string property
            imageUrl = (output as any).url
          } else {
            // Fallback to string conversion
            imageUrl = String(output)
          }

          console.log("✅ Image generated:", imageUrl)

          // Return a user-friendly message with the image URL
          return {
            success: true,
            imageUrl,
            prompt,
            aspectRatio,
            message: `I've created a beautiful image: "${prompt}". Here it is!`,
          }
        } catch (error) {
          console.error("Failed to generate image:", error)
          return {
            success: false,
            error: "Failed to generate image. Please try again.",
          }
        }
      },
    },
  }

  return {
    calendarTools,
    vaultTools,
    focusTools,
    imageTools,
  }
}
