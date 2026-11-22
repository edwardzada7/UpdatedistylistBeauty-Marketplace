-- Phase 34: structured locations (Lagos first, built to expand) + home-service range + currency columns. Safe to re-run.
CREATE TABLE IF NOT EXISTS public.service_areas (
  id BIGSERIAL PRIMARY KEY,
  country_code TEXT NOT NULL DEFAULT 'NG',
  region TEXT NOT NULL,            -- state / province
  city TEXT NOT NULL,
  name TEXT NOT NULL,              -- the area people pick, e.g. "Lekki Phase 1"
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (country_code, region, name)
);
CREATE INDEX IF NOT EXISTS idx_service_areas_lookup ON public.service_areas(country_code, region, active);
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_areas_read" ON public.service_areas;
CREATE POLICY "service_areas_read" ON public.service_areas FOR SELECT USING (true);

-- Where people are: one set of fields on users (providers are users too)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS area_id BIGINT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN';
CREATE INDEX IF NOT EXISTS idx_users_area ON public.users(area_id);

-- Home-service range (providers)
ALTER TABLE public.stylists ADD COLUMN IF NOT EXISTS travel_radius_km NUMERIC(6,1);
ALTER TABLE public.stylists ADD COLUMN IF NOT EXISTS travel_fee_per_km NUMERIC(10,2);

-- Currency on money records (everything is NGN today)
ALTER TABLE IF EXISTS public.bookings ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN';

INSERT INTO public.service_areas (country_code, region, city, name, latitude, longitude, aliases, sort_order) VALUES
('NG','Lagos','Lagos','Lekki Phase 1',6.4474,3.4723,'{lekki,lekki phase 1,lekki 1,lekki phase one,admiralty way,orchid road,lekki phase i}',1),
('NG','Lagos','Lagos','Victoria Island',6.4281,3.4219,'{vi,v.i,victoria island,ahmadu bello way,adeola odeku,ozumba mbadiwe,akin adesola}',2),
('NG','Lagos','Lagos','Ikoyi',6.4549,3.4344,'{ikoyi,bourdillon,awolowo road,banana island}',3),
('NG','Lagos','Lagos','Oniru',6.4310,3.4530,'{oniru,landmark}',4),
('NG','Lagos','Lagos','Osapa London',6.4420,3.5000,'{osapa,osapa london,agungi,ikate,elegushi}',5),
('NG','Lagos','Lagos','Chevron / Ikota',6.4390,3.5350,'{chevron,ikota,lekki phase 2,lekki 2,jakande}',6),
('NG','Lagos','Lagos','Ajah',6.4698,3.5852,'{ajah,abraham adesanya,badore,thomas estate}',7),
('NG','Lagos','Lagos','Sangotedo',6.4690,3.6420,'{sangotedo,lakowe,abijo}',8),
('NG','Lagos','Lagos','Lagos Island',6.4541,3.3947,'{lagos island,marina,idumota,obalende}',9),
('NG','Lagos','Lagos','Ikeja',6.6018,3.3515,'{ikeja,alausa,allen avenue,allen,oregun,opebi,adeniyi jones}',10),
('NG','Lagos','Lagos','Maryland',6.5720,3.3660,'{maryland,anthony,mende}',11),
('NG','Lagos','Lagos','Ogba',6.6280,3.3410,'{ogba,ikeja gra}',12),
('NG','Lagos','Lagos','Magodo',6.6200,3.3880,'{magodo,omole,isheri}',13),
('NG','Lagos','Lagos','Ojodu / Berger',6.6420,3.3590,'{ojodu,berger,ojodu berger}',14),
('NG','Lagos','Lagos','Yaba',6.5095,3.3711,'{yaba,akoka,sabo,ebute metta}',15),
('NG','Lagos','Lagos','Surulere',6.5010,3.3580,'{surulere,adeniran ogunsanya,bode thomas,ojuelegba}',16),
('NG','Lagos','Lagos','Gbagada',6.5540,3.3870,'{gbagada,soluyi,ifako}',17),
('NG','Lagos','Lagos','Ilupeju',6.5530,3.3560,'{ilupeju,palmgrove,palm grove}',18),
('NG','Lagos','Lagos','Ketu / Ojota',6.5900,3.3870,'{ketu,ojota,mile 12,alapere}',19),
('NG','Lagos','Lagos','Ikorodu',6.6190,3.5060,'{ikorodu}',20),
('NG','Lagos','Lagos','Apapa',6.4489,3.3590,'{apapa,ajegunle}',21),
('NG','Lagos','Lagos','Festac',6.4670,3.2830,'{festac,amuwo odofin,satellite town,ago palace}',22),
('NG','Lagos','Lagos','Isolo / Oshodi',6.5400,3.3300,'{isolo,oshodi,mushin,ejigbo,ikotun}',23),
('NG','Lagos','Lagos','Agege / Ipaja',6.6150,3.3000,'{agege,ipaja,alimosho,egbeda,iyana ipaja,dopemu}',24),
('NG','Lagos','Lagos','Ojo / Badagry',6.4640,3.1780,'{ojo,badagry,ibeju}',25),
('NG','Lagos','Lagos','Epe',6.5840,3.9830,'{epe}',26)
ON CONFLICT (country_code, region, name) DO NOTHING;
