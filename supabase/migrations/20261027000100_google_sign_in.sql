-- Sign in with Google (D-63) and sign-up without a phone number (owner, 2026-10-27).
-- Additive: existing rows keep their phone and password, and old code still reads both columns.

-- The sign-up form asks for name, email and password only; the phone can be added later.
alter table public.users alter column phone drop not null;

-- A Google account has no CareRoute password until the patient sets one.
alter table public.users alter column password_hash drop not null;

-- Google's stable account id ("sub" in the ID token). Email can change at Google; this cannot.
alter table public.users add column google_sub text unique check (google_sub ~ '^[0-9A-Za-z_-]{1,255}$');

-- Every account still has a way to sign in.
alter table public.users add constraint users_has_sign_in check (password_hash is not null or google_sub is not null);
