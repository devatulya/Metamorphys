require('dotenv').config();
const express = require('express');
const cors = require('cors');

const path = require('path');
const aoisRouter = require('./routes/aois');
const jobsRouter = require('./routes/jobs');
const exportsRouter = require('./routes/exports');
const { seedDemoDataIfNeeded } = require('./services/seeder');
const { db } = require('./config/firebase');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Metamorphys PS14 Backend API Gateway',
    database: 'Firebase Firestore',
    timestamp: new Date().toISOString()
  });
});

// GET /api/alerts - List all global system alerts
app.get('/api/alerts', async (req, res) => {
  try {
    const snapshot = await db.collection('alerts').get();
    const alerts = snapshot.docs.map((doc) => doc.data());
    return res.json({ count: alerts.length, alerts });
  } catch (err) {
    console.error('Error fetching global alerts:', err);
    return res.status(500).json({ error: 'Failed to fetch alerts', details: err.message });
  }
});

// API Routes
app.use('/api/aois', aoisRouter);
app.use('/api', jobsRouter);
app.use('/api', exportsRouter);

// Fallback to index.html for single page application UI
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Seed data & start server
if (require.main === module) {
  seedDemoDataIfNeeded().then(() => {
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Metamorphys WebGIS Application running on port ${PORT}`);
      console.log(`👉 WebGIS UI Dashboard: http://localhost:${PORT}`);
      console.log(`👉 Health check: http://localhost:${PORT}/api/health`);
      console.log(`👉 AOI Endpoint: http://localhost:${PORT}/api/aois`);
      console.log(`=======================================================`);
    });
  });
}

module.exports = app;

