require('dotenv').config();
const express = require('express');
const cors = require('cors');

const aoisRouter = require('./routes/aois');
const jobsRouter = require('./routes/jobs');
const exportsRouter = require('./routes/exports');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Metamorphys PS14 Backend API Gateway',
    database: 'Firebase Firestore',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/aois', aoisRouter);
app.use('/api', jobsRouter);
app.use('/api', exportsRouter);

// Root Welcome Endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Metamorphys Change Detection API',
    version: '1.0.0',
    documentation: '/api/health',
    status: 'running'
  });
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

// Export app for testing or start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Metamorphys Backend Server running on port ${PORT}`);
    console.log(`👉 Health check: http://localhost:${PORT}/api/health`);
    console.log(`👉 AOI Endpoint: http://localhost:${PORT}/api/aois`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
