# Salespeak LLM Analytics for Vercel Integration

This is a [Next.js](https://nextjs.org) project that demonstrates how to integrate **Salespeak LLM Analytics** with Vercel deployments. The integration automatically detects AI agents (ChatGPT, Claude, Perplexity, etc.) and provides analytics tracking for LLM traffic to your website.

## Features

- 🤖 **AI Agent Detection**: Automatically detects and identifies various AI agents including:
  - ChatGPT-User
  - GPTBot
  - Google-Extended
  - BingPreview
  - PerplexityBot
  - Claude (User, Web, Bot variants)

- 📊 **Analytics Integration**: Sends detailed analytics data to Salespeak's API including:
  - Bot type identification
  - Request metadata (IP, country, path)
  - User agent information

- 🔄 **Smart Proxy**: Routes AI agent traffic through a proxy that can inject optimized content while preserving the original user experience

- 🚀 **Vercel Optimized**: Built specifically for Vercel's Edge Runtime with proper middleware configuration

## Getting Started

### Quick Start
1. **Clone and install dependencies:**
```bash
npm install
```

2. **Configure your organization ID:**
Update the `ORGANIZATION_ID` in `middleware.ts` with your Salespeak organization ID.

3. **Run the development server:**
```bash
npm run dev
```

4. **Test AI agent detection:**
Visit [http://localhost:3000](http://localhost:3000) with different user agents or query parameters to test the detection logic.

### Production Deployment
For production deployment instructions, configuration options, and troubleshooting, see the **[Deployment Guide](./DEPLOYMENT.md)**.

## How It Works

1. **Middleware Detection**: The middleware intercepts all requests and checks for AI agent user agents
2. **Traffic Routing**: AI agent traffic is rewritten to `/api/ai-proxy` while regular users see the normal site
3. **Analytics Tracking**: The proxy sends analytics data to Salespeak's API with detailed bot type information
4. **Content Optimization**: The proxy can fetch and inject AI-optimized content from your S3 bucket

## Configuration

### Environment Variables
- Set your Salespeak organization ID in `middleware.ts`

## Deploy on Vercel

The easiest way to deploy this integration is using the [Vercel Platform](https://vercel.com/new):

1. Connect your GitHub repository
2. Deploy with default settings
3. Update the organization ID in your deployed environment

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [Salespeak LLM Analytics](https://salespeak.ai)
