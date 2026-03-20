# BorderPulse — Feature Parity Roadmap
# Goal: Match and beat border-times.com by being free + open source

## Current State
- 23 crossings (they have 41)
- Live wait times with SENTRI/Ready Lane/Standard/Commercial/Pedestrian
- Prediction system (needs data accumulation)
- Map view (Leaflet, dark tiles)
- Favorites (localStorage)
- Timezone-aware predictions
- Responsive desktop + mobile layout
- Deployed on Railway + Vercel

## Priority Legend
# P0 = must have to be competitive (users will leave without it)
# P1 = strong differentiator or major UX improvement
# P2 = nice to have, polish

---

## PHASE 1: Data completeness (P0)
These are table-stakes — users will bounce if their crossing isn't listed.

### 1.1 Add missing crossings to seed data
- FILES: backend/app/seed/ports.json
- DETAILS:
  Border Times covers 41 crossings. We have 23. Missing ones (all in CBP API):
  - TX: Progreso, Roma, Rio Grande City, Falcon Heights, Laredo Bridge II,
    Laredo Colombia Solidarity, Eagle Pass Bridge II, Tornillo/Marcelino Serna,
    Pharr, Anzalduas
  - AZ: Naco, Sasabe, San Luis II
  - NM: Columbus, Santa Teresa
  Cross-reference with CBP API response field `port_number` to get correct IDs.
  Each port needs: cbp_port_id, name_en, name_es, city_us, city_mx, state_us,
  state_mx, latitude, longitude, crossing_type, timezone.
  Use Google Maps to get lat/lng for each.
- DONE_WHEN: seed has 40+ ports, all ingesting data successfully

### 1.2 Add pedestrian ready_lane ingestion
- FILES: backend/app/seed/ports.json, backend/app/services/ingestion.py
- DETAILS:
  CBP API has `pedestrian_lanes.ready_lanes` as a separate sub-group.
  Currently we only ingest `pedestrian_lanes.standard_lanes`.
  Add a new lane type `pedestrian_ready` and map it in ingestion.
  Border Times shows pedestrian Ready Lane separately.
- DONE_WHEN: pedestrian ready lane data appears in crossing detail

---

## PHASE 2: Crossing detail enrichment (P0)

### 2.1 Weather widget on crossing detail page
- FILES: frontend/src/app/crossing/[id]/page.tsx, frontend/src/lib/api.ts
- DETAILS:
  Border Times shows current weather (icon + temp) on each crossing page.
  Use Open-Meteo API (free, no key needed):
  `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,weather_code`
  Fetch client-side from the frontend (simplest, no backend change).
  Create a small WeatherWidget component that takes lat/lng and fetches on mount.
  Map weather_code to icon + description (WMO weather codes).
- DONE_WHEN: crossing detail shows current temp + weather icon

### 2.2 USD/MXN exchange rate widget
- FILES: frontend/src/components/ExchangeRate.tsx (new),
  frontend/src/app/crossing/[id]/page.tsx
- DETAILS:
  Border Times shows current USD/MXN rate with 7-day sparkline.
  Use frankfurter.app (free, no key):
  Latest: `https://api.frankfurter.app/latest?from=USD&to=MXN`
  History: `https://api.frankfurter.app/2026-03-12..2026-03-19?from=USD&to=MXN`
  Build a small component with a Recharts sparkline.
  Fetch client-side, cache in localStorage for 1 hour.
- DONE_WHEN: crossing detail shows USD/MXN rate with mini chart

### 2.3 Crossing volume stats
- FILES: backend/app/seed/ports.json,
  frontend/src/components/CrossingCard.tsx,
  frontend/src/app/crossing/[id]/page.tsx
- DETAILS:
  Border Times shows "88K/day" and "~1.3M" annual crossings per port.
  Source: Bureau of Transportation Statistics (BTS)
  https://data.bts.gov/stories/s/Border-Crossing-Entry-Data/jswi-2e7b/
  This is static reference data. Add `daily_crossings` and `annual_crossings`
  to seed JSON. Show on card and detail page as a badge.
- DONE_WHEN: cards show "Xk/day" badge, detail page shows annual volume

### 2.4 Recent trend indicator (last 2-3 hours)
- [ ] **Implement trend computation (rising/falling/stable) from recent observations**
- FILES: backend/app/api/crossings.py,
  frontend/src/components/CrossingCard.tsx
- DETAILS:
  We already have `trend` field in CrossingSummary (rising/falling/stable).
  The `compute_trend()` function exists in crossings.py but is never called.
  To activate: in list_crossings(), after building lane_waits, query the last
  3 hours of observations for that port's primary lane and call compute_trend().
  Also: on the detail page, show a mini sparkline of the last 3 hours of
  observations (data already available in recentHistory).
- DONE_WHEN: cards show rising/falling/stable trend, detail page has recent history sparkline

---

## PHASE 3: Traffic analysis (P1)
This is their marquee feature. Building it open-source is the differentiator.

### 3.1 Mapbox GL JS integration
- FILES: frontend/src/components/TrafficMap.tsx (new),
  frontend/src/app/crossing/[id]/traffic/page.tsx (new)
- DETAILS:
  Install mapbox-gl: `npm install mapbox-gl`
  Create a new page at /crossing/[id]/traffic.
  Use Mapbox GL JS with `mapbox-traffic-v1` tileset for live road colors.
  Center map on the crossing's lat/lng at zoom ~14.
  Free tier: 50k map loads/month, 100k directions requests/month.
  Need NEXT_PUBLIC_MAPBOX_TOKEN env var.
  Dynamic import to avoid SSR issues (same pattern as Leaflet).
- DONE_WHEN: /crossing/[id]/traffic shows a Mapbox map with traffic colors

### 3.2 Route visualization with congestion
- STATUS: not started (depends on 3.1)
- FILES: frontend/src/components/TrafficMap.tsx,
  backend/app/seed/ports.json (add approach coordinates)
- DETAILS:
  Use Mapbox Directions API to draw the approach route from Mexico side to port.
  API: `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/{coords}`
  Returns route geometry + per-leg congestion annotations.
  Draw the route on the map color-coded by congestion (green/yellow/red).
  Need to add two fields per port in seed data:
  - approach_mx: [lat, lng] ~2km south of port on Mexican side
  - approach_us: [lat, lng] ~1km north on US side
  Add a MX->US / US->MX toggle to switch approach direction.
- DONE_WHEN: traffic page shows color-coded route with congestion levels

### 3.3 Estimated crossing time
- FILES: frontend/src/app/crossing/[id]/traffic/page.tsx
- DETAILS:
  Combine: Mapbox drive time (approach) + CBP wait time = total estimated time.
  Show as a prominent number: "~45 min (15 min drive + 30 min wait)"
  Drive time from Directions API `duration_in_traffic`.
  Wait time from our existing API.
- DONE_WHEN: traffic page shows combined estimate with breakdown

### 3.4 Link traffic page from crossing detail and cards
- FILES: frontend/src/app/crossing/[id]/page.tsx,
  frontend/src/components/CrossingCard.tsx
- DETAILS:
  Add "Traffic Analysis" link on crossing detail page.
  On cards, show a small traffic indicator linking to the traffic page.
- DONE_WHEN: users can navigate to traffic page from crossing detail

---

## PHASE 4: Content & SEO (P1)
This is how Border Times ranks in Google. Critical for organic growth.

### 4.1 Crossing guide pages
- FILES: frontend/src/app/crossing/[id]/guide/page.tsx (new),
  content/guides/*.md (new, one per crossing)
- DETAILS:
  Static content pages per crossing with:
  - Best times to cross (by day of week and hour)
  - Required documentation (US citizens, residents, visitors, vehicles)
  - Parking options (US side, Mexico side, with prices)
  - Pedestrian crossing info
  - Local tips and tricks
  Start with top 5 busiest: San Ysidro, Otay Mesa, Calexico West, El Paso
  BOTA, Laredo Gateway. Expand later.
  Use next-mdx-remote or @next/mdx to render markdown.
  Must be server-rendered for SEO.
- DONE_WHEN: /crossing/[id]/guide renders useful guide for top 5 crossings

### 4.2 Holiday/event awareness banners
- FILES: frontend/src/lib/holidays.ts (new),
  frontend/src/components/HolidayBanner.tsx (new),
  frontend/src/app/crossing/[id]/page.tsx
- DETAILS:
  JSON mapping of date ranges to events:
  Spring Break, Semana Santa, Memorial Day, July 4th, Labor Day,
  Dia de los Muertos, Thanksgiving, Christmas/New Year.
  Show banner on crossing detail and home page during active periods.
  Frontend-only — no backend needed.
- DONE_WHEN: holiday banners appear during active holiday periods

### 4.3 SEO meta tags and server rendering for crossing pages
- FILES: frontend/src/app/crossing/[id]/layout.tsx (new),
  frontend/src/app/crossing/[id]/page.tsx
- DETAILS:
  Convert crossing detail to use Next.js generateMetadata().
  Title: "San Ysidro Border Wait Times - Live | BorderPulse"
  Description: "Current wait times for San Ysidro. Standard: X min, SENTRI: Y min..."
  Fetch crossing name server-side for meta tags.
  Add JSON-LD structured data for rich search results.
- DONE_WHEN: view-source shows crossing name in <title>

### 4.4 Sitemap and robots.txt
- FILES: frontend/public/robots.txt (new),
  frontend/src/app/sitemap.ts (new, dynamic Next.js sitemap)
- DETAILS:
  Generate sitemap dynamically from the list of crossings.
  Include: /, /map, /settings, /crossing/[id] for each port,
  /crossing/[id]/guide for each guide that exists.
  robots.txt: allow all, point to sitemap.
- DONE_WHEN: /sitemap.xml lists all crossing pages

---

## PHASE 5: Spanish translation (P1)

### 5.1 i18n with next-intl
- [ ] **Implement full Spanish translation**
- FILES: frontend/src/middleware.ts (new), frontend/src/i18n/ (rebuild),
  all page and component files
- DETAILS:
  Use next-intl with App Router.
  /en and /es route prefixes. Default to /en.
  Start with UI chrome (nav, buttons, labels).
  Crossing names already have name_es in DB.
  Guide content will need separate .es.md files.
  This is a large change — touches every component.
- DONE_WHEN: /es/ shows full Spanish UI

---

## PHASE 6: Notices and alerts (P2)

### 6.1 CBP construction notices
- FILES: backend/app/services/ingestion.py, backend/app/schemas/crossing.py,
  frontend/src/app/crossing/[id]/page.tsx
- DETAILS:
  CBP API includes `construction_notice` field per port. Currently ignored.
  Parse during ingestion, cache in Redis, surface on crossing detail page.
- DONE_WHEN: construction notices from CBP appear on affected crossings

### 6.2 Web push notifications
- [ ] **Push notifications when wait drops below threshold**
- FILES: frontend/public/sw.js (new), backend/app/services/alerts.py (new)
- DETAILS:
  Web Push API for browser notifications.
  User subscribes to crossing + threshold ("notify when < 30 min").
  Requires service worker, VAPID keys, backend threshold check after ingestion.
  Defer until there are active users.
- DONE_WHEN: users receive browser push when wait drops below threshold
