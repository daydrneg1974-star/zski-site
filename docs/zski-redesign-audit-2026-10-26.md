# ZSKI — repeat existing-site audit (2026-10-26)

Scope: source review of the experimental branch, not visual browser certification. Keep main and production unchanged.

## Design skill strategy
- Use `redesign-existing-projects` as the audit framework: diagnose before editing; retain existing brand, architecture and proven assets.
- Use `landing-page-design` selectively for information hierarchy, conversion copy and UX states, NOT its mandatory typography/gradient/animation rules.
- Use `design-to-motion` only for video/motion review, not as an excuse to remake a commercial site.
- Local six-module AI Design Toolkit exists as prior discussion, but its current installed package was NOT independently verified in this audit.

## Findings — highest to lowest priority
1. P0 Conversion integrity: `src/pages/prices.html` still displays «Забронировать» linking to `#` in static markup. JS turns it into mailto/WhatsApp; WhatsApp is blank in `js/data.js`. Clarify «Подготовить заявку по почте», provide direct phone alternative and robust no-JS link. Neither action reserves stock.
2. P0 Lead form: `src/pages/contacts.html` uses `novalidate` and JS builds mailto with entered name/phone; no server receipt or delivery confirmation. Explicitly describe mail-app workflow and validate required name/phone; don't promise «перезвоним» as if server received data.
3. P1 Marketing truth: home About block still says «лучшие цены Московской области» and «абсолютно все размеры», despite edited hero and marquee. Remove or substantiate. Verify rating 5.0/529 and the operating hours before production.
4. P1 Price hierarchy: homepage «Прокат от 500 ₽ в день» actually refers to accessories, while rental set starts at 2,000 ₽; make distinction explicit. Check all pricing messages in intro, metadata and cards.
5. P1 Intro friction: `src/layout/intro-head.html` defaults to mandatory full-screen intro for outside first-time navigation. Consider non-blocking optional intro, returning visitors and reduced motion; test entry, skip, Escape, history, and offline failure on iOS/Android.
6. P1 Video weight: cinematic alternative is considerably larger than original (initial full MP4 ~9.1 MB versus 4.5 MB). New encode script has a stricter size gate; quality is NOT judged by file size and needs frame comparison.
7. P1 Preview/CI process: experiment branch uses auto-rebuild committing generated assets; bot commits yield some pull-request status "action_required". Review PR checks, Actions permissions and stable preview delivery. raw.githack is a third-party preview, not guaranteed production-like deployment.
8. P2 Photo framing: service banner switched from cover to contain to avoid subject cropping. Verify composition in narrow/wide viewports; contain can introduce empty bars.
9. P2 Accessibility: burger Escape/outside click improvements are present, but focus containment, keyboard menu navigation, screen-reader reading order, video controls, and form errors still require real browser/a11y checks.
10. P2 Content/SEO: inspect factual reviews, directions, structured data, canonicals pointing to zski.ru when previewing, 404/legal links, and real photos' rights. No invented claims or testimonials.

## Recommended work order
A. Make booking/calculator and contact form honest and functional without JS.
B. Clean unsupported copy and unify accessory vs full set pricing.
C. Test 360/390/768/1024/1440 widths, keyboard, browser history, video intro and slow 4G.
D. Compare source and graded video keyframes; re-encode only with acceptable quality-size tradeoff.
E. Document evidence and screenshots, then seek approval before merging into main.

## Test status
Source audit only. No browser screenshot, Lighthouse, field submission or assistive-tech test performed. This file does not claim those tests passed.
