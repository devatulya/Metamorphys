const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const { processJobAsync } = require('../services/worker');

/**
 * POST /api/aois/:id/refresh
 * Trigger a new imagery ingestion & change-detection job for an AOI
 */
router.post('/aois/:id/refresh', async (req, res) => {
  try {
    const { id } = req.params;
    const aoiDoc = await db.collection('aois').doc(id).get();

    if (!aoiDoc.exists) {
      return res.status(404).json({ error: `AOI with ID "${id}" not found` });
    }

    const jobId = uuidv4();
    const now = new Date().toISOString();

    const jobData = {
      id: jobId,
      aoi_id: id,
      status: 'queued',
      created_at: now,
      completed_at: null,
      error: null
    };

    await db.collection('jobs').doc(jobId).set(jobData);

    // Trigger async job processing engine
    processJobAsync(jobId, id).catch((err) => {
      console.error(`[Worker] Unhandled error running job ${jobId}:`, err);
    });

    return res.status(202).json({
      job_id: jobId,
      aoi_id: id,
      status: 'queued',
      created_at: now,
      message: 'Change detection job enqueued successfully'
    });
  } catch (err) {
    console.error('Error triggering job refresh:', err);
    return res.status(500).json({ error: 'Failed to enqueue refresh job', details: err.message });
  }
});

/**
 * GET /api/jobs/:id
 * Poll job status
 */
router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const jobDoc = await db.collection('jobs').doc(id).get();

    if (!jobDoc.exists) {
      return res.status(404).json({ error: `Job with ID "${id}" not found` });
    }

    return res.json(jobDoc.data());
  } catch (err) {
    console.error('Error polling job status:', err);
    return res.status(500).json({ error: 'Failed to fetch job status', details: err.message });
  }
});

module.exports = router;
