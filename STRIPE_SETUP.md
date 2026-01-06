# Stripe Premium Products - Environment Variables

## Required Environment Variables

Add these to your `.env` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...  # Use sk_live_... for production
STRIPE_PUBLISHABLE_KEY=pk_test_...  # Use pk_live_... for production
STRIPE_WEBHOOK_SECRET=whsec_...

# Grape Analytics Price IDs
STRIPE_GRAPE_PUBLIC_PRICE=price_...  # €50/month
STRIPE_GRAPE_PRIVATE_PRICE=price_...  # €500/month

# Pear Feedback Price IDs
STRIPE_PEAR_PUBLIC_PRICE=price_...  # €50/month
STRIPE_PEAR_PRIVATE_PRICE=price_...  # €500/month

# Debugger Price IDs
STRIPE_DEBUGGER_SHARED_PRICE=price_...  # €50/month
STRIPE_DEBUGGER_PRIVATE_PRICE=price_...  # €500/month

# White Label Price ID
STRIPE_WHITE_LABEL_PRICE=price_...  # €1,000/month

# Frontend URL for redirects
FRONTEND_URL=https://chrry.ai  # Update for production
```

## Setup Steps

### 1. Create Stripe Products

Run this script in Stripe Dashboard or via API:

```bash
# Create Grape Analytics
stripe products create \
  --name "Grape Analytics" \
  --description "Real-time analytics with AI-powered insights" \
  --metadata[category]=analytics \
  --metadata[launch_date]=Q1_2026

# Create prices
stripe prices create \
  --product prod_xxx \
  --unit_amount 5000 \
  --currency eur \
  --recurring[interval]=month \
  --nickname "Grape Analytics - Public"

stripe prices create \
  --product prod_xxx \
  --unit_amount 50000 \
  --currency eur \
  --recurring[interval]=month \
  --nickname "Grape Analytics - Private"
```

Repeat for Pear Feedback, Debugger, and White Label.

### 2. Set Up Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://api.chrry.ai/api/premium/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 3. Run Database Migration

```bash
cd packages/db
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### 4. Test in Development

Use Stripe test mode:

- Test card: `4242 4242 4242 4242`
- Any future expiry date
- Any CVC

```bash
# Test checkout flow
curl -X POST http://localhost:3000/api/premium/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "productType": "grape_analytics",
    "tier": "public"
  }'
```

### 5. Test Webhooks Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/premium/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
```

## API Endpoints

### Subscribe to Premium

```
POST /api/premium/subscribe
Body: { productType, tier, metadata? }
Returns: { url } - Stripe checkout URL
```

### Get Subscriptions

```
GET /api/premium/subscriptions
Returns: { subscriptions: [...] }
```

### Check Access

```
GET /api/premium/access/:productType
Returns: { hasAccess: boolean }
```

### Cancel Subscription

```
POST /api/premium/cancel/:subscriptionId
Returns: { success: true }
```

### Webhook Handler

```
POST /api/premium/webhooks/stripe
Headers: stripe-signature
Body: Stripe event payload
```

## Feature Gating Example

```typescript
import { hasPremiumAccess } from "@repo/db"

// In your API route
const hasGrapeAccess = await hasPremiumAccess(userId, "grape_analytics")

if (!hasGrapeAccess) {
  return c.json(
    { error: "Upgrade to Grape Analytics to access this feature" },
    403,
  )
}

// Proceed with premium feature
```

## Revenue Tracking

Monitor in Stripe Dashboard:

- MRR (Monthly Recurring Revenue)
- Churn rate
- Customer lifetime value
- Failed payments

## Launch Checklist

- [ ] Create all products in Stripe
- [ ] Set up webhook endpoint
- [ ] Add environment variables
- [ ] Run database migration
- [ ] Test checkout flow
- [ ] Test webhook delivery
- [ ] Verify feature gating
- [ ] Set up monitoring for failed payments
- [ ] Create cancellation flow
- [ ] Add "Coming Q1 2026" banners to UI
- [ ] Document premium features
- [ ] Set up customer support for billing questions

## Next Steps

1. **UI Implementation** (Your responsibility):
   - Premium upgrade modals
   - Subscription management page
   - Feature locked states
   - Success/cancel pages

2. **Testing**:
   - End-to-end subscription flow
   - Webhook handling
   - Payment failures
   - Cancellations

3. **Launch**:
   - Switch to live Stripe keys
   - Enable products in Stripe
   - Announce Q1 2026 launch
   - Collect early access signups
