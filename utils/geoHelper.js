/**
 * Helper utility to sanitize GeoJSON objects for Cloud Firestore storage.
 * Cloud Firestore does not support storing multi-dimensional nested arrays (e.g. Polygon coordinates).
 * We serialize geometry to JSON string or clean object for Firestore, and deserialize it on read.
 */

function sanitizeForFirestore(data) {
  if (!data || typeof data !== 'object') return data;
  const clone = { ...data };

  if (clone.geometry && typeof clone.geometry === 'object') {
    clone.geometry_json = JSON.stringify(clone.geometry);
    delete clone.geometry;
  }
  return clone;
}

function restoreFromFirestore(data) {
  if (!data || typeof data !== 'object') return data;
  const clone = { ...data };

  if (clone.geometry_json && typeof clone.geometry_json === 'string') {
    try {
      clone.geometry = JSON.parse(clone.geometry_json);
      delete clone.geometry_json;
    } catch (e) {
      // ignore parse error if any
    }
  }
  return clone;
}

module.exports = {
  sanitizeForFirestore,
  restoreFromFirestore
};
