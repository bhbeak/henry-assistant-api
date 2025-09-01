import { Router, Request, Response } from 'express';
import sql from 'mssql';
import { pool } from '../db';

const router = Router();

/**
 * Admin Dashboard API for Henry Assistant
 * Provides system-wide statistics and administrative functions
 */

// Middleware to check admin role
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    const result = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT role FROM dbo.users WHERE id = @user_id AND is_active = 1
      `);

    if (!result.recordset.length || result.recordset[0].role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

// GET /admin/stats - System-wide statistics
router.get('/stats', requireAdmin, async (_req: Request, res: Response) => {
  console.log('🛠️ GET /admin/stats');

  try {
    const db = await pool;
    
    // User statistics
    const userStats = await db.request().query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN created_at >= DATEADD(day, -30, GETDATE()) THEN 1 END) as new_users_30_days
      FROM dbo.users
    `);

    // Conversation statistics
    const conversationStats = await db.request().query(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN created_at >= DATEADD(day, -30, GETDATE()) THEN 1 END) as conversations_30_days,
        COUNT(CASE WHEN is_archived = 1 THEN 1 END) as archived_conversations,
        AVG(CAST(message_count as FLOAT)) as avg_messages_per_conversation
      FROM (
        SELECT 
          c.id,
          c.created_at,
          c.is_archived,
          COUNT(m.id) as message_count
        FROM dbo.conversations c
        LEFT JOIN dbo.messages m ON c.id = m.conversation_id
        GROUP BY c.id, c.created_at, c.is_archived
      ) conv_with_counts
    `);

    // Message statistics
    const messageStats = await db.request().query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN created_at >= DATEADD(day, -30, GETDATE()) THEN 1 END) as messages_30_days,
        COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
        COUNT(CASE WHEN role = 'assistant' THEN 1 END) as assistant_messages,
        AVG(CAST(tokens_used as FLOAT)) as avg_tokens_per_message
      FROM dbo.messages
    `);

    // Usage/Cost statistics
    const usageStats = await db.request().query(`
      SELECT 
        COUNT(*) as total_usage_events,
        SUM(tokens_used) as total_tokens,
        SUM(cost_estimate) as total_cost,
        COUNT(CASE WHEN created_at >= DATEADD(day, -30, GETDATE()) THEN 1 END) as usage_events_30_days,
        SUM(CASE WHEN created_at >= DATEADD(day, -30, GETDATE()) THEN cost_estimate ELSE 0 END) as cost_30_days
      FROM dbo.usage_tracking
    `);

    // Top models by usage
    const topModels = await db.request().query(`
      SELECT TOP 5
        model_used,
        COUNT(*) as usage_count,
        SUM(tokens_used) as total_tokens,
        SUM(cost_estimate) as total_cost
      FROM dbo.usage_tracking
      WHERE model_used IS NOT NULL
        AND created_at >= DATEADD(day, -30, GETDATE())
      GROUP BY model_used
      ORDER BY usage_count DESC
    `);

    // Recent activity (last 7 days)
    const recentActivity = await db.request().query(`
      SELECT 
        CAST(created_at AS DATE) as date,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_events
      FROM dbo.usage_tracking
      WHERE created_at >= DATEADD(day, -7, GETDATE())
      GROUP BY CAST(created_at AS DATE)
      ORDER BY date DESC
    `);

    res.json({
      generated_at: new Date().toISOString(),
      users: userStats.recordset[0],
      conversations: conversationStats.recordset[0],
      messages: messageStats.recordset[0],
      usage: usageStats.recordset[0],
      top_models: topModels.recordset,
      recent_activity: recentActivity.recordset
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch admin statistics' });
  }
});

// GET /admin/users - List all users with admin details
router.get('/users', requireAdmin, async (req: Request, res: Response) => {
  console.log('🛠️ GET /admin/users');

  const { page = '1', limit = '50', search } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    const db = await pool;
    let query = `
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at,
        COUNT(c.id) as conversation_count,
        SUM(ut.cost_estimate) as total_cost,
        MAX(ut.created_at) as last_activity
      FROM dbo.users u
      LEFT JOIN dbo.conversations c ON u.id = c.user_id
      LEFT JOIN dbo.usage_tracking ut ON u.id = ut.user_id
    `;

    const request = db.request()
      .input('limit', sql.Int, parseInt(limit as string))
      .input('offset', sql.Int, offset);

    if (search) {
      query += ` WHERE u.email LIKE @search OR u.full_name LIKE @search`;
      request.input('search', sql.NVarChar(200), `%${search}%`);
    }

    query += `
      GROUP BY u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, u.updated_at
      ORDER BY u.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const result = await request.query(query);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM dbo.users u`;
    const countRequest = db.request();
    
    if (search) {
      countQuery += ` WHERE u.email LIKE @search OR u.full_name LIKE @search`;
      countRequest.input('search', sql.NVarChar(200), `%${search}%`);
    }

    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0].total;

    res.json({
      users: result.recordset,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /admin/users/:id - Update user (e.g., role, active status)
router.put('/users/:id', requireAdmin, async (req: Request, res: Response) => {
  console.log('🛠️ PUT /admin/users/:id');

  const targetUserId = req.params.id;
  const { role, is_active } = req.body;

  try {
    const db = await pool;
    
    const result = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, targetUserId)
      .input('role', sql.NVarChar(50), role)
      .input('is_active', sql.Bit, is_active)
      .query(`
        UPDATE dbo.users 
        SET 
          role = ISNULL(@role, role),
          is_active = ISNULL(@is_active, is_active),
          updated_at = GETDATE()
        WHERE id = @user_id
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /admin/system-health - System health check
router.get('/system-health', requireAdmin, async (_req: Request, res: Response) => {
  console.log('🛠️ GET /admin/system-health');

  try {
    const db = await pool;
    
    // Database connectivity test
    const dbTest = await db.request().query('SELECT GETDATE() as current_time');
    
    // Check recent error rates (if you have error logging)
    const errorCheck = await db.request().query(`
      SELECT COUNT(*) as error_count
      FROM dbo.usage_tracking
      WHERE created_at >= DATEADD(hour, -1, GETDATE())
        AND metadata LIKE '%error%'
    `);

    // Performance metrics
    const perfMetrics = await db.request().query(`
      SELECT 
        AVG(DATEDIFF(ms, created_at, created_at)) as avg_response_time_estimate,
        COUNT(*) as requests_last_hour
      FROM dbo.usage_tracking
      WHERE created_at >= DATEADD(hour, -1, GETDATE())
    `);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        current_time: dbTest.recordset[0].current_time
      },
      errors: {
        last_hour: errorCheck.recordset[0].error_count
      },
      performance: perfMetrics.recordset[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'System health check failed'
    });
  }
});

export default router;
