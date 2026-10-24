# CareRoute prototype

A clickable, light-theme prototype of the whole web app, built on the owner's request of 2026-10-24. It shows how the product looks and moves. It is not the application: there is no login, no landing page, no database, no AI provider and no real data.

## Run it

From the repository root:

```bash
python3 prototype/dev-server.py
```

Then open http://127.0.0.1:4100. The server sends `Cache-Control: no-store` so edits show on reload. Port 4000 stays free for the API.

## What is in it

Use "Viewing as" in the sidebar (or the menu at the top on a phone) to switch role.

| Role | Screens |
| --- | --- |
| Patient | Home, search (hospitals, doctors, medicines, pharmacies, diagnostic centres), hospital, doctor, medicine price comparison, pharmacy and diagnostic centre pages, assistant, reports and report explanation, medical ID and contacts, emergency history, request an ambulance, live emergency |
| Family | Tracking view opened from the SMS link (from the live emergency screen, "Open family view") |
| Driver | Status and offer inbox with a 30 second countdown, accept or reject, current trip with one next-step button |
| Admin | Overview (figures, active emergencies, response time chart, ambulances online), listings with source and last checked date, users |

The live emergency moves through every state by itself (matching, assigned, en route, arrived, picked up, at hospital, completed). "Prototype controls" on that screen skip ahead or start over.

## Design note

**Direction.** Calm, exact and trustworthy, after Apple's Human Interface Guidelines (D-15): the system font, the type scale and colour tokens from `docs/11-design-system.md`, one interactive colour (blue `#0066CC`), red only for SOS and errors, green for confirmed states, orange for values a report flags. Light theme only for now, as asked.

**3D, without the banned effects.** Depth is built from flat faces and layered shadows, never from gradients, glass, blur, cursor tracking or scroll animation (all banned by D-16):

| Component | How the 3D works |
| --- | --- |
| Map | An illustrative Hyderabad slab tilted in CSS perspective, with a visible front edge. Markers stand upright on it and cast a shadow. The ambulance marker glides between positions, which is the allowed "marker moving between pings" motion. |
| SOS key | A physical key with a solid darker side face. It presses down 5 px when tapped. |
| Charts | Isometric bars in SVG: front, top and side faces in three flat shades, values written on the bars, a table view for the admin chart. |
| Report | The uploaded report shown as a stack of pages in perspective, with flagged values highlighted. |
| Care Thread | Raised nodes on a line, solid between completed steps and dashed toward the next ones. |
| Offer countdown | A raised disc with a progress ring that turns orange in the last 10 seconds. |
| Brand mark | An isometric cube with a route line on its top face. |

**Copy.** Plain words, numbers with units, no emoji, no em dashes, no buzzwords. Every listing says where its data came from and when it was checked. Every outbound link says CareRoute does not book, sell or take payment. The assistant and report explanation always carry the disclaimer and never diagnose, prescribe or recommend a medicine (D-33).

## Where this differs from the documents

These are prototype choices. They are PROPOSED and need the owner's yes before the real build follows them.

1. **Depth on cards.** `docs/11-design-system.md` section 5.3 says cards are flat with one shadow for floating layers only. The prototype gives featured cards a soft layered shadow (`.card-raised`) to support the 3D look the owner asked for.
2. **Map.** The real product uses MapLibre with MapTiler tiles (D-08). The prototype draws its own illustrative map so it runs with no keys. It says "Illustrative map, not to scale" on every map.
3. **Ambulance marker colour.** Blue, not red, because red is reserved for SOS and errors and the admin map shows several ambulances at once.
4. **Single page.** The real product is multi-page (`docs/02-trd.md` section 3). The prototype uses hash routes in one page so it is one static folder.
5. **Ratings.** Shown on listings because the vision asks for them. Where ratings come from is still OPEN (Q-24).
6. **SOS sends on one tap.** How to prevent accidental SOS taps is still OPEN (Q-12). The prototype sends on submit and allows cancel until pickup.
7. **Crew access to reports.** Still OPEN (Q-11). The Care Thread shows "None shared".

## What is not real

- Every name, phone number, address, price, rating and date is invented. Web addresses use the reserved `.example` domain. Platform names (Apollo Pharmacy, MedPlus, Tata 1mg, Apollo 24|7) appear as sources and price columns, but every price is sample data.
- Nothing is uploaded, saved, sent or called. Buttons that would do so show a "Prototype only" message.
- The emergency number shown is 112. Verify it, and any state ambulance number, before launch (`docs/01-prd.md` section 9).

## Files

| Path | What |
| --- | --- |
| `index.html` | Shell |
| `css/tokens.css` | Colours, type, spacing, radius, depth |
| `css/base.css`, `css/components.css`, `css/screens.css` | Layout and components |
| `js/app.js` | Router, sidebar, tab bar, role switch |
| `js/h.js` | DOM builder (text only, never HTML strings) and the custom icon set |
| `js/data.js` | Sample data |
| `js/map3d.js`, `js/charts.js` | 3D map and 3D bars |
| `js/emergency-store.js` | Simulated emergency states |
| `js/screens/*.js` | One module per area |
| `dev-server.py` | No-cache static server |
