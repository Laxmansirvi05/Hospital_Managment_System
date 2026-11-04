# API specification

Generated route inventory from the route arrays imported by `server/router.js` on 2026-11-04. The implementation in `server/routes/**` is authoritative. Every implemented method/path is listed once below. Base path: `/api/v1`. JSON requests use `Content-Type: application/json`; protected routes accept bearer access token or the first-party session cookie.

Roles: `public` means no login; `patient`, `driver`, and `admin` are the signed-in roles. `patient|driver|admin` means any signed-in role. Parameters shown with `:` are path parameters; route handlers validate UUID parameters unless named `token`.

Success responses below give exact top-level fields and the item schemas used by route view functions. Empty 204 responses have no body. A validation error is 422 `invalid_input`; missing auth is 401; role denial is 403; unmatched path is 404; method mismatch is 405. Routes absent from this inventory are not implemented.

## Implemented route inventory (68 routes)

| Method | Path | Role | Request fields | Success response fields |
| --- | --- | --- | --- | --- |
| GET | `/health` | public |  | 200 {status} |
| GET | `/config` | public |  | 200 {allow-listed public config fields, dataMode} |
| POST | `/auth/register` | public | Body: name, email, phone? (E.164 or 10 digit Indian mobile), password, role? (patient|driver|admin; defaults patient) | 201 {token,user{id,role,name}} |
| POST | `/auth/login` | public | Body: email, password | 200 {token,user{id,role,name}} |
| GET | `/auth/me` | patient|driver|admin |  | 200 {id,name,email,phone,role,createdAt,hasPassword,google} |
| POST | `/auth/refresh` | public |  | 200 {token,user{id,role,name}} |
| POST | `/auth/logout` | patient|driver|admin |  | 204 empty |
| GET | `/auth/google/start` | public | Query: next? (same-site path);  | 302 redirect; sets flow cookie |
| GET | `/auth/google/callback` | public |  | 302 redirect; sets or clears session cookies |
| POST | `/auth/password` | patient|driver|admin | Body: currentPassword? (Google-only accounts may omit), newPassword | 204 empty |
| POST | `/auth/sessions/revoke-others` | patient|driver|admin |  | 204 empty |
| POST | `/patients/me/delete-account` | patient | Body: password?, confirm="DELETE" | 204 empty; clears cookies |
| GET | `/patients/me/medical-id` | patient |  | 200 {fullName,phone,dateOfBirth,age,gender,preferredLanguage,address,bloodGroup,heightCm,weightKg,allergies,conditions,currentMedicines,pastSurgeries,disabilities,organDonor,medicalNotes,insurance,primaryDoctor,shareWithCrew,hasPhoto,completeness} |
| PUT | `/patients/me/medical-id` | patient | Body: Any subset of fullName, dateOfBirth, gender, preferredLanguage, address{line1,line2,landmark,area,city,pinCode}, bloodGroup, heightCm, weightKg, allergies[], conditions[], currentMedicines[], pastSurgeries[], disabilities[], organDonor, medicalNotes, insurance{provider,policyNumber}, primaryDoctor{name,phone}, shareWithCrew | 200 same medical-ID fields |
| GET | `/patients/me/contacts` | patient |  | 200 {contacts:[{id,name,phone,relation}]} |
| POST | `/patients/me/contacts` | patient | Body: name, phone, relation | 201 {id,name,phone,relation} |
| DELETE | `/patients/me/contacts/:id` | patient | Path params: id (UUID unless token);  | 204 empty |
| GET | `/patients/me/reminders` | patient |  | 200 {reminders:[{id,medicineName,dose,instructions,times,daysOfWeek,startDate,endDate,notes,active}]} |
| GET | `/patients/me/reminders/today` | patient | Query: date? (YYYY-MM-DD; defaults to today in Asia/Kolkata);  | 200 {date,doses:[{id,reminderId,date,time,status}]} |
| POST | `/patients/me/reminders` | patient | Body: medicineName, dose, times[], startDate; optional instructions, daysOfWeek[], endDate, notes, active | 201 reminder object |
| PATCH | `/patients/me/reminders/:id` | patient | Path params: id (UUID unless token); Body: Optional subset: medicineName, dose, instructions, times[], daysOfWeek[], startDate, endDate, notes, active | 200 reminder object |
| DELETE | `/patients/me/reminders/:id` | patient | Path params: id (UUID unless token);  | 204 empty |
| POST | `/patients/me/reminders/:id/doses` | patient | Path params: id (UUID unless token); Body: date, time, status (taken|skipped) | 200 dose record |
| GET | `/patients/me/appointments` | patient |  | 200 {appointments:[{id,doctorName,speciality,place,hospitalId,date,time,reason,notes,status}]} |
| POST | `/patients/me/appointments` | patient | Body: doctorName, place, date, time; optional speciality, hospitalId, reason, notes | 201 appointment object |
| PATCH | `/patients/me/appointments/:id` | patient | Path params: id (UUID unless token); Body: Optional subset: doctorName, speciality, place, date, time, reason, notes, status (scheduled|done|cancelled) | 200 appointment object |
| DELETE | `/patients/me/appointments/:id` | patient | Path params: id (UUID unless token);  | 204 empty |
| GET | `/patients/me/dashboard` | patient | Query: date? (YYYY-MM-DD; defaults to today in Asia/Kolkata);  | 200 {date,patient,today,appointments,documents,counts} |
| POST | `/patients/me/reports` | patient | Body: title, kind (lab|prescription|scan|discharge|insurance|other), fileName, contentType, sizeBytes | 201 {id,uploadUrl,method,contentType} |
| POST | `/patients/me/reports/:id/complete` | patient | Path params: id (UUID unless token);  | 200 {id,title,kind,fileName,contentType,sizeBytes,uploadedAt} |
| GET | `/patients/me/reports` | patient |  | 200 {reports:[file object]} |
| GET | `/patients/me/reports/:id/download` | patient | Path params: id (UUID unless token);  | 200 {url,expiresInSeconds} |
| DELETE | `/patients/me/reports/:id` | patient | Path params: id (UUID unless token);  | 204 empty |
| POST | `/patients/me/photo` | patient | Body: contentType (image/jpeg|image/png), sizeBytes | 201 {id,uploadUrl,method,contentType} |
| POST | `/patients/me/photo/:id/complete` | patient | Path params: id (UUID unless token);  | 200 {hasPhoto} |
| GET | `/patients/me/photo` | patient |  | 200 {url,expiresInSeconds} |
| DELETE | `/patients/me/photo` | patient |  | 204 empty |
| PUT | `/uploads/:token` | public | Path params: token (UUID unless token); Body: Raw bytes; Content-Type must match the upload record | 200 {ok}; raw response |
| GET | `/files/:token` | public | Path params: token (UUID unless token);  | 200 file bytes with stored Content-Type |
| GET | `/test-prices` | patient|driver|admin | Query: q?, area?, lat?, lng?, radiusKm?, limit? (1..50), offset? (0..5000), speciality?, specialization?, emergencyOnly?, open24?, test?, type?, chain?, category?, provider?, language?, group?, sort?;  | 200 {tests:[{name,provider,priceInr,centresOffering,url,checkedAt}],total} |
| GET | `/insights` | patient|driver|admin |  | 200 {totals,byType,byArea,bySpeciality,bySource,byChain,medicines,byMedicineGroup,commonTests,fees,points} |
| GET | `/map-locations` | patient|driver|admin |  | 200 {locations:[...]} |
| GET | `/areas` | patient|driver|admin |  | 200 {areas:[string]} |
| GET | `/areas/centroids` | patient|driver|admin |  | 200 {areas:[{name,places,lat,lng}]} |
| GET | `/hospitals/nearby` | patient|driver|admin | Query: lat, lng, radiusKm?, limit?, offset?, emergencyOnly?, speciality?, type?, area?, q?;  | 200 {hospitals:[hospital],total} |
| GET | `/hospitals` | patient|driver|admin | Query: q?, area?, lat?, lng?, radiusKm?, limit?, offset?, speciality?, type?, emergencyOnly?;  | 200 {hospitals:[hospital],total} |
| GET | `/hospitals/:id` | patient|driver|admin | Path params: id (UUID unless token);  | 200 hospital object |
| GET | `/hospitals/:id/doctors` | patient|driver|admin | Path params: id (UUID unless token); Query: specialization?;  | 200 {doctors:[doctor]} |
| GET | `/doctors` | patient|driver|admin | Query: q?, area?, lat?, lng?, radiusKm?, limit?, offset?, specialization?, language?, sort?;  | 200 {doctors:[doctor],total} |
| GET | `/doctors/:id` | patient|driver|admin | Path params: id (UUID unless token);  | 200 doctor object |
| GET | `/medicines` | patient|driver|admin | Query: q?, limit?, offset?, category?, provider?;  | 200 {medicines:[medicine],total} |
| GET | `/medicines/:id` | patient|driver|admin | Path params: id (UUID unless token);  | 200 medicine object |
| GET | `/pharmacies` | patient|driver|admin | Query: q?, area?, lat?, lng?, radiusKm?, limit?, offset?, open24?, chain?;  | 200 {pharmacies:[pharmacy],total} |
| GET | `/pharmacies/:id` | patient|driver|admin | Path params: id (UUID unless token);  | 200 pharmacy object |
| GET | `/diagnostic-centres` | patient|driver|admin | Query: q?, area?, lat?, lng?, radiusKm?, limit?, offset?, test?, category?;  | 200 {diagnosticCentres:[centre],total} |
| GET | `/diagnostic-centres/:id` | patient|driver|admin | Path params: id (UUID unless token);  | 200 diagnostic-centre object |
| GET | `/reviews` | patient|driver|admin | Query: kind, id (UUID);  | 200 {summary:{average,count},reviews:[{id,rating,body,author,updatedAt,mine}]} |
| PUT | `/reviews` | patient | Body: kind (hospital|doctor|pharmacy|diagnostic_centre), id, rating (1..5), body? | 200 {id,rating,body,author,updatedAt,mine} |
| DELETE | `/reviews/:id` | patient | Path params: id (UUID unless token);  | 204 empty |
| POST | `/reviews/:id/report` | patient | Path params: id (UUID unless token);  | 204 empty |
| POST | `/assistant/triage` | patient | Body: message (1..2000), age? (0..120), language? (en) | 200 {urgency,sosRecommended,suggestedSpecialty,advice,disclaimer} |
| GET | `/patients/me/assistant` | patient |  | 200 {consent,conversations,disclaimer} |
| PUT | `/patients/me/assistant/consent` | patient | Body: agree (boolean) | 200 {agreedAt} |
| POST | `/assistant/conversations` | patient | Body: text (1..2000), documentIds? (up to 3 UUIDs), near? {lat,lng} | 201 {conversation,messages} |
| GET | `/assistant/conversations/:id` | patient | Path params: id (UUID unless token);  | 200 {conversation,messages} |
| POST | `/assistant/conversations/:id/messages` | patient | Path params: id (UUID unless token); Body: text (1..2000), documentIds? (up to 3 UUIDs), near? {lat,lng} | 201 {messages} |
| DELETE | `/assistant/conversations/:id` | patient | Path params: id (UUID unless token);  | 204 empty |
| DELETE | `/assistant/conversations` | patient |  | 204 empty |

## Shared listing item fields

- Hospital: `id,name,area,address,location{lat,lng},phone,email,website,rating,ratingCount,source{platform,url,checkedAt},distanceKm?`, plus `facilityType,description,emergencyAvailable,specialities,departments` and optional image/logo fields.
- Doctor: `id,name,title,specialization,qualifications,experienceYears,publishedTimings,profileUrl,rating,ratingCount,photoUrl,languages,expertise,bookingUrl,consultationFeeInr,place{kind,id,name,area,address,phone,location{lat,lng}},source{platform,url,checkedAt},distanceKm?`.
- Pharmacy: hospital base fields plus `chain,hours,open24`. Diagnostic centre: hospital base fields plus `hours,description,testsListed`. Medicine: `id,name,form,pack,category,prescriptionRequired,listings[{platform,priceInr,productUrl,checkedAt}]`.
- Search list responses include `total` before paging. Common search query limits are `limit=1..50`, `offset=0..5000`; location requires both `lat` and `lng`. Only fields emitted by the route view functions are returned.

## Implemented but not in the older collection

The Postman collection now contains all 68 implemented routes, including patient reminders, appointments, reports, photos, discovery, reviews and saved assistant conversations. Google OAuth endpoints are browser redirects and require the configured test/deployment OAuth flow. Upload endpoints use one-time upload/download URLs; they cannot be fully exercised with an ordinary JSON request.

## Planned, not implemented

These designs appeared in earlier drafts but have no matching handler in `server/router.js`: ambulance registration/status/location; emergency creation, guest SOS, status, accept/reject, cancel, feedback, tracking and history; driver inbox; admin users/listings/analytics; separate assistant discovery or report-explanation endpoints; report sharing. They are **PLANNED** and are not present in Postman. The live SOS experience is demo-only.
