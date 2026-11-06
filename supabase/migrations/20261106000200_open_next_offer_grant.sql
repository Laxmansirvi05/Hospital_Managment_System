-- create_offers, decline_offer and expire_offers run with the caller's rights and call
-- open_next_offer, so the API role needs it too. Found on 2026-11-06: every SOS failed with 42501
-- once it reached matching, because the earlier SQL checks ran as the table owner.
grant execute on function public.open_next_offer(uuid) to careroute_api;
