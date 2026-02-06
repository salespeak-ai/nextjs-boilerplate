// app/api/ai-proxy/route.ts
export const runtime = "edge";

const EXTERNAL_API_URL =
  "https://22i9zfydr3.execute-api.us-west-2.amazonaws.com/prod/event_stream";

// UA regexes (same as middleware)
const CHATGPT_UA_RE = /ChatGPT-User\/1\.0/i;
const GPTBOT_UA_RE = /GPTBot\/1\.0/i;
const GOOGLE_EXTENDED_RE = /Google-Extended/i;
const BING_PREVIEW_RE = /bingpreview/i;
const PERPLEXITY_UA_RE = /PerplexityBot/i;
const CLAUDE_USER_RE = /Claude-User/i;
const CLAUDE_WEB_RE = /Claude-Web/i;
const CLAUDE_BOT_RE = /ClaudeBot/i;

function getBotType(ua: string, qsAgent?: string | null) {
  const isChatGPT = CHATGPT_UA_RE.test(ua) || qsAgent === "chatgpt";
  const isGPTBot = GPTBOT_UA_RE.test(ua);
  const isGoogleExtended = GOOGLE_EXTENDED_RE.test(ua);
  const isBingPreview = BING_PREVIEW_RE.test(ua);
  const isPerplexity = PERPLEXITY_UA_RE.test(ua);

  const isClaudeUser = CLAUDE_USER_RE.test(ua);
  const isClaudeWeb = CLAUDE_WEB_RE.test(ua);
  const isClaudeBot = CLAUDE_BOT_RE.test(ua);

  const botType = isChatGPT
    ? "ChatGPT-User"
    : isGPTBot
    ? "GPTBot"
    : isGoogleExtended
    ? "Google-Extended"
    : isBingPreview
    ? "BingPreview"
    : isPerplexity
    ? "PerplexityBot"
    : isClaudeUser
    ? "Claude-User"
    : isClaudeWeb
    ? "Claude-Web"
    : isClaudeBot
    ? "ClaudeBot"
    : "Unknown";

  return botType;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
}

function extractElementOuterHTMLById(html: string, id: string) {
  const re = new RegExp(
    `<([a-zA-Z0-9:-]+)([^*>]*\\s)?id=(["'])${escapeRegExp(id)}\\3[^>]*>([\\s\\S]*?)<\\/\\1\\s*>`,
    "i"
  );
  const m = html.match(re);
  return m ? m[0] : "";
}

function isHTMLResponse(contentType: string | null) {
  return !!contentType && contentType.includes("text/html");
}

function prependIntoBody(html: string, snippet: string) {
  const bodyOpen = html.match(/<body[^>]*>/i);
  if (bodyOpen && bodyOpen.index !== undefined) {
    const idx = bodyOpen.index + bodyOpen[0].length;
    return html.slice(0, idx) + snippet + html.slice(idx);
  }
  return snippet + html;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "/";
  const orgId = url.searchParams.get("org") || "";
  const uaHeader = url.searchParams.get("ua") || "";
  const qsAgent = url.searchParams.get("user-agent")?.toLowerCase() ?? null;
  const requestId = crypto.randomUUID();

  const xfProto = req.headers.get("x-forwarded-proto") || "https";
  const xfHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const currentOrigin = `${xfProto}://${xfHost}`;

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const country = req.headers.get("x-vercel-ip-country") || "unknown";

  const ALT_ORIGIN = `https://salespeak-public-serving.s3.amazonaws.com/${orgId}`;

  // Get the specific bot type
  const botType = getBotType(uaHeader, qsAgent);

  const payload = {
    data: {
      launcher: "proxy",
      url: `${currentOrigin}${path}`,
      bot_type: botType,
      client_ip: clientIp,
      country,
    },
    event_type: "chatgpt_user_agent",
    url: `${currentOrigin}${path}`,
    user_id: requestId,
    campaign_id: "00000000-0000-0000-0000-000000000000",
    organization_id: orgId,
  };
  // Start logging immediately — runs in parallel with S3 + origin fetches
  const logPromise = fetch(EXTERNAL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "PostmanRuntime/7.32.2" },
    body: JSON.stringify(payload),
  }).catch(() => {});

  try {
    // 1) Fetch S3 alternate + original page in parallel
    const altURL = `${ALT_ORIGIN}${path}`;
    const origURL = `${currentOrigin}${path}`;

    // Append bypass param to origin URL to prevent middleware redirect loops
    const origBypassURL = new URL(origURL);
    origBypassURL.searchParams.set("_sp_bypass", "1");

    // Forward cookies/auth from original request for protected deployments
    // Use a normal UA for the origin fetch — the bot's UA triggers bot protection (401)
    const cookie = req.headers.get("cookie") || "";
    const authorization = req.headers.get("authorization") || "";

    const originHeaders: Record<string, string> = {
      "user-agent": "Mozilla/5.0 (compatible; SalespeakProxy/1.0)",
      accept: req.headers.get("accept") || "*/*",
      "x-bypass-middleware": "true",
    };
    if (cookie) originHeaders["cookie"] = cookie;
    if (authorization) originHeaders["authorization"] = authorization;

    const [altResp, origResp] = await Promise.all([
      fetch(altURL, { redirect: "follow" }).catch(() => null),
      fetch(origBypassURL.toString(), {
        headers: originHeaders,
        redirect: "follow",
      }),
    ]);

    // Extract #optimized-for-ai from S3 response
    let injectedHTML = "";
    if (altResp?.ok) {
      const altCT = altResp.headers.get("content-type");
      if (isHTMLResponse(altCT)) {
        const altText = await altResp.text();
        injectedHTML = extractElementOuterHTMLById(altText, "optimized-for-ai") || "";
      }
    }

    const ct = origResp.headers.get("content-type");
    const vary = origResp.headers.get("vary");

    if (!isHTMLResponse(ct) || !injectedHTML) {
      const headers = new Headers(origResp.headers);
      headers.delete("content-length");
      headers.set("Vary", vary ? `${vary}, User-Agent` : "User-Agent");
      headers.set("Cache-Control", "private, no-store, max-age=0");
      headers.set("Pragma", "no-cache");
      await logPromise;
      return new Response(origResp.body, {
        status: origResp.status,
        statusText: origResp.statusText,
        headers,
      });
    }

    // 3) Inject and return
    const html = await origResp.text();
    const withSnippet = prependIntoBody(html, injectedHTML);

    const headers = new Headers(origResp.headers);
    headers.delete("content-length");
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("Vary", vary ? `${vary}, User-Agent` : "User-Agent");
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("Pragma", "no-cache");

    await logPromise;
    return new Response(withSnippet, {
      status: origResp.status,
      statusText: origResp.statusText,
      headers,
    });
  } catch (e) {
    const fallbackURL = new URL(`${currentOrigin}${path}`);
    fallbackURL.searchParams.set("_sp_bypass", "1");
    const fallbackHeaders: Record<string, string> = {
      "x-bypass-middleware": "true",
    };
    const fbCookie = req.headers.get("cookie") || "";
    const fbAuth = req.headers.get("authorization") || "";
    if (fbCookie) fallbackHeaders["cookie"] = fbCookie;
    if (fbAuth) fallbackHeaders["authorization"] = fbAuth;
    const fallback = await fetch(fallbackURL.toString(), {
      headers: fallbackHeaders,
      redirect: "follow",
    });
    const headers = new Headers(fallback.headers);
    headers.set("Vary", headers.get("Vary") ? headers.get("Vary") + ", User-Agent" : "User-Agent");
    await logPromise;
    return new Response(fallback.body, {
      status: fallback.status,
      statusText: fallback.statusText,
      headers,
    });
  }
}

