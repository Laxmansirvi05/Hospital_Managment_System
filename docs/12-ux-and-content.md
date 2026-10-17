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

## 2. Screens by role

### Public

| Screen | Purpose |
| --- | --- |
| Home | One primary action: get help now (guest SOS). Secondary: sign in, check symptoms. No marketing sections. |
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
| Reports | Upload, list, sharing, who viewed |
| Nearby hospitals | List with distance, emergency availability, beds, doctors |
| Symptom check | Triage input and result |
| History | Past emergencies, feedback |

### Driver

| Screen | Purpose |
| --- | --- |
| Vehicle | Register ambulance, set available, offline or busy |
| Offers | Inbox with a visible 30 second countdown shown as text and a bar |
| Trip | Care Thread, map, big next-step button for the next state, recommended hospitals, destination choice |

### Hospital admin

| Screen | Purpose |
| --- | --- |
| Hospital profile | Details, departments, emergency availability |
| Beds | Update ICU and general counts with "updated at" |
| Doctors | List and add |
| Incoming | Pre-alerts with case type, condition, ETA, shared reports |

### Dispatcher

| Screen | Purpose |
| --- | --- |
| Active cases | Table with compact Care Thread, filters, failed matches pinned to top |
| Ambulances nearby | Map and list by type and radius |
| Analytics | Summary numbers and response time by hour, with a table view |

## 3. Key flows

1. **Raise an SOS (patient).** Open, location detected, choose self or other, emergency type, ambulance type if known, send. Land on the active emergency screen.
2. **Raise an SOS (guest).** Phone, location, what happened, send. Land on tracking.
3. **Driver trip.** Receive offer, accept within 30 seconds, then one large button per step: on my way, arrived, patient on board (choose hospital), at hospital, complete.
4. **Hospital pre-alert.** New incoming case appears at the top of the list with ETA. Reports appear when shared.
5. **Reports sharing.** Upload, choose to share, see the sentence naming who will see it, confirm.

## 4. States every screen defines

Loading, empty, error, offline, permission denied, and success. Each has copy. Error copy says what went wrong and what the person can do.

## 5. Status copy (PROPOSED wording, `{}` is a value)

| State | Patient sees |
| --- | --- |
| `matching` | Finding the nearest ambulance. |
| `assigned` | An ambulance has accepted. About {n} minutes away. |
| `en_route` | The ambulance is on its way. About {n} minutes away. |
| `arrived` | The ambulance is at your location. |
| `picked_up` | On the way to {hospital}. |
| `at_hospital` | Arrived at {hospital}. |
| `completed` | The trip is complete. You can leave feedback. |
| `cancelled` | This request was cancelled. |
| Failed match | We could not reach an ambulance. Call {emergency number} now. |
| ETA is an estimate | About {n} minutes. This is an estimate. |

## 6. Voice and writing rules

1. Plain words. Short sentences. Written for someone who is frightened and in a hurry.
2. Say the specific thing. "An ambulance is 6 minutes away" beats "Help is on the way".
3. Sentence case for headings and buttons.
4. Buttons are verbs: "Send request", "Accept", "Save".
5. Use numbers and units: "6 min", "2.4 km", "12 of 30 beds".
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

## 9. Landing and first impression

The first screen of the public site is the help action, not a pitch. If a page about the service is added later, it contains: what CareRoute does in plain sentences, how a request works in numbered steps, what data is kept and why, and a contact route. It must not contain invented statistics, fabricated testimonials, partner logos we do not have, or a row of three feature tiles.

## 10. Dashboards

- Lead with the numbers a dispatcher acts on: active cases, failed matches, unassigned time.
- Charts show real values with direct labels and offer a table view.
- State the time zone used for hourly grouping on the chart.
- Do not show a chart for data that does not exist yet. Show an empty state.
