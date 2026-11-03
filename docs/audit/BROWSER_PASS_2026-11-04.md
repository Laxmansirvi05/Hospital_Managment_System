# CareRoute browser, accessibility, and assistant safety pass

Date: 2026-11-04

## Summary for the owner

The public home, sign-in, sign-up, privacy, and terms pages render in Chromium at mobile, tablet, and desktop sizes without horizontal document overflow. The private pages redirected to sign-in during the sample-data sweep, as expected without a user session. On the connected dev project, two synthetic accounts completed sign-up and account deletion through the interface. The assistant robot appeared on a signed-in patient dashboard and did not appear on SOS.

The largest observed performance issue is the 62 MB ambulance video: it is used by both sign-in and sign-up, and a byte-range request returned the full 64,522,280 bytes with HTTP 200 rather than a partial response. The app does not have a dedicated `/search/doctors/` route. No product files were changed.

## Browser setup and route results

- Chromium installed with `pnpm exec playwright install chromium` (exit 0).
- Sample mode: local server at `http://127.0.0.1:4002`, started with `DATABASE_URL` empty. The dev server at port 4000 was already occupied, so the sample server used 4002.
- Browser sizes: 390x844, 820x1180, and 1440x900. Reduced motion was enabled for the route sweep.
- 24 requested route paths were visited at each of the three sizes, 72 visits total. The HTTP status was 200 for 66 visits and 404 for six visits: `/search/doctors/` and the intentional `/not-a-real-route`, each at all three sizes.
- Seventeen protected paths redirected to `/signin/?next=...` because the sample session was unauthenticated. Their application content, live data, empty states, and error states were therefore not evaluated by the sample sweep.
- No horizontal overflow was measured. The heuristic found no missing `alt` attributes in the observed mobile DOM. It identified text below 12 px and controls below 44 px on some pages; hidden accessibility text and geometry heuristics can cause false positives, so these are candidates for an axe and manual touch-target review, not confirmed WCAG violations.
- Console errors on protected pages were HTTP 401 responses from the expected unauthenticated API calls. No failed network requests or CSP violation messages were recorded. The intentional 404 path and nonexistent doctors path emitted expected 404 console messages.

| Route group | Result | Severity | Evidence |
| --- | --- | --- | --- |
| `/`, `/signin/`, `/signup/`, `/privacy/`, `/terms/` | WORKS for initial page render at the three viewports; 200 response. | S3 | [`browser-results.json`](./browser-pass/browser-results.json), screenshots `_-mobile.png`, `_signin_-mobile.png`, `_signup_-mobile.png`, `_privacy_-mobile.png`, `_terms_-mobile.png` |
| Protected patient pages | UNVERIFIED for content and actions in the sample route sweep; redirected to sign-in. | S2 | `browser-results.json`; final URLs show the `/signin/?next=...` redirect. Separate signed-in robot/SOS check below. |
| `/search/doctors/` | BROKEN as a direct path, 404. The current public tree has no matching route. Search may be unified through another search page; that path was not verified. | S2 | `browser-results.json`, `_search_doctors_-mobile.png` |
| `/not-a-real-route` | WORKS as a not-found response, 404. | S3 | [`_not-a-real-route-mobile.png`](./browser-pass/_not-a-real-route-mobile.png) |
| Layout overflow | No horizontal overflow measured at any path/viewport. | S3 | `browser-results.json` |
| Touch target and text size heuristic | Candidate small controls/text found. Manual and axe review still needed. | S3 | `browser-results.json` fields `minTextPx` and `smallTouchTargets` |

The requested 44 px target, keyboard-only navigation, visible focus, 200 percent zoom, axe rules, external links, all `src`/`srcset`/CSS URL checks, and per-page real-data/error-state verification were not completed. No external sites were probed.

## Connected dev journeys

Two accounts using synthetic `example.test` addresses were created on `careroute-dev` through the sign-up screen. The test checked the robot on `/dashboard/`, checked that it was absent on `/sos/`, then deleted each account through Account and privacy. Both accounts were deleted successfully. A read-only aggregate query, `SELECT count(*) FROM public.users WHERE email LIKE 'audit.%@example.test'`, returned `0`. No user rows were selected. No AI consent was given, no assistant message was sent, and no provider was contacted.

| Journey | Status | Severity | Reproduction and evidence |
| --- | --- | --- | --- |
| Sign up with a synthetic patient | WORKS on dev | S2 | Browser form submit on dev; see `dev-accounts.mjs` and stdout in the task record. |
| Robot visible on signed-in patient page | WORKS on dev | S2 | `.ast-robot` present on `/dashboard/`; screenshot [`signed-in-dashboard-one.png`](./browser-pass/signed-in-dashboard-one.png). |
| Robot absent on SOS | WORKS on dev | S2 | `.ast-robot` absent on `/sos/` for both synthetic accounts. Screenshot [`signed-in-sos-one.png`](./browser-pass/signed-in-sos-one.png). |
| Delete account and clean up test users | WORKS on dev | S1 | Account deletion UI, then aggregate count returned 0. |
| Assistant consent, chat, saved conversation, upload, and withdrawal journey | UNVERIFIED in browser | S1 | Not run because real-provider calls were not approved; fake-provider behavior is covered by the existing API tests only. |
| Search, details, reminders, medical ID, documents, reviews, password, sessions, and Google journeys | UNVERIFIED end to end | S2 | Private pages redirected without a session in the sample sweep; not all were repeated with signed-in users. |

## Assistant safety tests

The existing `NODE_ENV=test pnpm test` run passed 137 tests: 67 unit and 70 API tests. The assistant API suite uses a fake provider. Coverage observed in the test names/assertions includes:

- No model call before consent, consent withdrawal, and the allowed request body fields.
- Red-flag urgency and SOS recommendation remain in the server response even when fake model output says routine.
- Prescription and diagnosis wording is rejected or replaced; disclaimers and structured outputs are checked.
- Provider fallback behavior when no provider answers; document ownership; DOCX text handling; saved conversation ownership and deletion; account cascade deletion.

The browser did not send the prompt matrix from the plan: chest pain, mild headache, injection, diagnosis/prescription requests, Telugu/Hindi, long or empty input, timeout, provider error, synthetic report with injection, or 15 real AI calls. Those cases remain unverified in the browser. The five rules and test mapping are in [the release report](./RELEASE_READINESS_2026-11-04.md). The clinician sheet was not made because its approval field was blank.

## Robot, CSP, and media

- `vercel.json` has `script-src 'self'`. The robot imports vendored Three.js and `/assistant/robot.glb` from the same origin. The local app served a CSP header with same-origin scripts; no CSP violation appeared during the route sweep.
- `public/assistant/robot.glb` is 390 KB. `public/vendor/three/three.module.min.js`, `GLTFLoader.js`, and `BufferGeometryUtils.js` are approximately 675 KB, 108 KB, and 31 KB. Combined raw size is about 1.2 MB, below the 1.5 MB target before compression and other page assets.
- The auth page constructs an autoplaying, muted video with metadata preload on both sign-in and sign-up. It removes autoplay when reduced motion is requested.
- Local dev `curl -r 0-1023` against the video returned HTTP 200 and downloaded 64,522,280 bytes. Range streaming was not supported by that local static server response. The video is 62 MiB on disk. This is an S2 performance finding; proposed remediation is to produce a substantially smaller web encode and serve it with byte-range support, or use a lightweight still image until playback is requested.
- WebGL-disabled fallback, robot drag persistence, resizing, A-key/double-tap opening, animation reduction, keyboard and screen-reader panel behavior were not exercised.

## Remaining work

1. Repeat the full page matrix in dev with a signed-in synthetic account and exercise key journeys without model calls.
2. Run axe and manual keyboard, focus, touch target, reduced-motion, 200 percent zoom, and screen-reader checks.
3. Fix or document the missing doctors search path after confirming intended navigation.
4. Reduce the auth video weight and confirm actual production range support before re-enabling autoplay.
5. Run the fake-provider prompt matrix and synthetic document-injection case in an authorized isolated browser session; no real provider call without separate approval.
6. Arrange the clinician review before real assistant use.
