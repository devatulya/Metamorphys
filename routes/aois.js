const express = require('express');
const router = express.Router();
const turf = require('@turf/turf');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Helper: Validate GeoJSON geometry with Turf
 */
function validateGeoJSON(geometry) {
  if (!geometry || typeof geometry !== 'object') {
    return { valid: false, error: 'Geometry must be a valid object' };
  }

  if (!['Polygon', 'MultiPolygon'].includes(geometry.type)) {
    return { valid: false, error: 'Geometry type must be Polygon or MultiPolygon' };
  }

  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    return { valid: false, error: 'Geometry coordinates cannot be empty' };
  }

  try {
    const feature = turf.feature(geometry);
    const isValid = turf.booleanValid(feature);
    if (!isValid) {
      return { valid: false, error: 'Self-intersecting or invalid GeoJSON polygon geometry' };
    }
    const areaSqMeters = turf.area(feature);
    const areaSqKm = parseFloat((areaSqMeters / 1e6).toFixed(4));
    return { valid: true, areaSqKm, feature };
  } catch (err) {
    return { valid: false, error: `Invalid GeoJSON structure: ${err.message}` };
  }
}

/**
 * POST /api/aois
 * Create a new Area of Interest (AOI)
 */
router.post('/', async (req, res) => {
  try {
    const { name, geometry, alert_threshold } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Field "name" is required and must be a non-empty string' });
    }

    const validation = validateGeoJSON(geometry);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const threshold = typeof alert_threshold === 'number' ? alert_threshold : 0.15;
    const aoiId = uuidv4();
    const now = new Date().toISOString();

    const aoiData = {
      id: aoiId,
      name: name.trim(),
      geometry,
      area_sq_km: validation.areaSqKm,
      alert_threshold: threshold,
      created_at: now,
      updated_at: now
    };

    await db.collection('aois').doc(aoiId).set(aoiData);

    return res.status(201).json(aoiData);
  } catch (err) {
    console.error('Error creating AOI:', err);
    return res.status(500).json({ error: 'Failed to create AOI', details: err.message });
  }
});

/**
 * GET /api/aois
 * List all saved AOIs
 */
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('aois').get();
    const aois = snapshot.docs.map((doc) => doc.data());
    return res.json({ count: aois.length, aois });
  } catch (err) {
    console.error('Error listing AOIs:', err);
    return res.status(500).json({ error: 'Failed to list AOIs', details: err.message });
  }
});

/**
 * GET /api/aois/:id
 * Get one AOI + scene and change history
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('aois').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: `AOI with ID "${id}" not found` });
    }

    const aoi = doc.data();

    // Fetch associated scenes
    const scenesSnap = await db.collection('scenes').where('aoi_id', '==', id).get();
    const scenes = scenesSnap.docs.map((d) => d.data());

    // Fetch associated change results
    const changesSnap = await db.collection('change_results').where('aoi_id', '==', id).get();
    const changes = changesSnap.docs.map((d) => d.data());

    return res.json({
      ...aoi,
      scene_count: scenes.length,
      scenes,
      change_count: changes.length,
      changes
    });
  } catch (err) {
    console.error('Error getting AOI:', err);
    return res.status(500).json({ error: 'Failed to get AOI details', details: err.message });
  }
});

/**
 * DELETE /api/aois/:id
 * Delete AOI and associated records
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('aois').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: `AOI with ID "${id}" not found` });
    }

    await db.collection('aois').doc(id).delete();

    // Cleanup scenes
    const scenesSnap = await db.collection('scenes').where('aoi_id', '==', id).get();
    for (const d of scenesSnap.docs) {
      await db.collection('scenes').doc(d.id).delete();
    }

    // Cleanup jobs
    const jobsSnap = await db.collection('jobs').where('aoi_id', '==', id).get();
    for (const d of jobsSnap.docs) {
      await db.collection('jobs').doc(d.id).delete();
    }

    // Cleanup change results
    const changesSnap = await db.collection('change_results').where('aoi_id', '==', id).get();
    for (const d of changesSnap.docs) {
      await db.collection('change_results').doc(d.id).delete();
    }

    return res.json({ message: `AOI "${id}" and all associated data deleted successfully` });
  } catch (err) {
    console.error('Error deleting AOI:', err);
    return res.status(500).json({ error: 'Failed to delete AOI', details: err.message });
  }
});

/**
 * GET /api/aois/:id/scenes
 * List imagery scenes for an AOI
 */
router.get('/:id/scenes', async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await db.collection('scenes').where('aoi_id', '==', id).get();
    const scenes = snapshot.docs.map((doc) => doc.data());
    return res.json({ aoi_id: id, count: scenes.length, scenes });
  } catch (err) {
    console.error('Error fetching scenes:', err);
    return res.status(500).json({ error: 'Failed to fetch scenes', details: err.message });
  }
});

/**
 * GET /api/aois/:id/changes
 * List change results for an AOI
 */
router.get('/:id/changes', async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await db.collection('change_results').where('aoi_id', '==', id).get();
    const changes = snapshot.docs.map((doc) => doc.data());
    return res.json({ aoi_id: id, count: changes.length, changes });
  } catch (err) {
    console.error('Error fetching change results:', err);
    return res.status(500).json({ error: 'Failed to fetch changes', details: err.message });
  }
});

/**
 * GET /api/aois/:id/alerts
 * List alert notifications for an AOI
 */
router.get('/:id/alerts', async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await db.collection('alerts').where('aoi_id', '==', id).get();
    const alerts = snapshot.docs.map((doc) => doc.data());
    return res.json({ aoi_id: id, count: alerts.length, alerts });
  } catch (err) {
    console.error('Error fetching alerts:', err);
    return res.status(500).json({ error: 'Failed to fetch alerts', details: err.message });
  }
});

module.exports = router;
