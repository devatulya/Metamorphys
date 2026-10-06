const assert = require('assert');
const app = require('../server');
const http = require('http');

let server;
let baseUrl;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      headers: {}
    };

    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting API Test Suite for Metamorphys Backend...\n');

  try {
    // 1. Health check
    console.log('1️⃣  Testing GET /api/health');
    const health = await request('GET', '/api/health');
    assert.strictEqual(health.status, 200, 'Health endpoint should return 200');
    assert.strictEqual(health.body.status, 'ok', 'Health status should be ok');
    console.log('   ✅ Health check passed.');

    // 2. Validate invalid AOI (missing name)
    console.log('2️⃣  Testing POST /api/aois (validation failure test)');
    const badAoi = await request('POST', '/api/aois', {
      geometry: {
        type: 'Polygon',
        coordinates: [[[77.59, 12.97], [77.6, 12.97], [77.6, 12.98], [77.59, 12.98], [77.59, 12.97]]]
      }
    });
    assert.strictEqual(badAoi.status, 400, 'Missing name should return 400');
    console.log('   ✅ Input validation for missing name passed.');

    // 3. Create valid AOI
    console.log('3️⃣  Testing POST /api/aois (create valid AOI)');
    const validGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [77.59, 12.97],
          [77.60, 12.97],
          [77.60, 12.98],
          [77.59, 12.98],
          [77.59, 12.97]
        ]
      ]
    };

    const createRes = await request('POST', '/api/aois', {
      name: 'Test Sector Alpha',
      geometry: validGeometry,
      alert_threshold: 0.15
    });

    assert.strictEqual(createRes.status, 201, 'Valid AOI creation should return 201');
    assert.ok(createRes.body.id, 'Created AOI should have an ID');
    assert.strictEqual(createRes.body.name, 'Test Sector Alpha');
    assert.ok(createRes.body.area_sq_km > 0, 'Area should be calculated');
    const aoiId = createRes.body.id;
    console.log(`   ✅ AOI created successfully. ID: ${aoiId} (Area: ${createRes.body.area_sq_km} sq km)`);

    // 4. List AOIs
    console.log('4️⃣  Testing GET /api/aois');
    const listRes = await request('GET', '/api/aois');
    assert.strictEqual(listRes.status, 200);
    assert.ok(listRes.body.count >= 1);
    console.log(`   ✅ Listed ${listRes.body.count} AOI(s).`);

    // 5. Trigger Refresh Job
    console.log('5️⃣  Testing POST /api/aois/:id/refresh');
    const refreshRes = await request('POST', `/api/aois/${aoiId}/refresh`);
    assert.strictEqual(refreshRes.status, 202, 'Job refresh should return 202');
    assert.ok(refreshRes.body.job_id, 'Response should contain job_id');
    const jobId = refreshRes.body.job_id;
    console.log(`   ✅ Job enqueued. Job ID: ${jobId}`);

    // 6. Poll Job Status
    console.log('6️⃣  Polling GET /api/jobs/:id until done');
    let jobStatus = 'queued';
    let pollCount = 0;
    let jobData = null;

    while (jobStatus !== 'done' && pollCount < 10) {
      await new Promise((r) => setTimeout(r, 300));
      const pollRes = await request('GET', `/api/jobs/${jobId}`);
      assert.strictEqual(pollRes.status, 200);
      jobData = pollRes.body;
      jobStatus = jobData.status;
      pollCount++;
    }

    assert.strictEqual(jobStatus, 'done', 'Job should reach done status');
    assert.ok(jobData.change_result_id, 'Done job should reference change_result_id');
    const changeResultId = jobData.change_result_id;
    console.log(`   ✅ Job completed! Change Result ID: ${changeResultId}`);

    // 7. Get Change Results
    console.log('7️⃣  Testing GET /api/aois/:id/changes');
    const changesRes = await request('GET', `/api/aois/${aoiId}/changes`);
    assert.strictEqual(changesRes.status, 200);
    assert.strictEqual(changesRes.body.count, 1);
    assert.strictEqual(changesRes.body.changes[0].id, changeResultId);
    console.log(`   ✅ Verified change result record.`);

    // 8. Get Alerts
    console.log('8️⃣  Testing GET /api/aois/:id/alerts');
    const alertsRes = await request('GET', `/api/aois/${aoiId}/alerts`);
    assert.strictEqual(alertsRes.status, 200);
    assert.strictEqual(alertsRes.body.count, 1, 'Alert should be triggered because change % > 15%');
    console.log(`   ✅ Verified alert notification triggered: "${alertsRes.body.alerts[0].message}"`);

    // 9. Export GeoJSON
    console.log('9️⃣  Testing GET /api/changes/:id/export?format=geojson');
    const exportGeoJson = await request('GET', `/api/changes/${changeResultId}/export?format=geojson`);
    assert.strictEqual(exportGeoJson.status, 200);
    assert.strictEqual(exportGeoJson.body.type, 'FeatureCollection');
    console.log('   ✅ GeoJSON export verified.');

    // 10. Export Shapefile ZIP
    console.log('🔟 Testing GET /api/changes/:id/export?format=shapefile');
    const exportShp = await request('GET', `/api/changes/${changeResultId}/export?format=shapefile`);
    assert.strictEqual(exportShp.status, 200);
    assert.strictEqual(exportShp.headers['content-type'], 'application/zip');
    console.log('   ✅ Shapefile ZIP export verified.');

    // 11. Delete AOI
    console.log('1️⃣1️⃣ Testing DELETE /api/aois/:id');
    const deleteRes = await request('DELETE', `/api/aois/${aoiId}`);
    assert.strictEqual(deleteRes.status, 200);
    console.log('   ✅ AOI deleted.');

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🚀');
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
  }
}

// Start server on ephemeral port for tests
server = app.listen(0, () => {
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  runTests();
});
