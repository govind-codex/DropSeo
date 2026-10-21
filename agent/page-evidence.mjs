// Runs in the browser. Reuse the same readiness check for navigation and images.
export function readablePageState() {
  const text = document.body?.innerText.trim() || "";
  if (!text || /^(?:(?:loading|please wait)[\s.\u2026!]*)+$/i.test(text)) return null;
  const busy = [...document.querySelectorAll('[aria-busy="true"]')].some((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" &&
      rect.width >= innerWidth * .8 && rect.height >= innerHeight * .5;
  });
  return busy ? null : { url: location.href, text };
}

export async function capturePageEvidence(page, { timeoutMs = 10_000, stableMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let previous = null;
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    let state;
    try {
      state = await page.evaluate(readablePageState);
    } catch (error) {
      // A client-side redirect may replace the execution context while polling.
      if (page.isClosed() || !/execution context was destroyed|cannot find context/i.test(error.message)) throw error;
    }
    if (!state || state.url !== previous?.url || state.text !== previous?.text) stableSince = Date.now();
    if (state && Date.now() - stableSince >= stableMs) {
      let buffer;
      try {
        buffer = await page.screenshot({ type: "jpeg", quality: 55, fullPage: false, animations: "disabled", timeout: Math.max(1, deadline - Date.now()) });
      } catch (error) {
        if (error.name !== "TimeoutError" || page.isClosed()) throw error;
        return null;
      }
      const after = await page.evaluate(readablePageState).catch((error) => {
        if (page.isClosed() || !/execution context was destroyed|cannot find context/i.test(error.message)) throw error;
        return null;
      });
      // Do not label an image with a URL from a later redirect or keep an image
      // taken as the page switched back to a loading shell.
      if (after?.url === state.url && after.text === state.text) return { buffer, url: state.url };
      stableSince = Date.now();
      previous = null;
    } else {
      previous = state;
    }
    await page.waitForTimeout(100);
  }
  return null;
}
