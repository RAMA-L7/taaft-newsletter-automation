# 03 — Payments Setup (Gumroad OR Lemon Squeezy)

> Both are ₹0/month. They only take ~5–10% per sale. Pick ONE.

## Option A: Gumroad (simplest, recommended for week 1)

1. Sign up: https://gumroad.com (use Gmail login)
2. **Products → New product**
   - Name: `AI This Week — Founding Subscriber`
   - Price: `$5` / recurring monthly
   - Type: Subscription
3. **Content:** paste a welcome message + "Issue archive" link
   (Google Drive folder or Notion page with past issues)
4. Copy the product URL → paste into `landing/index.html` CTA button
5. Payouts: Settings → Payments → connect bank/PayPal
   (India: Gumroad pays via PayPal; consider Lemon Squeezy if PayPal is an issue)

## Option B: Lemon Squeezy (better for India payouts)

1. Sign up: https://lemonsqueezy.com
2. **Products → +** → digital subscription, $5/mo
3. Enable "Subscription" → weekly digest delivered via email list you manage manually at first
4. Same as above: copy checkout link into landing page

## Free-tier signup funnel (important!)

Don't paywall Issue #1. Funnel:

```
Landing page → "Get Issue #1 free" → Google Form (email field) 
             → send issue manually → after issue 2-3, pitch founding tier
```

- Google Form: create one with just "Email" → responses land in a sheet (you already know Sheets)
- Later replace with proper email service (Brevo free 300/day) once revenue exists

## Taxes/legal note

Both platforms act as Merchant of Record — they handle VAT/sales tax for you.
You'll need: PAN + bank account for payouts. Nothing else to start.

## Success gate

🚦 **10 paying subscribers** = validation passed → THEN consider domain + real stack.
Below that: keep iterating on niche/positioning, spend nothing.
