import * as sql from 'mssql';
import { getDatabaseConfig, KEEPALIVE_INTERVAL, MAX_CONNECTION_RETRIES } from './config/database';

// Connection retry logic
let connectionAttempts = 0;

async function createConnectionPool(): Promise<sql.ConnectionPool> {
  const dbConfig = getDatabaseConfig();
  const pool = new sql.ConnectionPool(dbConfig);
  
  // Handle connection errors and implement retry logic
  pool.on('error', (err) => {
    console.error('❌ Database pool error:', err);
  });

  try {
    await pool.connect();
    console.log('✅ DB Connected successfully');
    connectionAttempts = 0; // Reset on successful connection
    
    // Set up keep-alive mechanism for Azure SQL Database
    setInterval(async () => {
      try {
        await pool.request().query('SELECT 1 as keepalive');
      } catch (error) {
        console.warn('Keep-alive query failed:', error);
      }
    }, KEEPALIVE_INTERVAL);
    
    return pool;
  } catch (err) {
    connectionAttempts++;
    console.error(`❌ DB Connection attempt ${connectionAttempts} failed:`, err);
    
    if (connectionAttempts < MAX_CONNECTION_RETRIES) {
      console.log(`🔄 Retrying connection in 5 seconds... (attempt ${connectionAttempts + 1}/${MAX_CONNECTION_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return createConnectionPool();
    } else {
      console.error('❌ All connection attempts failed');
      throw err;
    }
  }
}

// Helper function to get a healthy connection
export async function getHealthyConnection(): Promise<sql.ConnectionPool> {
  try {
    const poolInstance = await pool;
    
    // Test if connection is still healthy
    await poolInstance.request().query('SELECT 1 as healthcheck');
    return poolInstance;
  } catch (error) {
    console.warn('Connection health check failed, recreating pool:', error);
    // Create a new connection if the current one is unhealthy
    return createConnectionPool();
  }
}

export const pool = createConnectionPool();
