-- Synthetic demo crews (D-72, D-78). Every row is flagged is_demo, has no driver account, and the
-- server moves them. Registration numbers are obviously fake. Remove them all with:
--   delete from public.ambulances where is_demo;
insert into public.ambulances (registration_number, type, status, operator_name, driver_name, is_demo, location, heading_degrees, speed_kmph, last_ping_at)
select v.reg, v.type::public.ambulance_type, 'available', 'CareRoute Demo Crew', v.crew, true,
       extensions.st_setsrid(extensions.st_makepoint(v.lng, v.lat), 4326)::extensions.geography, 0, 0, now()
from (values
  ('DEMO-0001', 'BLS', 'Demo crew Begumpet',      17.4435, 78.4676),
  ('DEMO-0002', 'ALS', 'Demo crew Secunderabad',  17.4399, 78.4983),
  ('DEMO-0003', 'ICU', 'Demo crew Banjara Hills', 17.4156, 78.4347),
  ('DEMO-0004', 'BLS', 'Demo crew Jubilee Hills', 17.4326, 78.4071),
  ('DEMO-0005', 'ALS', 'Demo crew HITEC City',    17.4435, 78.3772),
  ('DEMO-0006', 'BLS', 'Demo crew Gachibowli',    17.4401, 78.3489),
  ('DEMO-0007', 'BLS', 'Demo crew Kukatpally',    17.4948, 78.3996),
  ('DEMO-0008', 'ALS', 'Demo crew Ameerpet',      17.4375, 78.4482),
  ('DEMO-0009', 'BLS', 'Demo crew Dilsukhnagar',  17.3688, 78.5247),
  ('DEMO-0010', 'ICU', 'Demo crew LB Nagar',      17.3457, 78.5522),
  ('DEMO-0011', 'BLS', 'Demo crew Charminar',     17.3616, 78.4747),
  ('DEMO-0012', 'ALS', 'Demo crew Uppal',         17.4058, 78.5591)
) as v(reg, type, crew, lat, lng)
on conflict (registration_number) do nothing;
