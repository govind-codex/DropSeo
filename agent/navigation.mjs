import { readablePageState } from "./page-evidence.mjs";

function timedOut(error) {
  return error?.name === "TimeoutError";
}

class PageContentTimeout extends Error {}

export async function navigatePage(page, url, options = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await navigateOnce(page, url, options);
    } catch (error) {
      if (!(error instanceof PageContentTimeout) || page.isClosed() || attempt === 1) throw error;
      options.onWarning?.({ url: page.url(), message: "The website returned an empty page or stayed on its loading screen. Retrying the page once." });
      await page.goto("about:blank", { waitUntil: "commit", timeout: 5_000 });
    }
  }
}

// Keep response arrival separate from DOM readiness: a slow script can hold
// DOMContentLoaded open even when the visitor can already use the document.
async function navigateOnce(page, url, {
  responseTimeoutMs = 25_000,
  domTimeoutMs = 10_000,
  contentTimeoutMs = 30_000,
  onWarning = () => {},
} = {}) {
  let response;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await page.goto(url, { waitUntil: "commit", timeout: responseTimeoutMs });
      break;
    } catch (error) {
      if (page.isClosed()) throw error;
      const retryable = timedOut(error) || /net::ERR_(CONNECTION_RESET|CONNECTION_CLOSED|TIMED_OUT|EMPTY_RESPONSE)\b/.test(error.message);
      if (!retryable) throw error;
      if (attempt === 1) {
        throw new Error(`The target website (${new URL(url).hostname}) did not respond after two attempts. It may be slow, unavailable, or blocking the browser worker. Try again later or investigate another public page.`, { cause: error });
      }
      onWarning({ url, message: "The website has not responded yet. Retrying the page once." });
      // Cancel the timed-out navigation before retrying the same URL. Chromium
      // can otherwise abort the retry while cleaning up the previous request.
      await page.goto("about:blank", { waitUntil: "commit", timeout: 5_000 });
    }
  }

  const status = response?.status();
  const host = new URL(url).hostname;
  if ([401, 403, 429].includes(status)) {
    const reason = status === 401 ? "requires authentication" : status === 403 ? "refused access to the browser worker" : "is rate-limiting requests";
    throw new Error(`The target website (${host}) ${reason} (HTTP ${status}). The investigation cannot continue from this worker. Try a publicly accessible page${status === 429 ? " or wait before trying again" : ""}.`);
  }

  let partialLoad = false;
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: domTimeoutMs });
  } catch (error) {
    if (!timedOut(error) || page.isClosed()) throw error;
    partialLoad = true;
  }

  // Never accept a blank document as successful evidence, even after a response.
  try {
    // The default requestAnimationFrame polling can stall on background pages
    // or sites that replace animation callbacks, even after content appears.
    await page.waitForFunction(readablePageState, null, { timeout: contentTimeoutMs, polling: 100 });
  } catch (error) {
    if (!timedOut(error) || page.isClosed()) throw error;
    throw new PageContentTimeout(`The target website (${host}) responded${status ? ` with HTTP ${status}` : ""} but did not display readable page content within ${contentTimeoutMs / 1000} seconds on the final attempt. It may still be loading, have a script error, or restrict automated access. Try again later or investigate another public page.`, { cause: error });
  }

  if (partialLoad) onWarning({ url: page.url(), partialLoad: true, message: "The page is still loading. Continuing with the readable content already available; load-dependent checks may be incomplete." });
  return { response, partialLoad };
}
