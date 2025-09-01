import { Router } from 'express';
import { getHealthyConnection } from '../db';

const router = Router();

/**
 * Basic health check endpoints for monitoring Azure SQL connectivity
 */

// Basic health check
router.get('/', async (_req, res) => {
  try {
    const db = await getHealthyConnection();
    const result = await db.request().query('SELECT GETDATE() AS server_time, @@VERSION AS version');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        serverTime: result.recordset[0].server_time,
        version: result.recordset[0].version
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Database connectivity check
router.get('/db', async (_req, res) => {
  try {
    const db = await getHealthyConnection();
    const result = await db.request().query(`
      SELECT 
        GETDATE() AS server_time,
        DB_NAME() AS database_name,
        @@SERVERNAME AS server_name,
        @@VERSION AS version
    `);
    
    res.json({
      status: 'connected',
      details: result.recordset[0]
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      status: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
