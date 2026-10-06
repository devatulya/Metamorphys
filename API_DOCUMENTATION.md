# Metamorphys Backend API Documentation
**PS14 — Robust Change Detection, Monitoring & Alert System**
**Version**: 1.0.0  
**Lead**: Atulya (Backend & Data Lead)  
**Database**: Firebase Firestore  
**Geospatial Engine**: Turf.js (`@turf/turf`)

---

## 1. Overview
The Metamorphys REST API provides complete data management, GeoJSON validation, job execution, change detection retrieval, and multi-format spatial data export capabilities.

---

## 2. API Endpoints

### 2.1 AOI Management

#### `POST /api/aois` — Create AOI
Registers a new Area of Interest (AOI) with polygon boundary validation and automatic area computation.

**Request Headers**: `Content-Type: application/json`

**Request Body**:
```json
{
  "name": "Riverbank Sector 7",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [77.59, 12.97],
        [77.60, 12.97],
        [77.60, 12.98],
        [77.59, 12.98],
        [77.59, 12.97]
      ]
    ]
  },
  "alert_threshold": 0.15
}
```

**Response (`201 Created`)**:
```json
{
  "id": "c7a8e52a-9e6b-4b10-a20c-15a9b1c70e22",
  "name": "Riverbank Sector 7",
  "geometry": { ... },
  "area_sq_km": 1.2345,
  "alert_threshold": 0.15,
  "created_at": "2026-10-06T10:00:00.000Z",
  "updated_at": "2026-10-06T10:00:00.000Z"
}
```

---

#### `GET /api/aois` — List All AOIs
Returns all monitored AOIs.

**Response (`200 OK`)**:
```json
{
  "count": 1,
  "aois": [
    {
      "id": "c7a8e52a-9e6b-4b10-a20c-15a9b1c70e22",
      "name": "Riverbank Sector 7",
      "area_sq_km": 1.2345,
      "alert_threshold": 0.15,
      "created_at": "2026-10-06T10:00:00.000Z"
    }
  ]
}
```

---

#### `GET /api/aois/:id` — Get AOI Details
Fetches full details for a single AOI along with imagery scenes and change results history.

**Response (`200 OK`)**:
```json
{
  "id": "c7a8e52a-9e6b-4b10-a20c-15a9b1c70e22",
  "name": "Riverbank Sector 7",
  "geometry": { ... },
  "area_sq_km": 1.2345,
  "alert_threshold": 0.15,
  "scene_count": 2,
  "scenes": [ ... ],
  "change_count": 1,
  "changes": [ ... ]
}
```

---

#### `DELETE /api/aois/:id` — Delete AOI
Permanently deletes an AOI and cascades deletion to associated scenes, jobs, and change results.

**Response (`200 OK`)**:
```json
{
  "message": "AOI \"c7a8e52a-9e6b-4b10-a20c-15a9b1c70e22\" and all associated data deleted successfully"
}
```

---

### 2.2 Change Detection Jobs

#### `POST /api/aois/:id/refresh` — Trigger Change Detection Job
Enqueues an asynchronous change detection job for the specified AOI.

**Response (`202 Accepted`)**:
```json
{
  "job_id": "8f12a34b-91cd-4e56-8f90-123456789abc",
  "aoi_id": "c7a8e52a-9e6b-4b10-a20c-15a9b1c70e22",
  "status": "queued",
  "created_at": "2026-10-06T10:05:00.000Z",
  "message": "Change detection job enqueued successfully"
}
```

---

#### `GET /api/jobs/:id` — Poll Job Status
Polls the execution status of a change detection job.

**Response (`200 OK`)**:
```json
{
  "id": "8f12a34b-91cd-4e56-8f90-123456789abc",
  "aoi_id": "c7a8e52a-9e6b-4b10-a20c-15a9b1c70e22",
  "status": "done",
  "created_at": "2026-10-06T10:05:00.000Z",
  "completed_at": "2026-10-06T10:05:02.000Z",
  "change_result_id": "e9123456-789a-bcde-f012-34567890abcd"
}
```

---

### 2.3 Results & Export

#### `GET /api/aois/:id/changes` — List Change Results
Returns all change detection results recorded for an AOI.

**Response (`200 OK`)**:
```json
{
  "aoi_id": "c7a8e52a-9e6b-4b10-a20c-15a9b1c70e22",
  "count": 1,
  "changes": [
    {
      "id": "e9123456-789a-bcde-f012-34567890abcd",
      "job_id": "8f12a34b-91cd-4e56-8f90-123456789abc",
      "aoi_id": "c7a8e52a-9e6b-4b10-a20c-15a9b1c70e22",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "change_score": 0.84,
      "change_area_pct": 0.23,
      "date_from": "2026-01-15",
      "date_to": "2026-03-10",
      "created_at": "2026-10-06T10:05:02.000Z"
    }
  ]
}
```

---

#### `GET /api/changes/:id/export?format=geojson|shapefile|geotiff` — Export Change Result
Downloads change detection polygon or raster data in specified GIS formats.

- `format=geojson`: Downloads a `.geojson` FeatureCollection.
- `format=shapefile`: Downloads a `.zip` archive containing shapefile bundle files (`.prj`, `.geojson`, `README.txt`).
- `format=geotiff`: Streams the `.tif` change mask GeoTIFF raster file.

---

### 2.4 Alert History

#### `GET /api/aois/:id/alerts` — List Alerts
Returns alert notification history for an AOI.

**Response (`200 OK`)**:
```json
{
  "aoi_id": "c7a8e52a-9e6b-4b10-a20c-15a9b1c70e22",
  "count": 1,
  "alerts": [
    {
      "id": "alert-1234",
      "change_result_id": "e9123456-789a-bcde-f012-34567890abcd",
      "aoi_name": "Riverbank Sector 7",
      "change_area_pct": 0.23,
      "alert_threshold": 0.15,
      "sent_at": "2026-10-06T10:05:02.000Z",
      "status": "sent"
    }
  ]
}
```
