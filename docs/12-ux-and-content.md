# UX and content

Screen lists and copy below are PROPOSED unless they quote the collection. Visual rules are in `11-design-system.md`.

## 1. UX principles

1. One primary action per screen. In an emergency, it is the only action that is emphasized.
2. As little typing as possible. Detect location, remember profile, offer choices instead of fields.
3. Never block help. A denied location, a missing profile, a failed SMS or a failed model call must not stop an SOS.
4. Say what is happening now, what happens next, and how fresh the information is.
5. The emergency number is reachable from every screen of the patient flow. Verify the number and any state-specific ambulance number before launch.
6. Poor networks are normal. Every live screen has a defined offline and reconnecting state.
7. Consent is asked at the moment it matters, in plain words.
8. Every listing says where its information came from and when it was checked. Every outbound link says the user is leaving CareRoute (D-28, P-24).

## 2. Screens by role

### Public

| Screen | Purpose |
| --- | --- |
| Home | One primary action: get help now (guest SOS). Secondary: search hospitals, doctors, medicines, pharmacies and diagnostic centres; ask the assistant; sign in. No marketing sections. Whether search works before sign-in is OPEN (Q-27). |
| Guest SOS | Phone number, location, what happened, ambulance type. Ends on the tracking screen. |
| Family tracking | Opened from the SMS link. Ambulance status, ETA, last updated time. Nothing else. |
| Sign in, create account | Standard forms. |

### Patient

| Screen | Purpose |
| --- | --- |
| Get help | The SOS form for self or someone else |
| Active emergency | Care Thread, map, ETA, cancel before pickup, emergency number |
| Medical ID | Blood group, allergies, notes, crew sharing switch |
| Contacts | List, add, delete |
| Search | One search box with a type selector: hospitals, doctors, medicines, pharmacies, diagnostic centres. Filters fit the type: area, distance, speciality, department, test, rating once Q-24 is decided. |
| Hospital detail | Description, address and map, phone, email if public, website, specialities and departments, doctors, source and checked date |
| Doctor detail | Specialization, qualifications, experience, hospital or clinic, published timings if official, contact, official profile link |
| Medicine prices | One row per platform: listed price, product, checked date, link to the platform. Cheapest first. |
| Pharmacy and diagnostic centre detail | Address and map, directions link, contact, tests listed (diagnostic centres) |
| Assistant | Describe a need in words. Shows a suggested speciality and matching listings, with the disclaimer. |
| Reports | Upload, list, explain a report, crew sharing if Q-11 allows, who viewed |
| Report explanation | Plain-language summary, terms, values against the report's own ranges, questions to ask a doctor, disclaimer |
| Symptom check | Triage input and result |
| History | Past emergencies, feedback |

### Driver

| Screen | Purpose |
| --- | --- |
| Vehicle | Register ambulance, set available, offline or busy |
| Offers | Inbox with a visible 30 second countdown shown as text and a bar. Accept and Reject (D-32). |
| Trip | Care Thread, map, big next-step button for the next state |

### Platform admin (D-29)

| Screen | Purpose |
| --- | --- |
| Users | List accounts, disable or enable. No medical data. (P-22) |
| Listings | Hospitals, doctors, pharmacies, diagnostic centres, medicines: add, edit, hide, mark checked. Shows source and checked date. (P-22) |
| Active cases | Table with compact Care Thread, filters, failed matches pinned to top (P-18) |
| Ambulances nearby | Map and list by type and radius (P-18) |
| Analytics | Summary numbers and response time by hour, with a table view (P-18) |

## 3. Key flows

1. **Raise an SOS (patient).** Open, location detected, choose self or other, emergency type, ambulance type if known, send. Land on the active emergency screen.
2. **Raise an SOS (guest).** Phone, location, what happened, send. Land on tracking.
3. **Driver trip.** Receive offer, accept or reject within 30 seconds, then one large button per step: on my way, arrived, patient on board, at hospital, complete.
4. **Find a resource.** Choose a type, type a name or need, filter by area, open a result, contact the provider or open their website.
5. **Compare a medicine's price.** Type the name, see each platform's listed price and checked date, open the platform to buy there.
6. **Explain a report.** Upload or pick a report, read the notice that it goes to an AI service, confirm, read the explanation and disclaimer.
7. **Ask the assistant.** Describe the need, see the suggested speciality and matching listings. If the rule layer finds a red flag, the SOS action comes first.

## 4. States every screen defines

Loading, empty, error, offline, permission denied, and success. Each has copy. Error copy says what went wrong and what the person can do.

## 5. Status copy (PROPOSED wording, `{}` is a value)

| State | Patient sees |
| --- | --- |
| `matching` | Finding the nearest ambulance. |
| `assigned` | An ambulance has accepted. About {n} minutes away. |
| `en_route` | The ambulance is on its way. About {n} minutes away. |
| `arrived` | The ambulance is at your location. |
| `picked_up` | You are on board. On the way to the hospital. |
| `at_hospital` | Arrived at the hospital. |
| `completed` | The trip is complete. You can leave feedback. |
| `cancelled` | This request was cancelled. |
| Failed match | We could not reach an ambulance. Call {emergency number} now. |
| ETA is an estimate | About {n} minutes. This is an estimate. |

## 6. Voice and writing rules

1. Plain words. Short sentences. Written for someone who is frightened and in a hurry.
2. Say the specific thing. "An ambulance is 6 minutes away" beats "Help is on the way".
3. Sentence case for headings and buttons.
4. Buttons are verbs: "Send request", "Accept", "Save".
5. Use numbers and units: "6 min", "2.4 km", "3 pharmacies within 1.5 km".
6. Dates and times are unambiguous and in the user's local time. Live values say "updated 12 s ago".
7. No emoji. No exclamation marks in emergency screens.
8. No em dashes anywhere. Use a comma, a colon, a period or a new sentence. Ranges use "to".
9. No jokes, no marketing voice, no cleverness on any screen a patient might see during an emergency.
10. Never claim what we cannot back up: no "fastest", "trusted by", "certified", "24/7", "AI-powered diagnosis". Claims need a source.
11. Never diagnose. Say "may need urgent care", not "you have".

## 7. Banned words and phrases

These read as filler. Do not use them in product copy, docs or comments: seamless, cutting-edge, revolutionary, state-of-the-art, next-generation, game-changing, innovative, leverage, empower, unlock, supercharge, robust, world-class, best-in-class, holistic, ecosystem (as a pitch word), journey (as a pitch word), delight, magical, effortless, reimagine, "at your fingertips", "take control of".

## 8. Required microcopy

| Place | Text must include |
| --- | --- |
| Every triage result | The disclaimer from the server, shown in full |
| Medical ID switch | Who can see it and when |
| Report sharing | Exactly who will see the file |
| SMS consent | That contacts get a tracking link by SMS |
| Location prompt | Why location is needed and that denying it still allows manual address entry |
| Failed match | The emergency number |
| Estimate | The word "estimate" whenever ETA comes from the fallback |
| Every listing | Where the information came from and the date it was checked |
| Outbound link | That the user is leaving CareRoute, and that CareRoute does not book, sell or take payment |
| Medicine price | "Listed price on {platform}, checked {date}. The price on the site may differ." |
| Report explanation | The disclaimer from the server, and that this is not a diagnosis |
| Doctor timings | "Published timings. Contact the hospital or clinic to confirm." |

## 9. Landing and first impression

The first screen of the public site is the help action, not a pitch. If a page about the service is added later, it contains: what CareRoute does in plain sentences, how a request works in numbered steps, what data is kept and why, and a contact route. It must not contain invented statistics, fabricated testimonials, partner logos we do not have, or a row of three feature tiles.

## 10. Dashboards

- Lead with the numbers the admin acts on: active cases, failed matches, unassigned time (P-18). For listings: listings not checked recently.
- Charts show real values with direct labels and offer a table view.
- State the time zone used for hourly grouping on the chart.
- Do not show a chart for data that does not exist yet. Show an empty state.
