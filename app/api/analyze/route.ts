import { env } from "cloudflare:workers";

type AuditCheck = {
  name: string;
  pass: boolean;
  detail: string;
  fix: string;
  category: string;
};

type AiAnalysis = {
  summary: string;
  verdict: string;
  quickWins: Array<{
    title: string;
    why: string;
    action: string;
    impact: "High" | "Medium" | "Low";
    effort: "Quick" | "Moderate" | "Project";
  }>;
  searchUpgrade: {
    title: string;
    metaDescription: string;
    keywordThemes: string[];
    contentGap: string;
    schemaSuggestion: string;
  };
  performanceStory: {
    diagnosis: string;
    likelyBottlenecks: string[];
    nextTest: string;
  };
  growthExperiment: {
    name: string;
    hypothesis: string;
    steps: string[];
    successMetric: string;
  };
  confidence: "High" | "Medium" | "Low";
};

function safeUrl(value: string) {
  const u = new URL(value.includes("://") ? value : `https://${value}`);
  const h = u.hostname.toLowerCase();
  if (
    !["https:", "http:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.port ||
    !h.includes(".") ||
    h.includes(":") ||
    /^\d/.test(h) ||
    /(^|\.)(localhost|local|internal|test|invalid)$/.test(h)
  ) {
    throw new Error("Enter a public website address, such as https://example.com.");
  }
  return u;
}

function attribute(tag: string, name: string) {
  return (
    tag
      .match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))
      ?.slice(1)
      .find((value) => value !== undefined) || ""
  );
}

function cleanText(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

async function getAiAnalysis(input: {
  url: string;
  title: string;
  description: string;
  textSample: string;
  checks: AuditCheck[];
  metrics: Record<string, number>;
}): Promise<AiAnalysis> {
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI analysis is not configured.");

  const schema = {
    type: "object",
    properties: {
      summary: { type: "string", description: "Two concise sentences describing the page's strongest advantage and biggest constraint." },
      verdict: { type: "string", description: "A punchy, specific one-sentence strategic verdict." },
      quickWins: {
        type: "array",
        minItems: 3,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            why: { type: "string" },
            action: { type: "string" },
            impact: { type: "string", enum: ["High", "Medium", "Low"] },
            effort: { type: "string", enum: ["Quick", "Moderate", "Project"] },
          },
          required: ["title", "why", "action", "impact", "effort"],
          additionalProperties: false,
        },
      },
      searchUpgrade: {
        type: "object",
        properties: {
          title: { type: "string", description: "A compelling SEO title no longer than 60 characters." },
          metaDescription: { type: "string", description: "A useful meta description between 120 and 160 characters." },
          keywordThemes: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
          contentGap: { type: "string" },
          schemaSuggestion: { type: "string" },
        },
        required: ["title", "metaDescription", "keywordThemes", "contentGap", "schemaSuggestion"],
        additionalProperties: false,
      },
      performanceStory: {
        type: "object",
        properties: {
          diagnosis: { type: "string" },
          likelyBottlenecks: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
          nextTest: { type: "string" },
        },
        required: ["diagnosis", "likelyBottlenecks", "nextTest"],
        additionalProperties: false,
      },
      growthExperiment: {
        type: "object",
        properties: {
          name: { type: "string" },
          hypothesis: { type: "string" },
          steps: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
          successMetric: { type: "string" },
        },
        required: ["name", "hypothesis", "steps", "successMetric"],
        additionalProperties: false,
      },
      confidence: { type: "string", enum: ["High", "Medium", "Low"] },
    },
    required: ["summary", "verdict", "quickWins", "searchUpgrade", "performanceStory", "growthExperiment", "confidence"],
    additionalProperties: false,
  };

  const prompt = `You are Sitepulse's senior technical SEO and web performance strategist.
Analyze only the supplied evidence. Never invent analytics, rankings, traffic, Core Web Vitals, business facts, or user intent. Clearly frame resource-based performance observations as hypotheses because this is a server-side HTML snapshot, not a rendered browser trace.

Make the advice unusually specific and creative, but practical. Rank quick wins by likely organic-search or user-experience value. Suggested copy must accurately reflect the page content. Avoid generic advice such as "improve your SEO". Use plain English and concise sentences.

AUDIT EVIDENCE:
${JSON.stringify(input)}`;

  const model = env.GEMINI_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.65,
          maxOutputTokens: 2400,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    },
  );

  if (!response.ok) {
    const providerMessage = (await response.text()).slice(0, 300);
    console.error("Gemini API error", response.status, providerMessage);
    throw new Error("Gemini could not complete this analysis.");
  }

  const result = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const json = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
  if (!json) throw new Error("Gemini returned an empty analysis.");
  return JSON.parse(json) as AiAnalysis;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    let url = safeUrl(String(body.url || ""));
    const start = Date.now();
    let response: Response | undefined;

    for (let i = 0; i < 6; i += 1) {
      response = await fetch(url.href, {
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": "SitepulseAudit/2.0", Accept: "text/html" },
      });
      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        url = safeUrl(new URL(response.headers.get("location")!, url).href);
        continue;
      }
      break;
    }

    if (!response?.ok) throw new Error(`The website returned HTTP ${response?.status}. Try another public page.`);
    const ttfb = Date.now() - start;
    if (!response.headers.get("content-type")?.includes("text/html")) {
      throw new Error("This address does not return an HTML webpage.");
    }

    const reader = response.body!.getReader();
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 2500000) {
        await reader.cancel();
        throw new Error("This page is too large to analyze (2.5 MB HTML limit).");
      }
      chunks.push(value);
    }

    const joined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    const html = new TextDecoder().decode(joined);
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    const meta = (name: string) => tags.find((tag) => attribute(tag, "name").toLowerCase() === name || attribute(tag, "property").toLowerCase() === name);
    const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
    const description = attribute(meta("description") || "", "content");
    const images = html.match(/<img\b[^>]*>/gi) || [];
    const missingAlt = images.filter((tag) => !/\balt\s*=/i.test(tag)).length;
    const headings = (html.match(/<h1\b/gi) || []).length;
    const canonical = (html.match(/<link\b[^>]*>/gi) || []).find((tag) => attribute(tag, "rel").toLowerCase() === "canonical");
    const checks: AuditCheck[] = [
      { name: "Page title", pass: !!title, detail: title || "No title found.", fix: "Add a unique, descriptive <title> to the page.", category: "Content" },
      { name: "Meta description", pass: !!description, detail: description ? `${description.length} characters · ${description}` : "Missing description", fix: "Write a useful summary in a meta description to describe this page in search results.", category: "Content" },
      { name: "Main heading", pass: headings === 1, detail: `${headings} H1 headings found`, fix: "Use one clear main heading to describe the page topic.", category: "Content" },
      { name: "Image alternative text", pass: missingAlt === 0, detail: `${missingAlt} of ${images.length} images missing alt attributes`, fix: "Add meaningful alt text to informative images and empty alt attributes to decorative images.", category: "Accessibility" },
      { name: "Canonical URL", pass: !!canonical, detail: canonical ? attribute(canonical, "href") : "No canonical link found", fix: "Specify a canonical URL to clarify the preferred version of this page.", category: "Technical" },
      { name: "Mobile viewport", pass: !!meta("viewport"), detail: meta("viewport") ? "Viewport metadata present" : "Viewport metadata missing", fix: "Add a viewport meta tag with width=device-width, initial-scale=1.", category: "Technical" },
      { name: "Search indexing", pass: !/noindex/i.test(attribute(meta("robots") || "", "content") + " " + response.headers.get("x-robots-tag")), detail: "Checks page robots metadata and response headers; does not check robots.txt.", fix: "Remove noindex directives if this page should appear in search.", category: "Technical" },
      { name: "Secure connection", pass: url.protocol === "https:", detail: url.protocol === "https:" ? "Page served over HTTPS" : "Page served over HTTP", fix: "Serve the page securely over HTTPS.", category: "Technical" },
      { name: "Social sharing metadata", pass: !!meta("og:title") && !!meta("og:description"), detail: meta("og:title") ? "Open Graph title found" : "Open Graph title missing", fix: "Add og:title and og:description for useful link previews.", category: "Content" },
      { name: "Document language", pass: /<html\b[^>]*\blang\s*=/i.test(html), detail: "Checks the HTML language attribute.", fix: "Declare the document language on the html element.", category: "Accessibility" },
    ];
    const metrics = {
      ttfb,
      htmlFetchMs: Date.now() - start,
      htmlBytes: bytes,
      images: images.length,
      scripts: (html.match(/<script\b[^>]*\bsrc\s*=/gi) || []).length,
      stylesheets: (html.match(/<link\b[^>]*\brel\s*=\s*["']stylesheet/gi) || []).length,
    };

    let ai: AiAnalysis | null = null;
    let aiError: string | null = null;
    try {
      ai = await getAiAnalysis({ url: url.href, title, description, textSample: cleanText(html), checks, metrics });
    } catch (error) {
      console.error("AI analysis unavailable", error);
      aiError = error instanceof Error ? error.message : "AI analysis is temporarily unavailable.";
    }

    return Response.json({
      url: url.href,
      title,
      description,
      score: Math.round((checks.filter((check) => check.pass).length / checks.length) * 100),
      checks,
      ttfb,
      load: metrics.htmlFetchMs,
      bytes,
      images: metrics.images,
      scripts: metrics.scripts,
      styles: metrics.stylesheets,
      date: new Date().toISOString(),
      ai,
      aiError,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to analyze this website." },
      { status: 400 },
    );
  }
}
