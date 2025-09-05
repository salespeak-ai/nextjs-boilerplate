// middleware.ts
import { NextResponse, NextRequest } from "next/server";

const ORGANIZATION_ID = "XXX96776-2ccf-4198-bd8a-3aa7c5a6986c";

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

  // Prevent loops
  if (req.nextUrl.pathname.startsWith("/api/ai-proxy")) {
    return NextResponse.next();
  }

  if (!isAIVisitor(ua, qsAgent)) {
    return NextResponse.next();
  }

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