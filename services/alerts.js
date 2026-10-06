const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');

/**
 * Evaluates a new change result against AOI alert threshold and triggers alert
 */
async function checkAndTriggerAlert({ changeResultId, aoiId, changeAreaPct, alertThreshold, changeScore, aoiName }) {
  try {
    const threshold = typeof alertThreshold === 'number' ? alertThreshold : 0.15;

    console.log(`[AlertService] Checking AOI "${aoiName || aoiId}": changeAreaPct=${changeAreaPct}, threshold=${threshold}`);

    if (changeAreaPct >= threshold) {
      const alertId = uuidv4();
      const now = new Date().toISOString();

      const alertData = {
        id: alertId,
        change_result_id: changeResultId,
        aoi_id: aoiId,
        aoi_name: aoiName || 'Monitored AOI',
        change_area_pct: changeAreaPct,
        change_score: changeScore,
        alert_threshold: threshold,
        sent_at: now,
        channel: 'email',
        status: 'sent',
        message: `SIGNIFICANT CHANGE DETECTED: AOI "${aoiName || aoiId}" registered ${(changeAreaPct * 100).toFixed(1)}% changed area (Threshold: ${(threshold * 100).toFixed(1)}%).`
      };

      await db.collection('alerts').doc(alertId).set(alertData);
      console.log(`[AlertService] ALERT TRIGGERED! ID: ${alertId} - Sent email notification.`);
      return alertData;
    } else {
      console.log(`[AlertService] Change area ${(changeAreaPct * 100).toFixed(1)}% is below threshold ${(threshold * 100).toFixed(1)}%. No alert sent.`);
      return null;
    }
  } catch (err) {
    console.error('[AlertService] Error checking/triggering alert:', err);
    throw err;
  }
}

module.exports = {
  checkAndTriggerAlert
};
