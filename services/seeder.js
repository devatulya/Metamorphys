const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

const demoAOIs = [
  {
    id: 'aoi-mine-alpha-001',
    name: 'Mine Site Alpha (Pit Sector 4)',
    alert_threshold: 0.10,
    area_sq_km: 1.482,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.5900, 12.9700],
          [77.6020, 12.9710],
          [77.6050, 12.9820],
          [77.5940, 12.9840],
          [77.5880, 12.9760],
          [77.5900, 12.9700]
        ]
      ]
    },
    created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'aoi-riverbank-007',
    name: 'Riverbank Sector 7 (Embankment)',
    alert_threshold: 0.15,
    area_sq_km: 0.945,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.6100, 12.9850],
          [77.6200, 12.9860],
          [77.6220, 12.9940],
          [77.6120, 12.9950],
          [77.6100, 12.9850]
        ]
      ]
    },
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'aoi-slope-sector-b',
    name: 'Slope Instability Zone B',
    alert_threshold: 0.12,
    area_sq_km: 2.120,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.5750, 12.9600],
          [77.5880, 12.9620],
          [77.5900, 12.9690],
          [77.5780, 12.9700],
          [77.5750, 12.9600]
        ]
      ]
    },
    created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'aoi-tailings-dam-04',
    name: 'Tailings Storage Facility #4',
    alert_threshold: 0.08,
    area_sq_km: 0.730,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.6250, 12.9650],
          [77.6320, 12.9660],
          [77.6340, 12.9730],
          [77.6260, 12.9720],
          [77.6250, 12.9650]
        ]
      ]
    },
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'aoi-coastal-subsidence',
    name: 'Coastal Aquifer Subsidence Belt',
    alert_threshold: 0.20,
    area_sq_km: 3.850,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.5600, 12.9800],
          [77.5720, 12.9820],
          [77.5740, 12.9980],
          [77.5620, 12.9990],
          [77.5600, 12.9800]
        ]
      ]
    },
    created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }
];

const demoAlerts = [
  {
    id: 'alert-101',
    aoi_id: 'aoi-mine-alpha-001',
    aoi_name: 'Mine Site Alpha (Pit Sector 4)',
    change_result_id: 'cr-mine-001',
    change_area_pct: 0.28,
    alert_threshold: 0.10,
    severity: 'critical',
    message: 'Critical Displacement Detected: 3.2 cm/yr subsidence in west bench wall.',
    sent_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    status: 'active'
  },
  {
    id: 'alert-102',
    aoi_id: 'aoi-riverbank-007',
    aoi_name: 'Riverbank Sector 7 (Embankment)',
    change_result_id: 'cr-river-001',
    change_area_pct: 0.19,
    alert_threshold: 0.15,
    severity: 'warning',
    message: 'High Soil Erosion & Slope Creep: 19% area movement above threshold.',
    sent_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    status: 'active'
  },
  {
    id: 'alert-103',
    aoi_id: 'aoi-tailings-dam-04',
    aoi_name: 'Tailings Storage Facility #4',
    change_result_id: 'cr-tailings-001',
    change_area_pct: 0.11,
    alert_threshold: 0.08,
    severity: 'critical',
    message: 'Dam Crest Elevation Shift: 0.11 fractional movement detected.',
    sent_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    status: 'active'
  }
];

const demoChanges = [
  {
    id: 'cr-mine-001',
    job_id: 'job-mine-001',
    aoi_id: 'aoi-mine-alpha-001',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.5930, 12.9730],
          [77.5990, 12.9740],
          [77.6010, 12.9790],
          [77.5950, 12.9800],
          [77.5930, 12.9730]
        ]
      ]
    },
    change_score: 0.89,
    change_area_pct: 0.28,
    max_displacement_cm_yr: -3.2,
    date_from: '2026-01-15',
    date_to: '2026-03-10',
    raster_path: '/storage/rasters/change_mask_mine_001.tif',
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString()
  },
  {
    id: 'cr-river-001',
    job_id: 'job-river-001',
    aoi_id: 'aoi-riverbank-007',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.6130, 12.9870],
          [77.6180, 12.9880],
          [77.6190, 12.9920],
          [77.6140, 12.9930],
          [77.6130, 12.9870]
        ]
      ]
    },
    change_score: 0.74,
    change_area_pct: 0.19,
    max_displacement_cm_yr: -1.8,
    date_from: '2026-01-20',
    date_to: '2026-03-12',
    raster_path: '/storage/rasters/change_mask_river_001.tif',
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString()
  },
  {
    id: 'cr-tailings-001',
    job_id: 'job-tailings-001',
    aoi_id: 'aoi-tailings-dam-04',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [77.6270, 12.9670],
          [77.6300, 12.9680],
          [77.6310, 12.9710],
          [77.6280, 12.9700],
          [77.6270, 12.9670]
        ]
      ]
    },
    change_score: 0.82,
    change_area_pct: 0.11,
    max_displacement_cm_yr: -2.4,
    date_from: '2026-02-01',
    date_to: '2026-03-15',
    raster_path: '/storage/rasters/change_mask_tailings_001.tif',
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  }
];

async function seedDemoDataIfNeeded() {
  try {
    const snap = await db.collection('aois').get();
    if (snap.docs && snap.docs.length > 0) {
      console.log(`[Seeder] Database already populated with ${snap.docs.length} AOIs.`);
      return;
    }

    console.log('[Seeder] Populating database with High-Fidelity WebGIS demo dataset...');

    for (const aoi of demoAOIs) {
      await db.collection('aois').doc(aoi.id).set(aoi);
    }

    for (const alert of demoAlerts) {
      await db.collection('alerts').doc(alert.id).set(alert);
    }

    for (const change of demoChanges) {
      await db.collection('change_results').doc(change.id).set(change);
    }

    console.log('[Seeder] Seed complete! 5 AOIs, 3 Alerts, 3 Change Results loaded.');
  } catch (err) {
    console.error('[Seeder] Error seeding demo data:', err);
  }
}

module.exports = {
  seedDemoDataIfNeeded
};
