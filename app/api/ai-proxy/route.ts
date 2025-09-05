// app/api/ai-proxy/route.ts
export const runtime = "edge";

const EXTERNAL_API_URL =
  "https://22i9zfydr3.execute-api.us-west-2.amazonaws.com/prod/event_stream";

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

  const payload = {
    data: {
      launcher: "proxy",
      url: `${currentOrigin}${path}`,
      bot_type: "AI-UA",
      client_ip: clientIp,
      country,
    },
    event_type: "chatgpt_user_agent",
    url: `${currentOrigin}${path}`,
    user_id: requestId,
    campaign_id: "00000000-0000-0000-0000-000000000000",
    organization_id: orgId,
  };
  fetch(EXTERNAL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "PostmanRuntime/7.32.2" },
    body: JSON.stringify(payload),
  }).catch(() => {});

  try {
    // 1) Fetch alternate HTML & extract #optimized-for-ai
    const altURL = `${ALT_ORIGIN}${path}`;
    const altResp = await fetch(altURL, { redirect: "follow" });
    let injectedHTML = "";
    if (altResp.ok) {
      const altCT = altResp.headers.get("content-type");
      if (isHTMLResponse(altCT)) {
        const altText = await altResp.text();
        injectedHTML = extractElementOuterHTMLById(altText, "optimized-for-ai") || "";
      }
    }

    // 2) Fetch original page
    const origURL = `${currentOrigin}${path}`;
    const origResp = await fetch(origURL, {
      headers: {
        "user-agent": uaHeader || "",
        accept: req.headers.get("accept") || "*/*",
        "x-bypass-middleware": "true", // Bypass middleware to prevent loops
      },
      redirect: "follow",
    });

    const ct = origResp.headers.get("content-type");
    const vary = origResp.headers.get("vary");

    if (!isHTMLResponse(ct) || !injectedHTML) {
      const headers = new Headers(origResp.headers);
      headers.delete("content-length");
      headers.set("Vary", vary ? `${vary}, User-Agent` : "User-Agent");
      headers.set("Cache-Control", "private, no-store, max-age=0");
      headers.set("Pragma", "no-cache");
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

    return new Response(withSnippet, {
      status: origResp.status,
      statusText: origResp.statusText,
      headers,
    });
  } catch (e) {
    const fallback = await fetch(`${currentOrigin}${path}`, { 
      headers: {
        "x-bypass-middleware": "true", // Bypass middleware to prevent loops
      },
      redirect: "follow" 
    });
    const headers = new Headers(fallback.headers);
    headers.set("Vary", headers.get("Vary") ? headers.get("Vary") + ", User-Agent" : "User-Agent");
    return new Response(fallback.body, {
      status: fallback.status,
      statusText: fallback.statusText,
      headers,
    });
  }
}

