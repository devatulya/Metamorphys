const { v4: uuidv4 } = require('uuid');
const turf = require('@turf/turf');
const { db } = require('../config/firebase');
const { checkAndTriggerAlert } = require('./alerts');

/**
 * Asynchronous Change Detection Worker Loop
 */
async function processJobAsync(jobId, aoiId) {
  console.log(`[Worker] Starting job ${jobId} for AOI ${aoiId}...`);

  try {
    // 1. Set status to running
    await db.collection('jobs').doc(jobId).update({
      status: 'running',
      started_at: new Date().toISOString()
    });

    // 2. Fetch AOI details
    const aoiDoc = await db.collection('aois').doc(aoiId).get();
    if (!aoiDoc.exists) {
      throw new Error(`AOI ${aoiId} not found`);
    }

    const aoi = aoiDoc.data();
    const aoiGeom = aoi.geometry;

    // 3. Register Imagery Scenes (Before & After)
    const dateFrom = '2026-01-15';
    const dateTo = '2026-03-10';

    const sceneFromId = uuidv4();
    const sceneToId = uuidv4();

    const sceneFrom = {
      id: sceneFromId,
      aoi_id: aoiId,
      acquisition_date: dateFrom,
      cloud_cover_pct: 4.2,
      usable: true,
      raster_path: `/storage/rasters/aoi_${aoiId}_${dateFrom}.tif`,
      created_at: new Date().toISOString()
    };

    const sceneTo = {
      id: sceneToId,
      aoi_id: aoiId,
      acquisition_date: dateTo,
      cloud_cover_pct: 1.8,
      usable: true,
      raster_path: `/storage/rasters/aoi_${aoiId}_${dateTo}.tif`,
      created_at: new Date().toISOString()
    };

    await db.collection('scenes').doc(sceneFromId).set(sceneFrom);
    await db.collection('scenes').doc(sceneToId).set(sceneTo);

    // 4. Generate Change Result Geometry using Turf (Scaled polygon representing detected anthropogenic change)
    let changeGeom = aoiGeom;
    let changeAreaPct = 0.23; // Default 23% change area

    try {
      const feature = turf.feature(aoiGeom);
      // Scale feature down to simulate localized detected change polygon within AOI
      const scaledFeature = turf.transformScale(feature, 0.48);
      changeGeom = scaledFeature.geometry;

      const totalArea = turf.area(feature);
      const changedArea = turf.area(scaledFeature);

      if (totalArea > 0) {
        changeAreaPct = parseFloat((changedArea / totalArea).toFixed(4));
      }
    } catch (err) {
      console.warn('[Worker] Turf geometry transform warning, using default geometry:', err.message);
    }

    const changeResultId = uuidv4();
    const changeScore = 0.84; // 84% confidence

    const changeResult = {
      id: changeResultId,
      job_id: jobId,
      aoi_id: aoiId,
      geometry: changeGeom,
      change_score: changeScore,
      change_area_pct: changeAreaPct,
      date_from: dateFrom,
      date_to: dateTo,
      raster_path: `/storage/rasters/change_mask_${changeResultId}.tif`,
      created_at: new Date().toISOString()
    };

    await db.collection('change_results').doc(changeResultId).set(changeResult);

    // 5. Update Job Status to 'done'
    const completedAt = new Date().toISOString();
    await db.collection('jobs').doc(jobId).update({
      status: 'done',
      completed_at: completedAt,
      scene_from: sceneFromId,
      scene_to: sceneToId,
      change_result_id: changeResultId
    });

    console.log(`[Worker] Job ${jobId} completed successfully! Change area: ${(changeAreaPct * 100).toFixed(1)}%`);

    // 6. Check and Trigger Alerts
    await checkAndTriggerAlert({
      changeResultId,
      aoiId,
      changeAreaPct,
      alertThreshold: aoi.alert_threshold,
      changeScore,
      aoiName: aoi.name
    });
  } catch (err) {
    console.error(`[Worker] Job ${jobId} failed:`, err);
    await db.collection('jobs').doc(jobId).update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: err.message
    });
  }
}

module.exports = {
  processJobAsync
};
