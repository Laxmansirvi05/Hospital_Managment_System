# Google Stitch prompts for CareRoute

How to use:

1. Create one Stitch project. Choose **Web** for desktop screens and **Mobile** for phone screens, as marked on each prompt.
2. Paste the **design brief** first, together with prompt 1. Generate the remaining screens in the same project, so Stitch keeps the style.
3. If a screen drifts from the style, paste the design brief again before its prompt.
4. All data is sample data. Keep it that way: no real hospital, doctor or price.

---

## Design brief (paste first)

```
Design brief for CareRoute, a healthcare discovery and emergency ambulance web app for Hyderabad, India.

Feel: calm, exact, trustworthy, like an Apple product. Follow Apple Human Interface Guidelines. Light theme only.

Colours (use only these):
- Page background #F5F5F7, cards and sheets #FFFFFF, soft dividers #E8E8ED.
- Primary text #1D1D1F, secondary text #6E6E73.
- Blue #0066CC is the only interactive colour: buttons, links, selected states. Pressed blue #0058B0. Blue tint background #EAF3FF.
- Red #D70015 only for the SOS / request ambulance button, errors and destructive actions. Red tint #FFF1F0.
- Green #1E7B34 for confirmed and "in range" states, tint #EAF7EC.
- Orange #C93400 for warnings and values a report flags as low or high, tint #FFF3E5.

Type: the Apple system font (SF Pro). Large title 34 bold, title 28 bold, card title 22 semibold, body 17, secondary 15, footnote 13. Numbers use tabular figures. Left aligned text.

Shape and space: 4 px spacing grid (8, 12, 16, 24, 32, 48). Cards 16 px radius, buttons and inputs 12 px radius, sheets 24 px radius. All touch targets at least 44 px tall.

3D style: use real depth made of flat faces and soft layered shadows. Raised cards with a soft, wide shadow. The SOS button is a physical red key with a solid darker red side face beneath it, so it looks pressable. Maps are drawn as a slab tilted in perspective with a visible front edge, and round map markers stand upright on thin stems with small shadows. Charts are isometric 3D bars with a front, top and side face in three flat shades of one colour. Domain icons sit on small raised white squares with a soft shadow.

Icons: simple custom line icons, 1.8 px stroke, round joins, 20 or 24 px. Icons always sit next to a text label.

Layout: desktop has a white left sidebar 272 px wide with the logo "CareRoute" (small blue isometric cube mark), a segmented control "Viewing as: Patient / Driver / Admin", navigation items, and at the bottom a red pill button "Request ambulance" with the line "Emergency number 112". Mobile has a top bar with logo and role menu, a bottom tab bar (Home, Search, Assistant, Reports, Profile) and a floating red "SOS" pill above the tab bar.

A thin dark strip at the top of the content says: "Prototype. All names, numbers and prices are sample data. Nothing is connected to a real service."

Copy rules: plain, specific English. No emoji. No em dashes. No exclamation marks. No marketing words such as seamless, revolutionary, cutting-edge, empower. Never diagnose, prescribe or recommend a medicine.

Do NOT use: gradients of any kind, purple, glassmorphism or frosted blur, the Inter font, cards with a coloured left border, three icon tiles in a row, a small badge or pill above the main headline, stock photos of people, illustrations of doctors, dark mode.
```

---

## Patient screens

### 1. Home (Web)

```
Screen: Patient home, desktop, sidebar with "Home" selected.

Large title "Find care in Hyderabad". Subtitle: "Search hospitals, doctors, medicines, pharmacies and diagnostic centres in one place, and get an ambulance when you need one."

Two columns.

Left column:
- Raised card "What are you looking for?" with a segmented control: Hospitals (selected), Doctors, Medicines, Pharmacies, Diagnostic centres. Below it one row: a search field with a search icon and placeholder "Hospital name, speciality or department", a dropdown "All of Hyderabad", and a blue "Search" button.
- Card "Emergency care near you" with the line "Near Prakash Nagar Metro, Begumpet" and a small "See all" button. Inside, a 3D tilted map slab of Hyderabad with a lake labelled Hussain Sagar, roads and area names (Kukatpally, Madhapur, Begumpet, Secunderabad, Banjara Hills, Charminar). Upright markers: a dark "You" marker and four hospital markers, one highlighted in blue with the label "Lakeview Multispeciality Hospital". Caption "Illustrative map, not to scale". Below the map a list of four hospitals, each row with a raised hospital icon, name, "Begumpet · Cardiology, Neurology", distance on the right such as "0.8 km", and a chevron.

Right column:
- Raised card "Need an ambulance?" with "Your request goes to the nearest available ambulance. Your family can follow it with a link." and a large 3D red key button "Request ambulance" with smaller text "Your location is filled in for you". Under it "Or call 112".
- Card "Not sure who to see?" with "Describe it in your own words. The assistant suggests a speciality and nearby care." and a message field "For example: knee pain after a fall" with a blue send button.
- Card "Latest report" with one row "Complete blood count, Uploaded 18 Oct 2026" and a blue tag "Explain".
- Card "Medical ID": Blood group B+, Allergies Penicillin, and a green status line "Shared with your ambulance crew during an emergency".
```

### 2. Home (Mobile)

```
Screen: the same patient home on a phone, 375 px wide.

Top bar: CareRoute logo and a "Patient" role menu. Large title "Find care in Hyderabad" and the subtitle. The search card stacks vertically: segmented control wraps to two lines, then search field, area dropdown and a full width blue "Search" button. Then "Emergency care near you" with the 3D tilted map and the hospital list. Then the "Need an ambulance?" card with the big red 3D key. Floating red "SOS" pill bottom right above the tab bar. Bottom tab bar: Home (selected, blue), Search, Assistant, Reports, Profile.
```

### 3. Search results, hospitals (Web)

```
Screen: Search, desktop, sidebar "Search" selected.

Large title "Search". Subtitle "Information comes from public listings on online platforms. Contact the provider to confirm before you go."

Raised search card at full width with the segmented control (Hospitals selected), search field, area dropdown and "Search" button.

Below, two columns:
- Left card titled "8 hospitals" with filters on the right: a dropdown "Any speciality" and a chip "Emergency department". A list of hospitals, each row: raised hospital icon, name in semibold (Lakeview Multispeciality Hospital, Deccan Heart and Lung Institute, Sanjeevani General Hospital, Clearsight Eye Hospital, Hitec City Medical Centre), a meta line "Begumpet · Cardiology, Neurology, Orthopaedics", a rating "4.5 (812 reviews)" with a small orange star, a green tag "Emergency department" where it applies, distance on the right and a chevron.
- Right column, sticky: the 3D tilted map with up to eight upright hospital markers, the nearest highlighted in blue with its name label. Footnote: "Results are sorted by distance from your location. Select a marker to open it."
```

### 4. Hospital detail (Web)

```
Screen: Hospital detail, desktop.

Breadcrumb "Search > Lakeview Multispeciality Hospital". Title "Lakeview Multispeciality Hospital".

Left column:
- Raised card: rating "4.5 (812 reviews)", green tag "Emergency department, 24 hours", "Begumpet · 0.8 km away". Paragraph: "A 300 bed multispeciality hospital with a 24 hour emergency department, cardiac care and a neurology unit." Below it a 3D tilted map with this hospital's marker highlighted and labelled.
- Card "Specialities" with blue tags: Cardiology, Neurology, Orthopaedics, General Medicine, Emergency Medicine. "Departments" with grey tags: Emergency, Intensive care, Cardiology, Neurology, Radiology, Pharmacy.
- Card "Doctors at this hospital (1)" with a row "Dr. Karthik Iyer, Neurology · 12 years" and a rating.

Right column:
- Card "Contact": full width blue button "Call +91 40 4000 1201", then Address "14 Airport Road, Begumpet, Hyderabad 500016", Email "care@lakeview.example", Official website "lakeview.example" with an external link icon, a secondary button "Get directions", and the footnote "Links open the provider's own website. CareRoute does not book appointments, sell medicines or take payments."
- Footnote with an info icon: "Source: Apollo 24|7. Checked on 22 Oct 2026."
```

### 5. Doctor detail (Web)

```
Screen: Doctor profile, desktop.

Breadcrumb "Search > Dr. Ananya Rao". Title "Dr. Ananya Rao".

Left column:
- Raised card with a large raised stethoscope icon, "Cardiology", a link "Deccan Heart and Lung Institute", rating "4.8 (214 reviews)". Two column facts: Qualifications "MBBS, MD (General Medicine), DM (Cardiology)"; Experience "14 years"; Practises at "Deccan Heart and Lung Institute, Somajiguda"; Distance "2.5 km from you".
- Card "Consultation timings": "Monday to Saturday, 10:00 to 14:00" in semibold, and a grey notice "Published timings. Contact the hospital or clinic to confirm. CareRoute does not show live availability or book appointments."

Right column:
- Card "Contact" with a blue button "Call the hospital", the number "+91 40 4000 1302", a link "Official profile" with an external link icon, and the outbound links footnote.
- Footnote "Source: Apollo 24|7. Checked on 21 Oct 2026."
```

### 6. Medicine price comparison (Web)

```
Screen: Medicine prices, desktop.

Breadcrumb "Search > Paracetamol 650 mg". Title "Paracetamol 650 mg", subtitle "Tablet · Strip of 15 tablets".

Left raised card "Listed prices", line "Lowest ₹30.80 on MedPlus. Highest ₹33.50 on Apollo Pharmacy. Difference ₹2.70." Three price rows, cheapest first:
- MedPlus, green tag "Lowest listed", a thin blue bar, footnote "Listed price on MedPlus, checked 24 Oct 2026, 08:30. The price on the site may differ.", price "₹30.80" large on the right, link "Open on MedPlus" with an external icon.
- Tata 1mg, ₹31.90.
- Apollo Pharmacy, ₹33.50.
Footnote about outbound links.

Right card "Price by platform": an isometric 3D bar chart in blue with three bars labelled MedPlus, Tata 1mg, Apollo Pharmacy and values written above each bar. Footnote "CareRoute shows prices to compare. It does not recommend a medicine. Ask a doctor or pharmacist what is right for you."

No platform logos. No "best deal" badge.
```

### 7. Pharmacy and diagnostic centre detail (Web)

```
Screen: Diagnostic centre detail, desktop.

Breadcrumb "Search > Deccan Imaging Centre". Title "Deccan Imaging Centre".

Left: raised card with rating "4.6 (276 reviews)", tag "07:00 to 22:00", "Banjara Hills · 3.9 km away", and a 3D tilted map with the centre's marker (flask icon) highlighted. Card "Tests listed publicly" with blue tags MRI, CT scan, X-ray, Ultrasound, Mammography, and the footnote "Bookings and reports are handled by the centre, not by CareRoute."

Right: the Contact card (call button, address "Road No. 2, Banjara Hills, Hyderabad 500034", website, Get directions) and "Source: Apollo 24|7. Checked on 22 Oct 2026."

Make a second variant for a pharmacy, "Wellcare Pharmacy, Ameerpet", green tag "Open 24 hours", with a card "Before you go": "Call the store to check that your medicine is in stock. CareRoute does not see store stock or take orders."
```

### 8. Assistant (Web)

```
Screen: Assistant chat, desktop, content width about 840 px, sidebar "Assistant" selected.

Title "Assistant". Subtitle "Find the right kind of care. The assistant never diagnoses, prescribes or recommends a medicine." A blue info notice: "In the real product, your text is sent to an AI service to produce guidance, so do not enter names or phone numbers."

Conversation:
1. Assistant bubble (white card): "Describe what you need in your own words. I will suggest the kind of doctor to see and show care near you." with suggestion chips: "Itchy rash on my arm for a week", "Knee pain after a fall yesterday", "Where can I get an MRI near Banjara Hills?", "Compare prices for paracetamol 650".
2. User bubble (blue, right aligned): "Itchy rash on my arm for a week".
3. Assistant bubble: "From what you describe, a doctor in Dermatology may be a good place to start. This is a suggestion of where to look, not a diagnosis." A small "Doctors" list with "Dr. Farah Siddiqui, Dermatology · Eastside Community Hospital, 10.5 km", a "Hospitals" list with "Eastside Community Hospital, Dilsukhnagar". A grey disclaimer: "This is general information, not a diagnosis or a prescription. Talk to a qualified doctor about your health. In an emergency, call 112."
4. User bubble: "Sudden chest pain and sweating".
5. Assistant bubble with a red tinted notice: "This may be an emergency. What you describe can be a warning sign. Request an ambulance now, or call 112." and a red 3D pill "Request ambulance".

Sticky message composer at the bottom: a raised field "Describe the problem, for example: rash on my arm for a week" and a blue "Send" button.
```

### 9. Reports list (Web)

```
Screen: Medical reports, desktop, sidebar "Reports" selected.

Title "Medical reports". Subtitle "Keep lab reports, prescriptions and scans in one place, and get a plain-language explanation of any report."

Left card "Your reports (3)" with rows: "Complete blood count, Lab report · Clearpath Diagnostics · Uploaded 18 Oct 2026" with an orange tag "Values flagged by the report"; "Lipid profile, Uploaded 2 Sep 2026" with the same tag; "Chest X-ray report, Scan · Uploaded 12 Jul 2026".

Right: a dashed upload zone with a raised upload icon, "Upload a report", "PDF, JPEG or PNG. The file is private until you choose to share it.", and a button "Choose file". Below, a grey notice with a shield icon: "Only you can see your reports. Files are opened with short-lived links and are never public."
```

### 10. Report explanation (Web)

```
Screen: Report explanation, desktop.

Breadcrumb "Reports > Complete blood count". Title "Complete blood count". Subtitle "Lab report from Clearpath Diagnostics · Uploaded 18 Oct 2026".

Left column: a 3D stack of three paper pages in perspective, tilted, the front page showing the lab name, "Complete blood count", and value rows, with "Haemoglobin 11.2 g/dL" and "Mean corpuscular volume (MCV) 76 fL" highlighted in orange tint. Below, a card with File "cbc-oct-2026.pdf", Size "412 KB", a green status "Private. Only you can see this report.", and small buttons "Download" and "Delete" (red text).

Right column:
- Raised card "In plain words": "This is a complete blood count, a common test that counts the different cells in your blood. Most values are inside the ranges printed on the report. Two values, haemoglobin and MCV, are below the report's range, and the report marks them as low. Only a doctor who knows your history can say what this means for you."
- Table "Your values against the report's ranges" with columns Test, Your value, Range on report, Report says: Haemoglobin 11.2 g/dL, 12.0 to 15.5, orange "Low"; Total white cell count 7,800 cells/µL, 4,000 to 11,000, green "In range"; Platelet count 2.6 lakh/µL, 1.5 to 4.5, "In range"; MCV 76 fL, 80 to 100, "Low"; Red cell count 4.4 million/µL, 3.8 to 5.2, "In range".
- Card "Words on this report" with short definitions of Haemoglobin, MCV, Platelets, Reference range.
- Card "Questions you could ask your doctor" with three questions.
- Grey disclaimer: "This explanation is general information, not a diagnosis."
```

### 11. Medical ID and contacts (Web)

```
Screen: Medical ID and contacts, desktop, sidebar "Medical ID" selected.

Title "Medical ID and contacts". Subtitle "Keep these up to date. They are used only when you raise an SOS."

Left card "Medical ID": "Details that help an ambulance crew treat you quickly." Fields with labels above: Blood group dropdown "B+", Allergies "Penicillin" with hint "Separate allergies with commas.", Notes for the crew "Type 2 diabetes, takes metformin." A grey inset panel with an iOS style green switch "Share with the ambulance crew" and the sentence "On. The ambulance crew assigned to you can see your blood group, allergies and notes, only during an active emergency." Blue button "Save medical ID".

Right card "Emergency contacts": "They get an SMS with a tracking link when you raise an SOS. The SMS never includes health details." Rows "Lakshmi Kumar, Spouse · +91 98765 00011" and "Arun Kumar, Brother · +91 98765 00012", each with a "Remove" text button. A divider, then an add form: Name, Mobile number, Relation dropdown, and a secondary button "Add contact".
```

### 12. Emergency history (Web)

```
Screen: Emergency history, desktop.

Title "Emergency history". Subtitle "Your past ambulance requests, newest first." One card with two rows: "Accident or injury, Ameerpet · 3 Aug 2026 · BLS, TS 09 UB 2210 · Arrived in 9 min" with a green status "Completed" and "5 of 5" with a star; "Something else, Begumpet · 14 Mar 2026 · Not assigned" with a grey status "Cancelled".
```

### 13. Request an ambulance (Mobile)

```
Screen: Request an ambulance, phone, 375 px.

Title "Request an ambulance". Subtitle "Your location is filled in. Everything else is optional, and you can send the request at any point."

Red tinted notice with a phone icon: "If you can, also call 112. The request below goes to the nearest available ambulance on CareRoute."

Raised card "Pickup location": raised location icon, "Near Prakash Nagar Metro, Begumpet", "From your phone's location", and a "Change" text button.

Card with:
- "Who needs help?" segmented control: Me (selected), Someone else.
- "What happened?" three option cards stacked: "Heart or chest pain, Chest pain, pressure, or a racing heart"; "Accident or injury, Road accident, fall, burn or wound"; "Something else, Breathing trouble, fainting or anything else" (selected, blue outline and blue tint).
- "Is the person awake and responding?" segmented control: Yes (selected), No, Not sure.
- "Number of patients" stepper with minus, 1, plus.
- "Ambulance type" option cards: Nearest suitable (selected), Basic life support, Advanced life support, Intensive care, each with one short line.
- "Notes for the crew (optional)" text area.

Grey notice: "Your medical ID will be shared with the assigned crew during this request. Your 2 emergency contacts will get a tracking link by SMS."

Sticky at the bottom: a large red 3D key button "Request ambulance now" with the line "Sends your location to the nearest available ambulance".
```

### 14. Live emergency (Web and Mobile)

```
Screen: Your ambulance request, live, desktop. Make a phone version too.

Title "Your ambulance request", subtitle "Request em_2124 · Begumpet".

Raised status card: a blue dot status "En route", the sentence "The ambulance is on its way." in title size, "Updated 3 s ago" in grey, and on the right a large tabular "4" with "min" and the label "Arrives in about".

Left column:
- The 3D tilted map slab with a dark "You" marker, a blue upright ambulance marker on the road, and a blue route line between them. Small legend "You, Ambulance". Caption "Illustrative map, not to scale".
- Card "Care Thread": three raised round nodes joined by a line, solid blue between done steps and dashed toward the next: Patient "Waiting at Begumpet" (done), Ambulance "On the way, about 4 min away" (active, filled blue), Reports "None shared with the crew" (not reached).

Right column:
- Card "Your ambulance": Vehicle "TS 09 EA 4521", Type "Advanced life support", Driver "Suresh Babu", Operator "Deccan Ambulance Services", secondary button "Call the driver".
- Card "Family tracking": "Lakshmi and Arun got an SMS with a link to follow the ambulance. The link never shows health details." Buttons "Open family view" and "Share link".
- Card with a red button "Call 112", a red outline button "Cancel request", and "You can cancel until the patient is on board."
```

### 15. Family tracking (Mobile)

```
Screen: Family tracking page opened from an SMS link, phone, no sign in, no navigation.

A text button "Back" at the top left and a grey tag "Family view, no sign in". Title "Ambulance tracking". Subtitle "Shared with you by a family member. This page shows the ambulance only, never health details."

Raised status card: blue status "En route", "The ambulance is on its way.", "Updated 2 s ago", large "4 min".

The 3D tilted map with only the ambulance marker and route, caption "Illustrative map, not to scale. The pickup address is not shown."

Card with one Care Thread node: Ambulance, "TS 09 EA 4521 · Advanced life support".

Footnote "If you are worried, call 112."
```

---

## Driver screens

### 16. Offers (Web and Mobile)

```
Screen: Driver offers, desktop, role "Driver" selected in the sidebar, navigation "Offers and status" and "Current trip". Sidebar bottom card "Signed in as Suresh Babu, ALS, TS 09 EA 4521".

Title "Offers". Subtitle "Requests are offered to one ambulance at a time, nearest first."

Left narrow card "Your status": segmented control Available (selected), Offline, Busy; line "You receive offers for requests near you."; facts Vehicle "TS 09 EA 4521", Type "ALS", Operator "Deccan Ambulance Services", Last location sent "Secunderabad, 3 s ago".

Main raised card: blue status "New request", title "Heart or chest pain", "Pickup at Near Prakash Nagar Metro, Begumpet". On the right a raised white 3D disc with a blue progress ring and "27 seconds" in the centre. Facts: Distance "5.4 km, about 8 min by road", Requested type "Advanced life support", Awake and responding "Yes", Patients "1". The 3D tilted map with the route from the ambulance to the pickup. Two large buttons side by side: "Reject" (secondary) and "Accept" (blue). Footnote "If you reject or do not answer in 30 seconds, the request goes to the next nearest ambulance."
```

### 17. Current trip (Mobile)

```
Screen: Driver current trip, phone, used while driving, very large controls.

Title "Current trip". Raised card: blue status "En route", "Pickup at Near Prakash Nagar Metro, Begumpet" in title size, then one very large blue button about 72 px tall "Arrived at pickup" with the line "Tap when you reach the patient" under it.

The 3D tilted map with the ambulance marker on the route.

Card "About the patient": What happened "Heart or chest pain", Awake and responding "Yes", Patients "1", Raised by "The patient", secondary button "Call the patient".

Card "Medical ID" with a green tag "Shared by patient": Blood group "B+" large, Allergies "Penicillin" in red semibold, note "Type 2 diabetes, takes metformin.", footnote "Visible only while this trip is active."
```

---

## Admin screens

### 18. Overview (Web)

```
Screen: Admin overview, desktop, role "Admin" selected, navigation Overview (selected), Listings, Users. Sidebar bottom card "Signed in as Kavya Reddy, Platform admin".

Title "Overview". Subtitle "Sample figures for 24 Oct 2026. Hours are in Indian Standard Time."

Raised card with four plain figures in a row, number first and label below, no icon tiles: "3 Active emergencies", "18 Requests today", "1 min 42 s Average time to assign", "1 Failed matches today".

Card "Active emergencies" with the note "Requests with no ambulance are pinned to the top" and a table: Request, Area, What happened, Status, Since request, Ambulance. Rows: em_2117, Kukatpally, Accident or injury, red "No ambulance found", 6 min, None accepted; em_2119, Begumpet, Heart or chest pain, blue "En route", 4 min, ALS, TS 09 EA 4521; em_2120, Madhapur, Something else, blue "Matching", 1 min, Offer 2 of 5; em_2114, Dilsukhnagar, Accident or injury, green "Picked up", 22 min, BLS, TS 08 UA 7781. Footnote "Operational details only. Medical ID, reports and notes are never shown to admins."

Two cards side by side:
- "Time from request to arrival", "Average minutes, last 30 days, by hour of day", text button "Show table". An isometric 3D bar chart in blue for 06:00 to 22:00 every two hours with values 9.4, 12.1, 13.6, 11.2, 10.4, 12.8, 15.3, 13.1, 9.8 written on the bars; the 18:00 peak bar in orange.
- "Ambulances online", "5 online: 2 on a trip, 3 available", with the 3D tilted map showing five blue upright ambulance markers, one labelled "TS 09 EA 4521, on a trip".
```

### 19. Listings (Web)

```
Screen: Admin listings, desktop.

Title "Listings" with a blue button "Add listing" on the right. Subtitle "Healthcare information shown in search. Each listing keeps its source platform and the date it was last checked."

Segmented control: Hospitals (selected), Doctors, Pharmacies, Diagnostic centres, Medicine prices.

Orange notice: "1 listing was last checked more than 30 days ago."

Table: Name, Area, Source, Last checked, State, actions. Rows for the eight hospitals, for example "Lakeview Multispeciality Hospital, Begumpet, Apollo 24|7, 22 Oct 2026, green Shown in search, Edit, Hide" and "Golconda Spine and Joint Centre, Tolichowki, Apollo 24|7, 12 Sep 2026, orange Needs a check, Edit, Hide".
```

### 20. Users (Web)

```
Screen: Admin users, desktop.

Title "Users". Subtitle "Account details only. Medical ID, reports and emergency notes are never shown here."

Table: Name, Email, Role, Joined, State, action. Rows: Ravi Kumar, ravi.kumar@mail.example, Patient, 2 Jan 2026, green Active, red outline "Disable"; Suresh Babu, Driver, Active; Meena Joshi, Patient, Active; Imran Shaikh, Driver, grey Disabled, secondary "Enable"; Kavya Reddy, Admin, Active, "Managed by the owner"; Rohit Singh, Patient, Active.

Footnote "Driver and admin accounts are created by the platform owner. Only patients can sign up on their own."
```

---

## After generating

- Check every screen against the "Do NOT use" list in the brief. Stitch often adds gradients, purple accents or the Inter font; ask it to remove them.
- Check the text: no emoji, no em dashes, no invented claims such as "fastest" or "trusted by".
- Export to Figma or HTML from Stitch. Exported code is a reference only. The project builds with plain HTML, CSS and JavaScript unless the owner approves a framework (`docs/02-trd.md` section 1.2).
