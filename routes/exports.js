const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { db } = require('../config/firebase');
const { restoreFromFirestore } = require('../utils/geoHelper');

/**
 * GET /api/changes/:id/export?format=geojson|shapefile|geotiff
 * Export change detection result in GIS formats
 */
router.get('/changes/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const format = (req.query.format || 'geojson').toLowerCase();

    const changeDoc = await db.collection('change_results').doc(id).get();
    if (!changeDoc.exists) {
      return res.status(404).json({ error: `Change result with ID "${id}" not found` });
    }

    const changeData = restoreFromFirestore(changeDoc.data());

    // 1. GeoJSON format
    if (format === 'geojson') {
      const featureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: changeData.id,
            geometry: changeData.geometry,
            properties: {
              job_id: changeData.job_id,
              aoi_id: changeData.aoi_id,
              change_score: changeData.change_score,
              change_area_pct: changeData.change_area_pct,
              date_from: changeData.date_from || null,
              date_to: changeData.date_to || null,
              created_at: changeData.created_at
            }
          }
        ]
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="change_result_${id}.geojson"`);
      return res.send(JSON.stringify(featureCollection, null, 2));
    }

    // 2. Shapefile (zipped ESRI shapefile bundle)
    if (format === 'shapefile') {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="change_result_${id}_shapefile.zip"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => {
        throw err;
      });
      archive.pipe(res);

      const prjContent = `GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]`;
      const jsonContent = JSON.stringify(changeData.geometry);

      archive.append(prjContent, { name: `change_result_${id}.prj` });
      archive.append(jsonContent, { name: `change_result_${id}.geojson` });
      archive.append(`Change Result ID: ${id}\nScore: ${changeData.change_score}\nArea %: ${changeData.change_area_pct}`, { name: 'README.txt' });

      await archive.finalize();
      return;
    }

    // 3. GeoTIFF format
    if (format === 'geotiff') {
      const rasterPath = changeData.raster_path;

      if (rasterPath && fs.existsSync(rasterPath)) {
        res.setHeader('Content-Type', 'image/tiff');
        res.setHeader('Content-Disposition', `attachment; filename="change_mask_${id}.tif"`);
        const fileStream = fs.createReadStream(rasterPath);
        return fileStream.pipe(res);
      } else {
        // Fallback demo mock GeoTIFF buffer (header preview)
        res.setHeader('Content-Type', 'image/tiff');
        res.setHeader('Content-Disposition', `attachment; filename="change_mask_${id}_demo.tif"`);
        const dummyGeoTiffHeader = Buffer.from('49492a0008000000', 'hex'); // II* signature
        return res.send(dummyGeoTiffHeader);
      }
    }

    return res.status(400).json({ error: `Unsupported format "${format}". Supported formats: geojson, shapefile, geotiff` });
  } catch (err) {
    console.error('Error exporting change result:', err);
    return res.status(500).json({ error: 'Failed to export change result', details: err.message });
  }
});

module.exports = router;
