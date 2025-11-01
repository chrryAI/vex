# 🧠 AI App-Awareness System

## Overview

The AI now has **full awareness** of all 4 LifeOS apps and their specialized instruction templates. This enables intelligent app classification and context-aware instruction generation.

## How It Works

### 1. **App-Specific Instruction Loading**

```typescript
const atlasInstructions = getExampleInstructions({ appName: "Atlas" })
const bloomInstructions = getExampleInstructions({ appName: "Bloom" })
const peachInstructions = getExampleInstructions({ appName: "Peach" })
const vaultInstructions = getExampleInstructions({ appName: "Vault" })
```

### 2. **AI Receives All Templates**

The AI prompt includes:

- **🗺️ Atlas (Travel)**: 7 travel-focused instructions
  - Plan trips, find flights, book hotels, visa requirements, etc.
- **🌸 Bloom (Health)**: 7 health-focused instructions
  - Track wellness, design workouts, plan meals, carbon footprint, etc.
- **🍑 Peach (Social)**: 7 social-focused instructions
  - Find friends, plan meetups, match personalities, build connections, etc.
- **💰 Vault (Finance)**: 7 finance-focused instructions
  - Track expenses, analyze investments, budget planning, tax strategy, etc.
- **🥰 General**: 7 generic instructions for non-app conversations

### 3. **Intelligent Classification**

```json
{
  "appClassification": {
    "appName": "Atlas",
    "confidence": 0.9,
    "reasoning": "User is discussing travel planning to Tokyo"
  }
}
```

### 4. **Context-Aware Suggestions**

- **High Confidence (> 0.7)**: AI uses app-specific templates
  - User talks about travel → Gets Atlas travel instructions
  - User talks about fitness → Gets Bloom health instructions
- **Low Confidence (≤ 0.7)**: AI uses general templates
  - User asks generic questions → Gets general instructions

### 5. **Automatic Thread Classification**

When AI detects app relevance with high confidence:

```typescript
if (app) {
  await updateThread({
    ...thread,
    appId: app.id, // Thread tagged as Atlas/Bloom/Peach/Vault
  })
}
```

## Benefits

### 🎯 **For Users**

- Get **relevant instructions** based on conversation context
- Seamless app discovery through intelligent suggestions
- Personalized experience that adapts to their needs

### 🧠 **For AI**

- Understands all 28 specialized instructions (7 per app)
- Can classify conversations into appropriate apps
- Generates contextually relevant suggestions

### 📊 **For Business**

- Automatic thread classification for analytics
- Better understanding of user behavior per app
- Data-driven insights on app usage patterns

## Example Scenarios

### Scenario 1: Travel Planning

```
User: "I want to plan a trip to Tokyo next month"

AI Classification:
- appName: "Atlas"
- confidence: 0.95
- reasoning: "User is planning international travel"

Generated Instructions:
✅ Plan morning trip from Amsterdam ✈️
✅ Find budget flights to Tokyo 🇯🇵
✅ Book hotels & accommodations
✅ Get visa & travel requirements
✅ Create weekend itinerary ☀️
✅ Discover local hidden gems 🗺️
✅ Plan multi-city adventure
```

### Scenario 2: Fitness Discussion

```
User: "I need help creating a workout routine"

AI Classification:
- appName: "Bloom"
- confidence: 0.88
- reasoning: "User is discussing fitness and health"

Generated Instructions:
✅ Design workout routines ☀️
✅ Track health & wellness
✅ Plan healthy meals
✅ Monitor wellness metrics
✅ Calculate carbon footprint
✅ Get eco-friendly tips
✅ Find sustainable products
```

### Scenario 3: Generic Chat

```
User: "What's the weather like?"

AI Classification:
- appName: null
- confidence: 0.3
- reasoning: "General question, not app-specific"

Generated Instructions:
✅ Brainstorm innovative solutions
✅ Review my code like a senior dev
✅ Explain complex topics simply
✅ Help me learn new skills
✅ Analyze data & find insights
✅ Plan my day efficiently
✅ Give strategic business advice
```

## Technical Implementation

### File: `generateAIContent.ts`

```typescript
// Load all app-specific instructions
const atlasInstructions = getExampleInstructions({ appName: "Atlas" })
const bloomInstructions = getExampleInstructions({ appName: "Bloom" })
const peachInstructions = getExampleInstructions({ appName: "Peach" })
const vaultInstructions = getExampleInstructions({ appName: "Vault" })

// Include in AI prompt
const suggestionsPrompt = `
APP-SPECIFIC INSTRUCTION EXAMPLES:

🗺️ ATLAS (Travel) - 7 Instructions:
${JSON.stringify(atlasInstructions.slice(0, 7), null, 2)}

🌸 BLOOM (Health & Wellness) - 7 Instructions:
${JSON.stringify(bloomInstructions.slice(0, 7), null, 2)}

🍑 PEACH (Social) - 7 Instructions:
${JSON.stringify(peachInstructions.slice(0, 7), null, 2)}

💰 VAULT (Finance) - 7 Instructions:
${JSON.stringify(vaultInstructions.slice(0, 7), null, 2)}

INSTRUCTION RULES:
- If appName confidence > 0.7: Use APP-SPECIFIC templates
- If appName confidence <= 0.7: Use GENERAL templates
- Personalize based on user context and memories
- Maintain emoji, structure, and focus area
`
```

### Database Schema

```typescript
threads {
  id: uuid
  appId: uuid | null  // ✅ Automatically set by AI classification
  // ... other fields
}
```

## Monitoring

### Console Logs

```bash
📚 Loaded app-specific instructions: Atlas (7), Bloom (7), Peach (7), Vault (7)
📱 App classification: Atlas (0.92) - User is discussing travel planning
```

## Future Enhancements

### 1. **Multi-App Classification**

- Detect when conversation spans multiple apps
- Example: "Plan trip to Tokyo and track my fitness goals"
  - Primary: Atlas (0.85)
  - Secondary: Bloom (0.65)

### 2. **Learning from User Behavior**

- Track which instructions users click
- Improve classification accuracy over time
- Personalize instruction order

### 3. **Cross-App Suggestions**

- When in Atlas, suggest Peach for travel buddies
- When in Bloom, suggest Vault for health expenses
- Smart cross-selling through contextual suggestions

## Success Metrics

### ✅ **Accuracy**

- App classification confidence > 0.7
- Correct app detection rate > 90%

### ✅ **Relevance**

- Users click on suggested instructions
- Instructions match conversation context
- Positive user feedback

### ✅ **Engagement**

- Increased app discovery
- Higher instruction usage
- More cross-app navigation

---

**Status**: ✅ **LIVE IN PRODUCTION**

**Last Updated**: 2025-10-04

**Maintained By**: Vex AI Team
