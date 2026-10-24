# Responsive UI review

Completed 24 October 2026.

The local Chrome viewport audit passed 120 checks: 15 routes and investigation states at 320, 375, 430, 600, 768, 1024, 1440 and 1920 CSS pixels. No page-level horizontal overflow was detected.

Coverage includes the homepage, sample report, workspace, investigation history, completed/running/queued/failed/verification investigations, settings, privacy, terms, help, contact and checkout. Additional checks covered signed-out navigation at six widths and the sign-in error page at 320 and 768 pixels.

Changes include:

- Tablet breakpoints for desktop navigation and pricing cards.
- Readable input, label, evidence and card text sizes; larger touch targets.
- Flexible report actions, filters, metrics, workspace panels and footer layouts.
- Safe wrapping for long URLs and investigation content.
- Mobile navigation that closes when its primary action is selected.
- Scrollable menus on short landscape viewports, with reduced-motion support preserved.

Interaction checks passed for mobile navigation, the conditional goal field, inline validation, the profile menu, expanded finding evidence and landscape menu scrolling. Homepage, workspace and report screenshots were visually reviewed.

## Repeating the checks

Start the isolated local server with the test-only configuration in `docs/launch-review.md`, then run:

```sh
node scripts/responsive-browser.mjs
```

The harness uses labeled local fixtures and a test-only signed session. Results and screenshots are written to `.data/responsive-review/`; the main result is `evidence.json`. It does not submit a payment or execute a real investigation.

These results cover local Chrome viewport emulation. Physical-device Safari/Android behavior and the external payment provider's UI have not been certified by this review.
