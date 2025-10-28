import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { initDriver, verifyConnection, closeDriver } from './services/neo4j/driver.js';
import sysmlRoutes from './routes/sysml.js';

const app = express();

// Middleware
app.use(cors(config.server.cors));
app.use(express.json());

// Routes
app.use('/api/sysml', sysmlRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    // Initialize Neo4j driver
    console.log('Initializing Neo4j driver...');
    initDriver();
    await verifyConnection();

    // Start Express server
    app.listen(config.server.port, () => {
      console.log(`✓ Server running on http://localhost:${config.server.port}`);
      console.log(`✓ API available at http://localhost:${config.server.port}/api/sysml`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await closeDriver();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await closeDriver();
  process.exit(0);
});

start();
