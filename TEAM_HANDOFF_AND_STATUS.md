# Metamorphys — Team Status & Handoff Guide
> **Bharatiya Antariksh Hackathon 2026 — Problem Statement 14**
> **Current Status**: Backend & Data Layer Fully Completed & Verified Live ✅

---

## 👨‍💻 Part 1: What Atulya (Backend & Data Lead) Has Done

The backend API Gateway, database layer, job orchestration worker, GIS export handlers, and test suite are **100% built, tested live, and pushed to GitHub**.

### 📌 Git Branch
- **Branch**: [`feature/atulya-backend`](https://github.com/devatulya/Metamorphys/tree/feature/atulya-backend)
- **Status**: Committed & Pushed to Remote

### 🛠️ Key Technical Accomplishments
1. **Firebase Cloud Firestore Integration**:
   - Connected live to Cloud Firestore project `metamorphys-6efd5` via Admin SDK using `firebase-key.json`.
   - Built a high-performance in-memory fallback database engine in `config/firebase.js` so teammates can run and test offline without credentials.
   - Added GeoJSON geometry sanitizer/restorer (`utils/geoHelper.js`) to store multi-dimensional polygon coordinates seamlessly in Firestore documents.

2. **Geospatial Math via Turf.js (`@turf/turf`)**:
   - Automatic GeoJSON validation (`Polygon` / `MultiPolygon`, coordinate structure, closed rings).
   - Real-time area calculations (`area_sq_km`) for AOIs and change detection masks.

3. **REST API Endpoints Implemented & Verified**:
   | Method | Endpoint | Purpose |
   |---|---|---|
   | `GET` | `/api/health` | System health check & database connection status |
   | `POST` | `/api/aois` | Create an AOI (validates GeoJSON, computes area, saves to Firestore) |
   | `GET` | `/api/aois` | List all saved AOIs |
   | `GET` | `/api/aois/:id` | Get single AOI detail + scenes + change history |
   | `DELETE` | `/api/aois/:id` | Cascading deletion of AOI, jobs, scenes, change results |
   | `POST` | `/api/aois/:id/refresh` | Enqueue background change-detection job |
   | `GET` | `/api/jobs/:id` | Poll job execution status (`queued` ➔ `running` ➔ `done`) |
   | `GET` | `/api/aois/:id/scenes` | List imagery scenes for an AOI |
   | `GET` | `/api/aois/:id/changes` | List change detection results with vector geometries |
   | `GET` | `/api/changes/:id/export?format=...` | Export change results as **GeoJSON**, **Shapefile (.zip)**, or **GeoTIFF** |
   | `GET` | `/api/aois/:id/alerts` | Query alert notification history |

4. **Automated Test Suite**:
   - `npm test` runs 11 automated integration tests covering the complete lifecycle: AOI creation ➔ Job queuing ➔ Worker execution ➔ Alert trigger threshold ➔ GIS exports ➔ Cleanup.
   - **Result**: 11/11 tests passing live.

---

## 🚀 Part 2: Next Steps for Teammates

### 🛰️ PK — Processing & Algorithms Lead

**Your Goal**: Build the Python satellite imagery processing pipeline that turns raw multi-temporal imagery clips into vectorized change polygons.

1. **Pull the Backend Branch**:
   ```bash
   git checkout feature/atulya-backend
   git pull origin feature/atulya-backend
   ```
2. **Build Python Processing Modules (`pipeline/`)**:
   - `cloud_masking.py`: Threshold brightness & NIR/Red ratio to return cloud/shadow mask and usable % score.
   - `ndvi_change.py`: Compute NDVI `(NIR - Red) / (NIR + Red)`. Filter out diffuse/seasonal vegetation fluctuations while keeping sharp anthropogenic change boundaries (construction, clearing, water changes).
   - `vectorization.py`: Convert binary raster change mask to GeoJSON MultiPolygon via `rasterio.features.shapes` and compute `change_area_pct`.
3. **Connect to Worker Engine**:
   - Hook your Python entry point `process_change_detection(aoi_geojson, date_from, date_to)` into `services/worker.js`.

---

### 🎨 Saarthak — Frontend Lead

**Your Goal**: Build the interactive Vue 3 + OpenLayers web dashboard for AOI drawing, map visualization, time-series slider, and exports.

1. **Pull the Backend Branch**:
   ```bash
   git checkout feature/atulya-backend
   git pull origin feature/atulya-backend
   ```
2. **Firebase Client Config Ready**:
   - Use [config/firebase-config.json](file:///d:/Projects/Metamorphys/config/firebase-config.json) to configure your client-side Firebase connection.
3. **Build Frontend Components (`frontend/`)**:
   - **Base Map**: OpenLayers map centered on India with satellite tile base layer.
   - **AOI Drawing Tool**: Use OpenLayers `Draw` interaction for drawing polygons, posting to `POST /api/aois`.
   - **Sidebar & Change Layer**: Fetch `GET /api/aois` and render change result geometries (`GET /api/aois/:id/changes`) as colored vector overlays mapped to `change_score`.
   - **Time-Series Slider**: Scrub available scene dates fetched from `GET /api/aois/:id/scenes`.
   - **Job Refresh & Export Buttons**: Trigger `POST /api/aois/:id/refresh`, poll `GET /api/jobs/:id`, and trigger file downloads via `GET /api/changes/:id/export?format=geojson|shapefile|geotiff`.

---

### 🔔 Rig — Alerts, Integration & Demo Lead

**Your Goal**: Wire real email notification dispatching, set up containerized deployment, and prepare demo data.

1. **Pull the Backend Branch**:
   ```bash
   git checkout feature/atulya-backend
   git pull origin feature/atulya-backend
   ```
2. **Email Alert Wiring**:
   - Add Nodemailer / SMTP credentials (e.g. Gmail App Password) to `services/alerts.js` so real emails are dispatched when `change_area_pct >= alert_threshold`.
3. **Docker Compose Environment**:
   - Create `docker-compose.yml` to spin up the Node API server, background worker, and static frontend bundle with a single `docker-compose up`.
4. **Demo Data & Presentation**:
   - Pre-load 2-3 representative demo AOIs into Cloud Firestore (1 construction site, 1 seasonal agricultural field, 1 unchanged area).
   - Prepare the 3-minute demo script & slides.

---

## 💻 Quick Start Instructions for Team

```bash
# 1. Clone repository & switch to backend branch
git clone https://github.com/devatulya/Metamorphys.git
cd Metamorphys
git checkout feature/atulya-backend

# 2. Install dependencies
npm install

# 3. Run test suite
npm test

# 4. Start API server
npm start
```

*Server will run at `http://localhost:3000`.*
