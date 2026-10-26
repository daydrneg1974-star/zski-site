# ZSKI — AI Design Toolkit pilot (2026-10-26)

## Scope
Test focused UX improvements on the existing static site without changing its visual identity or the published main branch.

## Verified from source
- Production is generated from src/pages and src/layout by src/build.py; deployed root HTML is generated output.
- Rental prices and contact details are centralized in js/data.js.
- Intro uses video and browser history and remains untouched.
- Calculator generates a WhatsApp/email inquiry; it does **not** reserve inventory server-side.
- Mobile navigation previously offered only burger toggle; Escape, outside click, and link-dismiss were not implemented.

## Implemented in this branch
1. Close open mobile menu on Escape, outside pointer press, or navigation link click. Update expanded state and accessible toggle label.
2. Rename calculator action dynamically to 'Отправить заявку в WhatsApp' or 'Отправить заявку по почте', preserving existing destination and calculation.

## Candidate improvements requiring review, not implemented
- Verify claims 'лучшие цены', 'абсолютно все размеры', 'подбор за 10 минут' and the Yandex rating/date; do not invent supporting evidence.
- Evaluate intro opt-out and test time to first actionable price information on actual mobile devices.
- Check keyboard focus, contrast and mobile viewport behavior with browser-based tests.
- Confirm business acceptance of proposed copy and whether inquiry email is monitored.

## Release gate
- Execute `node --check js/main.js`, `python3 src/build.py --check`, and browser tests of the calculator/mobile drawer.
- Run `python3 src/build.py` before deployment to roll the cache-busting build version and service-worker version, then commit generated HTML and sw.js.
- Inspect actual mobile and desktop screenshots before approving. Do not merge until verified.
- This pilot is not a comprehensive visual redesign or a measured conversion A/B test.
