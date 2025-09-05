# Salespeak LLM Analytics - Vercel Deployment Guide

## Production-Ready Files

### 1. middleware.ts (Edge — runs on every request)
**Location:** Project root folder  
**Source:** [`middleware.ts`](./middleware.ts)

### 2. app/api/ai-proxy/route.ts (Edge Route Handler: performs injection)
**Location:** `app/api/ai-proxy/route.ts`  
**Source:** [`app/api/ai-proxy/route.ts`](./app/api/ai-proxy/route.ts)

---

## Deployment Steps (Copy-paste to your customer)

### 1. Add Files to Your Next.js Repo
Add the two files above to your Next.js repository:
- `middleware.ts` in the project root folder
- `app/api/ai-proxy/route.ts` in the `app/api/ai-proxy/` directory

### 2. Configure Your Organization ID
Edit `middleware.ts` and replace the placeholder:
```typescript
const ORGANIZATION_ID = "XXX96776-2ccf-4198-bd8a-3aa7c5a6986c";
```
Replace `XXX96776-2ccf-4198-bd8a-3aa7c5a6986c` with your actual Salespeak Organization ID.

### 3. Deploy to Vercel
1. Commit & push to your Vercel-connected branch
2. Vercel will automatically deploy the changes

### 4. Edge Runtime Configuration
Edge runtime is automatically enabled (we set `export const runtime = 'edge'` in the route handler; no extra Vercel config needed).

---

## Configuration & Customization

### Organization ID
- Edit `ORGANIZATION_ID` in `middleware.ts`
- Route handler receives it as `org` parameter

### Path Matching
- Adjust `config.matcher` in `middleware.ts` to exclude more assets or sections

### Caching Behavior
- **AI variant**: Returned with `private, no-store, max-age=0` (no caching)
- **Normal users**: Get your standard caching behavior

---

## Failure & Fallback Behavior

### Missing AI Content
- If ALT origin is missing or doesn't include `#optimized-for-ai`, we return the original page (no injection)
- Still adds `Vary: User-Agent` header for proper caching

### Error Handling
- If any error occurs while proxying, we fetch and return the original page
- This ensures traffic never breaks, even if the proxy fails

---

## Security Notes

### Content Safety
- We avoid echoing user input into HTML
- The only inserted markup is the trusted snippet fetched from your controlled ALT origin

### Header Security
- We do not forward cookies or auth headers to S3
- The route handler follows redirects but never rewrites to external domains other than your configured ALT origin

---

## Uninstall / Rollback

### Complete Removal
1. Delete `middleware.ts` from project root
2. Delete `app/api/ai-proxy/route.ts` from `app/api/ai-proxy/` directory
3. Deploy changes
4. Traffic returns to normal immediately

---

## FAQ

### Does this affect SEO?
- Normal crawlers (Googlebot, Bingbot) are **not targeted** unless they present one of the AI-specific UAs
- For safety, you can explicitly exclude known SEO bots or verify via your logs

### Will Middleware slow down all traffic?
- Middleware is a tiny check + rewrite for AI-detected requests only
- Non-AI users are passed through immediately with minimal overhead

### What AI agents are detected?
- ChatGPT-User
- GPTBot
- Google-Extended
- BingPreview
- PerplexityBot
- Claude-User, Claude-Web, ClaudeBot

### How does content injection work?
- Fetches AI-optimized content from your S3 bucket
- Looks for element with `id="optimized-for-ai"`
- Injects this content at the beginning of the `<body>` tag
- Falls back to original content if injection fails
