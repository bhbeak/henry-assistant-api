// src/config/database.ts
import { config as SqlConfig } from 'mssql';

/**
 * Database configuration optimized for Azure SQL Database
 * Includes connection pooling, timeouts, and retry settings
 */
export function getDatabaseConfig(): SqlConfig {
  const {
    DB_SERVER,
    DB_DATABASE,
    DB_USER,
    DB_PASSWORD,
    DB_ENCRYPT,
    // Optional environment variables for fine-tuning
    DB_POOL_MAX = '10',
    DB_POOL_MIN = '2',
    DB_CONNECT_TIMEOUT = '60000',
    DB_REQUEST_TIMEOUT = '60000',
    DB_IDLE_TIMEOUT = '900000', // 15 minutes
    DB_KEEPALIVE_INTERVAL = '240000' // 4 minutes
  } = process.env;

  if (!DB_SERVER || !DB_DATABASE || !DB_USER || !DB_PASSWORD) {
    throw new Error('Required database environment variables are missing');
  }

  return {
    server: DB_SERVER,
    authentication: {
      type: 'default',
      options: {
        userName: DB_USER,
        password: DB_PASSWORD
      }
    },
    options: {
      database: DB_DATABASE,
      encrypt: DB_ENCRYPT === 'true',
      trustServerCertificate: false,
      enableArithAbort: true,
      // Connection timeout (in ms)
      connectTimeout: parseInt(DB_CONNECT_TIMEOUT),
      // Request timeout (in ms)
      requestTimeout: parseInt(DB_REQUEST_TIMEOUT),
      // Keep connections alive
      cancelTimeout: 5000,
    },
    // Connection pool settings for Azure SQL Database
    pool: {
      max: parseInt(DB_POOL_MAX), // Maximum number of connections
      min: parseInt(DB_POOL_MIN), // Minimum number of connections to keep alive
      idleTimeoutMillis: parseInt(DB_IDLE_TIMEOUT), // Close idle connections
      acquireTimeoutMillis: 60000, // 60 seconds to get connection from pool
      createTimeoutMillis: 60000, // 60 seconds to create new connection
      destroyTimeoutMillis: 5000, // 5 seconds to destroy connection
      reapIntervalMillis: 1000, // Check for idle connections every second
      createRetryIntervalMillis: 200, // Retry creating connection every 200ms
      propagateCreateError: false // Don't fail immediately on connection creation error
    }
  };
}

/**
 * Keep-alive interval for Azure SQL Database (in milliseconds)
 * Default: 4 minutes (240000ms)
 */
export const KEEPALIVE_INTERVAL = parseInt(process.env.DB_KEEPALIVE_INTERVAL || '240000');

/**
 * Maximum number of connection retry attempts
 */
export const MAX_CONNECTION_RETRIES = parseInt(process.env.DB_MAX_RETRIES || '3');
