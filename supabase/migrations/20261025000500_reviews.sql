-- CareRoute patient reviews (D-43, P-28). Shown next to the source platform's rating.
-- One review per patient per listing. Deleting the account deletes the reviews (D-45).

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  listing_kind text not null check (listing_kind in ('hospital', 'doctor', 'pharmacy', 'diagnostic_centre')),
  listing_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1000),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, listing_kind, listing_id)
);
create index reviews_listing_idx on public.reviews (listing_kind, listing_id, created_at desc) where status = 'visible';

create table public.review_reports (
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;
revoke all on public.reviews, public.review_reports from anon, authenticated;
