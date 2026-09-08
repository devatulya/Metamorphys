# PS14 — Robust Change Detection, Monitoring & Alert System
## Product & Technical Requirements Document + Team Task Plan
### Bharatiya Antariksh Hackathon 2026 — Problem Statement 14

**Team roles**
| Role | Owner |
|---|---|
| Processing & Algorithms Lead | PK |
| Backend & Data Lead | Atulya |
| Frontend Lead | Saarthak |
| Alerts, Integration & Demo Lead | Rig |

---

## PART 1 — PRODUCT REQUIREMENTS DOCUMENT (PRD)

### 1.1 Background

Change detection on satellite imagery is a core geospatial analytics need — for monitoring
encroachment, deforestation, water body shrinkage, illegal construction, mining activity,
and infrastructure growth. Existing manual review is slow and doesn't scale. Automated
change detection struggles operationally because of:

- **Cloud/shadow occlusion** — imagery is often partially unusable
- **Atmospheric noise** — inconsistent radiometry across passes
- **Natural vs. anthropogenic ambiguity** — seasonal vegetation cycles, tidal flats, and
  natural erosion look like "change" to a naive differencing algorithm, but aren't the
  change a user cares about

PS14 asks for a platform that solves this operationally: a user draws an Area of Interest
(AOI), the system continuously (or on-demand) pulls Bhoonidhi multi-temporal imagery for
that AOI, runs it through a robust pipeline that filters out noise and seasonal effects,
and alerts the user only when something meaningfully changed.

### 1.2 Goals

1. Let a non-technical user define an AOI on a map and get change alerts without writing
   any code or understanding remote sensing.
2. Detect genuine anthropogenic change (construction, clearing, water-body change) while
   suppressing false positives from clouds, shadows, and seasonal vegetation cycles.
3. Deliver outputs in formats a GIS analyst can immediately use downstream (GeoJSON,
   Shapefile, GeoTIFF).
4. Be demoable end-to-end within the hackathon's judging window, on real Bhoonidhi data.

### 1.3 Non-goals (explicitly out of scope for the hackathon build)

- Real-time / continuous satellite tasking — we work with whatever historical +
  periodically-refreshed imagery Bhoonidhi already provides, not live acquisition.
- Multi-sensor fusion (SAR, hyperspectral) — R/G/NIR optical only, per the problem
  statement's dataset.
- Mobile native app — web-responsive is enough.
- User authentication / multi-tenant billing — a simple login (or even no-login demo
  mode) is acceptable for the hackathon; don't over-invest here.

### 1.4 Target users / personas

- **Government/municipal GIS officer** — monitors illegal construction or encroachment
  on public land parcels.
- **Environmental NGO analyst** — monitors deforestation or water body shrinkage in a
  protected area.
- **Disaster management cell** — monitors post-disaster changes (e.g., flood extent,
  landslide debris) in a region.

All three personas share the same core need: "tell me when *this specific patch of land*
changes in a way that matters, and give me a map I can act on."

### 1.5 User stories

1. As a GIS officer, I want to draw a polygon on a map so I can define exactly the area
   I want monitored.
2. As a GIS officer, I want to see a before/after comparison with the changed regions
   highlighted, so I can visually verify the detection.
3. As an NGO analyst, I want seasonal vegetation changes (e.g. monsoon greening) to be
   automatically filtered out, so I'm not flooded with false alerts.
4. As an NGO analyst, I want to receive an email when a significant change is detected
   in my AOI, so I don't have to keep checking the dashboard manually.
5. As a disaster management analyst, I want to download the detected change region as a
   Shapefile/GeoJSON, so I can bring it into QGIS for further analysis.
6. As any user, I want a time-series view of my AOI, so I can scrub through history and
   see when a change actually started.

### 1.6 Functional requirements

**FR1 — AOI management**
- User can draw a polygon/rectangle AOI on a map, name it, and save it.
- User can view, edit, and delete their saved AOIs.

**FR2 — Imagery ingestion**
- System fetches multi-temporal R/G/NIR imagery for a given AOI + date range from
  Bhoonidhi.
- System stores/caches fetched imagery to avoid redundant downloads.

**FR3 — Preprocessing**
- System detects and masks cloud and cloud-shadow pixels per scene.
- System flags scenes with cloud cover above a configurable threshold (e.g. >40%) as
  unusable for that date and skips them in the time series.

**FR4 — Change detection**
- System computes pixel-wise / object-wise change between consecutive usable scenes.
- System distinguishes anthropogenic change from seasonal/natural fluctuation using
  vegetation-index-aware filtering.
- System outputs a change mask (binary or intensity-scored) per AOI per time step.

**FR5 — Visualization**
- User can view detected changes as an overlay on the base map.
- User can scrub a time slider to see how the AOI evolved across available dates.

**FR6 — Alerting**
- System evaluates new change results against a significance threshold.
- System sends an email notification (and/or shows a dashboard badge) when a
  significant change is detected for an AOI.

**FR7 — Export**
- User can export a detected change region as GeoJSON, Shapefile, or GeoTIFF.

### 1.7 Non-functional requirements

- **Usability**: a first-time user should be able to draw an AOI and see a result within
  a few minutes, no GIS training required.
- **Reliability**: false-positive rate from seasonal/natural change should be visibly
  lower than naive image differencing (this is a judged criterion — be ready to show a
  before/after comparison against a naive baseline).
- **Performance**: processing a moderate AOI (~few km²) across a handful of dates should
  complete within a few minutes for the demo to feel responsive.
- **Portability**: the whole stack should be runnable locally / on a single demo server
  without exotic infrastructure, since hackathon judging often happens on a laptop or a
  single cloud VM.

### 1.8 Success metrics (for the demo / judging)

- End-to-end flow works live: draw AOI → see change map → get alert → export file.
- Visibly lower false-positive rate than naive differencing on at least one prepared
  "seasonal change" example (e.g., an agricultural field that greens/browns seasonally).
- At least one real example of correctly flagged anthropogenic change (e.g., new
  construction) shown with before/after imagery.

---

## PART 2 — TECHNICAL REQUIREMENTS DOCUMENT (TRD)

### 2.1 High-level architecture

```
[Bhoonidhi Imagery API/Portal]
        |
        v
[Processing Engine  (Python)]  <---- job queue ----  [API Gateway (Node.js)]
        |                                                     ^
        v                                                     |
[PostGIS + Object/Tile Storage]  ---------------------------->|
        |                                                     |
        +---------------------> [Web Client (Vue.js + OpenLayers)]
        |
        +---------------------> [Alert Service (email/dashboard)]
```

- **Processing engine (Python)** — owned by PK. Pulls imagery, masks clouds/shadows,
  runs change detection, writes results (raster + vector) to storage and PostGIS.
- **API gateway (Node.js)** — owned by Atulya. REST API for AOI CRUD, job
  triggering/status, results retrieval, export endpoints. Talks to PostGIS.
- **Data layer (PostgreSQL + PostGIS)** — owned by Atulya. Stores AOIs, job metadata,
  change-result vector geometries; references raster files stored on disk/object store.
- **Web client (Vue.js + OpenLayers)** — owned by Saarthak. AOI drawing, map
  visualization, time-series slider, export UI.
- **Alert service** — owned by Rig. Polls/reacts to new change results, applies a
  significance threshold, sends notifications.
- **Integration & demo environment** — owned by Rig. Deployment, seeding real demo
  AOIs/data, and the live demo script.

### 2.2 Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vue.js 3, OpenLayers, Bootstrap (or Tailwind) |
| API | Node.js (Express) |
| Processing | Python (rasterio, numpy, scikit-image / scikit-learn, GDAL) |
| Database | PostgreSQL + PostGIS |
| Job queue | Redis + a simple worker (RQ / BullMQ) — or, if time is short, a
  database-backed "jobs" table polled by a Python worker loop |
| Storage | Local filesystem or S3-compatible object storage for raster tiles/GeoTIFFs |
| Alerts | SMTP (e.g. via Nodemailer or Python smtplib) + a notifications table |

### 2.3 Data model (PostGIS schema)

```sql
-- Areas of Interest
CREATE TABLE aois (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    alert_threshold FLOAT DEFAULT 0.15   -- fraction of AOI area changed to trigger alert
);

-- Imagery scenes fetched for an AOI
CREATE TABLE scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aoi_id UUID REFERENCES aois(id),
    acquisition_date DATE NOT NULL,
    cloud_cover_pct FLOAT,
    usable BOOLEAN DEFAULT TRUE,
    raster_path TEXT NOT NULL,           -- path to preprocessed/masked GeoTIFF
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Change detection jobs
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aoi_id UUID REFERENCES aois(id),
    status TEXT DEFAULT 'queued',        -- queued | running | done | failed
    scene_from UUID REFERENCES scenes(id),
    scene_to UUID REFERENCES scenes(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Change detection results (vectorized)
CREATE TABLE change_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id),
    aoi_id UUID REFERENCES aois(id),
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,  -- vectorized change regions
    change_score FLOAT,                  -- 0-1 confidence/intensity
    change_area_pct FLOAT,               -- % of AOI area changed
    raster_path TEXT,                    -- change mask GeoTIFF, for reference
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts sent
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_result_id UUID REFERENCES change_results(id),
    aoi_id UUID REFERENCES aois(id),
    sent_at TIMESTAMPTZ DEFAULT now(),
    channel TEXT DEFAULT 'email'
);
```

### 2.4 API contract (Node.js REST endpoints)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/aois` | Create an AOI (body: name, geometry GeoJSON, alert_threshold) |
| GET | `/api/aois` | List all AOIs |
| GET | `/api/aois/:id` | Get one AOI + its scene/change history |
| DELETE | `/api/aois/:id` | Delete an AOI |
| POST | `/api/aois/:id/refresh` | Trigger a new ingestion + change-detection job for this AOI |
| GET | `/api/aois/:id/scenes` | List available imagery dates for this AOI |
| GET | `/api/aois/:id/changes` | List change results (with geometry, score, date range) |
| GET | `/api/changes/:id/export?format=geojson\|shapefile\|geotiff` | Export a single change result |
| GET | `/api/jobs/:id` | Poll job status |
| GET | `/api/aois/:id/alerts` | List alert history for an AOI |

**Example: POST /api/aois request body**
```json
{
  "name": "Riverbank Sector 7",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[77.59, 12.97], [77.60, 12.97], [77.60, 12.98], [77.59, 12.98], [77.59, 12.97]]]
  },
  "alert_threshold": 0.15
}
```

**Example: GET /api/aois/:id/changes response**
```json
{
  "aoi_id": "uuid",
  "changes": [
    {
      "id": "uuid",
      "date_from": "2026-01-15",
      "date_to": "2026-03-10",
      "change_score": 0.82,
      "change_area_pct": 0.23,
      "geometry": { "type": "MultiPolygon", "coordinates": [...] }
    }
  ]
}
```

This contract is the seam between PK's processing engine (writes results in this shape
into PostGIS), Atulya's API (serves it), and Saarthak's frontend (consumes it) — agree on
this early so everyone can build against it independently.

### 2.5 Processing pipeline detail (algorithm-level)

1. **Ingestion**: for a given AOI bounding box, query/download Bhoonidhi scenes covering
   that extent for the requested date range. Clip each scene to the AOI polygon (with a
   small buffer).
2. **Cloud/shadow masking**: compute per-pixel brightness and NIR/Red ratio; flag pixels
   above/below empirically-tuned thresholds as cloud or shadow. Compute % of AOI masked;
   if above threshold (e.g. 40%), mark scene `usable = false`.
3. **Co-registration check**: verify scenes align spatially (Bhoonidhi imagery should
   already be geo-referenced consistently, but do a sanity check / simple shift
   correction if needed).
4. **Change detection between scene pairs**:
   - Compute NDVI-like ratio `(NIR - Red) / (NIR + Red)` for each scene as a vegetation
     signal.
   - Compute simple band differencing / change vector magnitude between the two dates
     for R, G, NIR.
   - **Seasonal filtering**: where NDVI change is within a "plausible seasonal range"
     (tunable, e.g. derived from historical variance if multiple years of data are
     available, or a fixed band if not) AND spatial pattern looks diffuse/gradual
     (not a hard-edged new shape), suppress the change flag — this is what separates
     "the field turned green" from "a building appeared."
   - Threshold the remaining change-vector magnitude to produce a binary change mask.
5. **Vectorization**: convert the binary raster change mask into polygons (e.g. via
   `rasterio.features.shapes`), simplify geometry slightly, compute `change_area_pct`.
6. **Persist**: write change mask GeoTIFF to storage, write vector polygons + scores into
   `change_results` in PostGIS.
7. **Trigger alert check**: if `change_area_pct >= aoi.alert_threshold`, enqueue an alert.

### 2.6 Deployment plan

- Single demo VM (or all four laptops on the same network) running: PostgreSQL+PostGIS,
  Node API, Python worker, and the Vue dev server (or a built static bundle served by
  the API).
- Use Docker Compose to keep this reproducible and avoid "works on my machine" issues
  right before the demo — one `docker-compose up` should bring up DB + API + worker.
- Frontend can be built and served as static files by the same Node server to avoid
  CORS/dev-server flakiness during the live demo.

---

## PART 3 — DETAILED TASK BREAKDOWN PER TEAM MEMBER

## 3.1 PK — Processing & Algorithms Lead

**Mission**: build the pipeline that turns raw multi-temporal imagery into a trustworthy
change map. This is the technical heart of the project and the part judges will probe
hardest on "reliability."

**Environment setup**
- Python 3.10+, install `rasterio`, `numpy`, `scikit-image`, `scikit-learn`, `GDAL`
  bindings, `shapely`, `geopandas`.
- Get Bhoonidhi access set up early (https://bhoonidhi.nrsc.gov.in) — registration/access
  can take time, so this is priority zero, day one.

**Task 1 — Imagery access & sample dataset (Day 1, first few hours)**
- Register on Bhoonidhi, understand their data access method (direct download vs. API).
- Download 2-3 sample multi-temporal scene pairs over areas with *known* change (e.g. an
  area with visible new construction between two dates) and areas with *known* seasonal-
  only change (e.g. an agricultural field) — these become both dev data and demo data.
- Document band order, resolution, and any metadata quirks in a shared notes file.

**Task 2 — Cloud/shadow masking module (Day 1)**
- Write a function `mask_clouds_shadows(scene: np.ndarray) -> np.ndarray` that returns a
  boolean mask.
- Start with threshold-based: high brightness across R/G/NIR = cloud candidate; low
  brightness + spatial adjacency to a cloud = shadow candidate.
- Compute `%masked` per scene; expose a `usable_threshold` parameter.
- Unit-test against the sample scenes — visually inspect masked output as a quick PNG.

**Task 3 — Change detection core (Day 1-2)**
- Implement `compute_change(scene_a, scene_b) -> (change_mask, change_score)`.
- Start with straightforward band differencing / change vector magnitude.
- Add the NDVI-style vegetation index calculation as a separate signal.
- Implement the seasonal-suppression logic: combine "is the change diffuse/low-contrast
  and within plausible vegetation-index range" → suppress vs. "is it sharp-edged and high
  magnitude" → keep. Tune thresholds against your known seasonal vs. anthropogenic
  samples until you get a visibly cleaner result than naive differencing — **save both
  outputs (naive vs. filtered) since this comparison is your strongest demo/judging
  point.**

**Task 4 — Vectorization & output (Day 2)**
- Convert the final binary change mask to polygons (`rasterio.features.shapes` +
  `shapely`), simplify geometry, reproject to EPSG:4326 if needed.
- Compute `change_area_pct` = changed area / AOI area.
- Write a function that outputs: GeoTIFF change mask, GeoJSON polygons, and a summary
  dict (`change_score`, `change_area_pct`) — this is exactly the shape Atulya's API needs
  to write into `change_results`.

**Task 5 — Wrap as a callable job (Day 2)**
- Wrap the full pipeline (ingest clip → mask → detect → vectorize → save) as a single
  function/script that takes `(aoi_geometry, date_from, date_to)` and writes results to
  the agreed file paths / returns the agreed JSON shape — this is the integration point
  with Atulya's job queue.
- Coordinate directly with Atulya on the exact function signature and output file naming
  convention before building the queue wrapper.

**Task 6 — Validation & tuning (Day 2-3)**
- Run the full pipeline against all prepared sample AOIs.
- Tune thresholds until seasonal example shows near-zero flagged change and the
  construction example shows a clean, well-localized change polygon.
- Prepare a short before/after/change-mask image set for the demo slides.

**Dependencies**: needs Bhoonidhi access (blocking — start immediately) and the agreed
output contract from Atulya before wrapping as a job (Task 5).

---

## 3.2 Atulya — Backend & Data Lead

**Mission**: own the API, the database, and the job orchestration — the connective tissue
between PK's processing engine, Saarthak's frontend, and Rig's alert service.

**Environment setup**
- Node.js + Express project scaffold, PostgreSQL with PostGIS extension enabled locally
  (or via Docker: `postgis/postgis` image).
- Redis (or a simple DB-backed queue table) for job orchestration.

**Task 1 — Database schema (Day 1)**
- Create the PostGIS schema exactly as in TRD section 2.3 (`aois`, `scenes`, `jobs`,
  `change_results`, `alerts`).
- Set up migrations (e.g. with `node-pg-migrate` or a plain SQL migration folder) so the
  schema is reproducible for teammates.

**Task 2 — AOI CRUD endpoints (Day 1)**
- Implement `POST/GET/DELETE /api/aois` per the contract in TRD section 2.4.
- Validate incoming GeoJSON geometry (use `@turf/turf` for basic geometry validation:
  closed rings, reasonable vertex count).
- Store geometry using PostGIS `ST_GeomFromGeoJSON`.

**Task 3 — Job orchestration (Day 1-2)**
- Implement `POST /api/aois/:id/refresh`: creates a `jobs` row, enqueues a job (Redis
  queue or a simple `pending` row a worker polls), returns job id immediately.
- Write a small Python or Node worker loop that picks up pending jobs, calls PK's
  processing function (Task 5 in his list) with the AOI geometry + date range, and on
  completion writes results into `scenes` and `change_results`, updates job `status`.
- Implement `GET /api/jobs/:id` for polling status (used by frontend to show a spinner).

**Task 4 — Results & export endpoints (Day 2)**
- Implement `GET /api/aois/:id/changes` returning change history per the contract.
- Implement `GET /api/changes/:id/export?format=...`:
  - `geojson`: use PostGIS `ST_AsGeoJSON` directly.
  - `shapefile`: use `ogr2ogr` (via a shell-out) or `geopandas` to convert the stored
    GeoJSON/geometry to a zipped shapefile on the fly.
  - `geotiff`: stream the raster file PK's pipeline already wrote to disk.

**Task 5 — Alert trigger hook (Day 2)**
- After a job completes and `change_area_pct >= aoi.alert_threshold`, insert a row into
  a lightweight `pending_alerts` queue (or just call Rig's alert service's trigger
  endpoint directly) — coordinate the exact interface with Rig.

**Task 6 — API hardening & docs (Day 2-3)**
- Add basic error handling and input validation on every endpoint (empty AOI name,
  invalid geometry, missing job, etc.) — a crash mid-demo on a bad click is the easiest
  way to lose points on reliability.
- Write a one-page API reference (endpoints, request/response examples) for Saarthak and
  Rig to build against without needing to ask you every time.
- Set up CORS properly for local frontend dev.

**Dependencies**: needs PK's output contract (Task 5, his list) confirmed early;
Saarthak needs your API contract confirmed early too — this makes you the pivot point,
so prioritize locking the contract (TRD 2.4) on day one before deep implementation.

---

## 3.3 Saarthak — Frontend Lead

**Mission**: build the interface a non-technical user actually interacts with — AOI
drawing, map visualization, time-series exploration, and triggering exports.

**Environment setup**
- Vue 3 project (Vite scaffold), install OpenLayers (`ol`), a UI kit (Bootstrap-Vue or
  Tailwind), and an HTTP client (`axios`).

**Task 1 — Base map (Day 1)**
- Set up an OpenLayers map component centered on India (or a demo region), with a
  satellite/OSM base layer.
- Confirm you can render a GeoJSON layer on top (test with dummy polygon data before the
  backend is ready — don't block on Atulya).

**Task 2 — AOI drawing tool (Day 1)**
- Use OpenLayers' `Draw` interaction for polygon/rectangle drawing.
- On draw-complete, show a small form (AOI name, optional alert threshold) and POST to
  `/api/aois` (per the agreed contract).
- Build an AOI list panel (sidebar) that fetches `GET /api/aois` and lets the user select
  one to view/manage.

**Task 3 — Change visualization (Day 1-2)**
- On selecting an AOI, fetch `GET /api/aois/:id/changes` and render the returned
  MultiPolygon geometries as a colored overlay layer (color intensity mapped to
  `change_score`).
- Add a simple popup/tooltip on click showing `change_area_pct` and date range for that
  change result.

**Task 4 — Time-series slider (Day 2)**
- Fetch `GET /api/aois/:id/scenes` to get the list of available dates.
- Build a slider/timeline component; as the user scrubs, swap which change-result layer
  (or raw scene, if you want before/after toggling) is displayed.
- Add a simple "before/after" side-by-side or swipe comparison view if time allows — this
  is a strong visual for the demo.

**Task 5 — Job status & refresh trigger (Day 2)**
- Add a "Refresh / check for changes" button that calls
  `POST /api/aois/:id/refresh`, then polls `GET /api/jobs/:id` and shows a loading state
  until `status = done`, then re-fetches changes.

**Task 6 — Export UI (Day 2-3)**
- Add export buttons (GeoJSON / Shapefile / GeoTIFF) on a selected change result, hitting
  the export endpoint and triggering a file download.

**Task 7 — Polish & responsiveness (Day 3)**
- Make sure the UI doesn't break on a laptop-sized demo screen, add loading/error states
  everywhere (don't let a failed fetch silently show a blank map), and clean up styling.

**Dependencies**: can start Tasks 1-2 with dummy/mocked data immediately; needs Atulya's
real endpoints live for Tasks 3 onward — agree on the JSON contract (TRD 2.4) on day one
so you can build against a mock server in parallel rather than waiting.

---

## 3.4 Rig — Alerts, Integration & Demo Lead

**Mission**: close the loop with real alerting, own getting the whole system running
reliably in one place, and own making the live demo land.

**Task 1 — Alert service (Day 1-2)**
- Build a small service (Node or Python) that either:
  - polls `change_results`/`pending_alerts` for new significant changes, or
  - is called directly by Atulya's API hook (Task 5 in his list) — decide this interface
    together early.
- On a significant change, send an email via SMTP (e.g. a free Gmail app-password setup,
  or a service like SendGrid's free tier) with AOI name, change %, and a link back to the
  dashboard.
- Insert a row into the `alerts` table for history tracking.
- Add a simple "Alerts" panel in the frontend (coordinate with Saarthak) or just rely on
  email for the hackathon demo if time is short — email alone is enough to satisfy FR6.

**Task 2 — Environment & deployment (Day 1, ongoing)**
- Set up a `docker-compose.yml` covering PostGIS, the Node API, the Python worker, and
  (optionally) a static build of the frontend — so the whole team can run the exact same
  environment locally, and so there's one command to bring up the demo environment.
- Own the shared dev environment questions (env vars, ports, secrets like SMTP
  credentials) so the other three can focus on their layer.

**Task 3 — Integration testing (Day 2-3)**
- Once all four pieces exist, run the *actual* end-to-end flow yourself: draw AOI →
  refresh → wait for job → see change map → get email → export file. Log every rough
  edge and file it back to the relevant owner immediately rather than at the end.
- Specifically stress-test the seams: what happens if a job fails, if an AOI has no
  usable scenes, if the user double-clicks refresh — these are exactly the things that
  break live demos.

**Task 4 — Demo data preparation (Day 2)**
- Work with PK to pick 2-3 real AOIs with known outcomes for the demo: one with clear
  anthropogenic change (construction/deforestation), one seasonal-only (to show the
  false-positive suppression working), and one clean "no significant change" case.
- Pre-load these into the demo environment so you're not relying on live Bhoonidhi
  fetches (which can be slow/flaky) during actual judging.

**Task 5 — Demo script & pitch (Day 3)**
- Write a tight 3-5 minute demo script: problem framing (30s) → live AOI draw + refresh
  (60s) → show the seasonal-suppression comparison (60s) → show alert email + export
  (60s) → close on impact/scalability (30s).
- Build the pitch slides (problem, approach, architecture diagram, demo, impact).
- Do at least one full dry run with the team before judging, on the actual demo machine.

**Dependencies**: needs Atulya's alert-trigger interface agreed early (Task 1); needs
working pieces from everyone by Day 2-3 for integration testing — flag blockers to the
team immediately rather than waiting.

---

## PART 4 — SUGGESTED TIMELINE (assuming a ~3-day build window)

| Day | PK | Atulya | Saarthak | Rig |
|---|---|---|---|---|
| Day 1 | Bhoonidhi access + sample data, cloud/shadow masking | DB schema, AOI CRUD endpoints | Base map + AOI drawing (mock data) | Docker Compose env, alert service skeleton |
| Day 2 | Change detection core + seasonal filtering | Job orchestration, results/export endpoints | Change visualization, time-series slider | Alert wiring, start integration testing |
| Day 3 | Validation, tuning, demo image prep | API hardening, bugfixes from integration | Export UI, polish, bugfixes | Demo data, full dry run, pitch deck |

**Critical path**: PK's Bhoonidhi access (blocking everything real-data-related) and the
shared API contract (TRD 2.4, agree on this as a team in the first hour) are the two
things that most determine whether the rest of the timeline holds.

---

## PART 5 — RISKS & MITIGATIONS

| Risk | Mitigation |
|---|---|
| Bhoonidhi access/download is slow or rate-limited | PK downloads sample data day one; Rig pre-loads it into the demo env so live judging doesn't depend on live fetches |
| Change detection produces too many false positives | Keep the naive-diff-vs-filtered comparison ready — even an imperfect filter that clearly reduces noise is a strong demo point |
| Integration breaks late (contract mismatch) | Lock the API/data contract (TRD 2.4/2.3) as a team on Day 1 before deep implementation |
| Demo environment fails during judging | Docker Compose + a rehearsed dry run on the actual demo machine, with pre-loaded data as fallback |
| Team member gets blocked waiting on another's output | Everyone builds against the agreed contract with mock data first, integrates once real endpoints are ready |
