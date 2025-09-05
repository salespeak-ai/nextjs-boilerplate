// middleware.ts
import { NextResponse, NextRequest } from "next/server";

const ORGANIZATION_ID = "1982bf58-c125-4115-9a31-4bd129ca374c";

// UA regexes
const CHATGPT_UA_RE = /ChatGPT-User\/1\.0/i;
const GPTBOT_UA_RE = /GPTBot\/1\.0/i;
const GOOGLE_EXTENDED_RE = /Google-Extended/i;
const BING_PREVIEW_RE = /bingpreview/i;
const PERPLEXITY_UA_RE = /PerplexityBot/i;
const CLAUDE_USER_RE = /Claude-User/i;
const CLAUDE_WEB_RE = /Claude-Web/i;
const CLAUDE_BOT_RE = /ClaudeBot/i;

function isAIVisitor(ua: string, qsAgent?: string | null) {
  const isChatGPT = CHATGPT_UA_RE.test(ua) || qsAgent === "chatgpt";
  return (
    isChatGPT ||
    GPTBOT_UA_RE.test(ua) ||
    GOOGLE_EXTENDED_RE.test(ua) ||
    BING_PREVIEW_RE.test(ua) ||
    PERPLEXITY_UA_RE.test(ua) ||
    CLAUDE_USER_RE.test(ua) ||
    CLAUDE_WEB_RE.test(ua) ||
    CLAUDE_BOT_RE.test(ua)
  );
}

export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const qsAgent = req.nextUrl.searchParams.get("user-agent")?.toLowerCase() ?? null;

  // Bypass middleware if requested (to prevent loops from ai-proxy)
  if (req.headers.get("x-bypass-middleware") === "true") {
    return NextResponse.next();
  }

  // Prevent loops - exclude static assets and Next.js internals
  if (
    req.nextUrl.pathname.startsWith("/api/ai-proxy") ||
    req.nextUrl.pathname.startsWith("/_next/") ||
    req.nextUrl.pathname.startsWith("/favicon.ico") ||
    req.nextUrl.pathname.startsWith("/robots.txt") ||
    req.nextUrl.pathname.startsWith("/sitemap.xml") ||
    req.nextUrl.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // Log every request (only for actual pages)
  console.log(`📝 Request: ${req.method} ${req.nextUrl.pathname} | UA: ${ua.substring(0, 50)}... | Query Agent: ${qsAgent || 'none'}`);
  
  // Log all headers
  console.log('📋 Headers:', Object.fromEntries(req.headers.entries()));

  if (!isAIVisitor(ua, qsAgent)) {
    return NextResponse.next();
  }

  // Log warning for AI agent detection
  console.warn(`🤖 AI Agent detected: ${ua} | Path: ${req.nextUrl.pathname} | Query Agent: ${qsAgent || 'none'}`);

  // Rewrite AI traffic to our Edge Route Handler
  const url = req.nextUrl.clone();
  const target = new URL(`/api/ai-proxy`, req.url);
  target.searchParams.set("path", url.pathname + url.search);
  target.searchParams.set("org", ORGANIZATION_ID);
  target.searchParams.set("ua", ua);

  return NextResponse.rewrite(target, {
    headers: {
      Vary: "User-Agent",
    },
  });
}

// Exclude Next internals & static assets
export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|robots.txt|sitemap.xml|api/ai-proxy).*)",
  ],
};