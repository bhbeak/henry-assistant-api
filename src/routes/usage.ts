import { Router, Request, Response } from 'express';
import sql from 'mssql';
import { pool } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * Usage Tracking API for Henry Assistant
 * Handles analytics, billing data, and usage monitoring
 */

// POST /usage - Log usage event
router.post('/', async (req: Request, res: Response) => {
  console.log('📊 POST /usage');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { action_type, tokens_used, model_used, cost_estimate, metadata } = req.body;

  if (!action_type) {
    res.status(400).json({ error: 'action_type is required' });
    return;
  }

  try {
    const usageId = randomUUID();
    const db = await pool;
    
    await db
      .request()
      .input('id', sql.UniqueIdentifier, usageId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('action_type', sql.NVarChar(50), action_type)
      .input('tokens_used', sql.Int, tokens_used || 0)
      .input('model_used', sql.NVarChar(50), model_used)
      .input('cost_estimate', sql.Decimal(10, 6), cost_estimate || 0)
      .input('metadata', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null)
      .query(`
        INSERT INTO dbo.usage_tracking 
        (id, user_id, action_type, tokens_used, model_used, cost_estimate, metadata, created_at)
        VALUES 
        (@id, @user_id, @action_type, @tokens_used, @model_used, @cost_estimate, @metadata, GETDATE())
      `);

    res.status(201).json({ id: usageId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log usage' });
  }
});

// GET /usage/summary - Get usage summary for user
router.get('/summary', async (req: Request, res: Response) => {
  console.log('📊 GET /usage/summary');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { period = '30' } = req.query; // days

  try {
    const db = await pool;
    const result = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('days', sql.Int, parseInt(period as string))
      .query(`
        SELECT 
          action_type,
          COUNT(*) as event_count,
          SUM(tokens_used) as total_tokens,
          SUM(cost_estimate) as total_cost,
          AVG(tokens_used) as avg_tokens_per_event
        FROM dbo.usage_tracking
        WHERE user_id = @user_id 
          AND created_at >= DATEADD(day, -@days, GETDATE())
        GROUP BY action_type
        ORDER BY total_cost DESC
      `);

    // Also get daily breakdown for the period
    const dailyResult = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('days', sql.Int, parseInt(period as string))
      .query(`
        SELECT 
          CAST(created_at AS DATE) as date,
          COUNT(*) as event_count,
          SUM(tokens_used) as total_tokens,
          SUM(cost_estimate) as total_cost
        FROM dbo.usage_tracking
        WHERE user_id = @user_id 
          AND created_at >= DATEADD(day, -@days, GETDATE())
        GROUP BY CAST(created_at AS DATE)
        ORDER BY date DESC
      `);

    res.json({
      period_days: parseInt(period as string),
      by_action_type: result.recordset,
      daily_breakdown: dailyResult.recordset
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

// GET /usage/models - Get model usage statistics
router.get('/models', async (req: Request, res: Response) => {
  console.log('📊 GET /usage/models');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { period = '30' } = req.query; // days

  try {
    const db = await pool;
    const result = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('days', sql.Int, parseInt(period as string))
      .query(`
        SELECT 
          model_used,
          COUNT(*) as usage_count,
          SUM(tokens_used) as total_tokens,
          SUM(cost_estimate) as total_cost,
          AVG(tokens_used) as avg_tokens_per_use,
          MIN(created_at) as first_used,
          MAX(created_at) as last_used
        FROM dbo.usage_tracking
        WHERE user_id = @user_id 
          AND created_at >= DATEADD(day, -@days, GETDATE())
          AND model_used IS NOT NULL
        GROUP BY model_used
        ORDER BY usage_count DESC
      `);

    res.json({
      period_days: parseInt(period as string),
      models: result.recordset
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch model usage' });
  }
});

// GET /usage/billing - Get billing information
router.get('/billing', async (req: Request, res: Response) => {
  console.log('📊 GET /usage/billing');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { month, year } = req.query;
  const currentDate = new Date();
  const targetMonth = month ? parseInt(month as string) : currentDate.getMonth() + 1;
  const targetYear = year ? parseInt(year as string) : currentDate.getFullYear();

  try {
    const db = await pool;
    const result = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('month', sql.Int, targetMonth)
      .input('year', sql.Int, targetYear)
      .query(`
        SELECT 
          SUM(cost_estimate) as total_cost,
          SUM(tokens_used) as total_tokens,
          COUNT(*) as total_events,
          MIN(created_at) as period_start,
          MAX(created_at) as period_end
        FROM dbo.usage_tracking
        WHERE user_id = @user_id 
          AND MONTH(created_at) = @month
          AND YEAR(created_at) = @year
      `);

    // Get breakdown by action type for the month
    const breakdownResult = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('month', sql.Int, targetMonth)
      .input('year', sql.Int, targetYear)
      .query(`
        SELECT 
          action_type,
          SUM(cost_estimate) as cost,
          SUM(tokens_used) as tokens,
          COUNT(*) as events
        FROM dbo.usage_tracking
        WHERE user_id = @user_id 
          AND MONTH(created_at) = @month
          AND YEAR(created_at) = @year
        GROUP BY action_type
        ORDER BY cost DESC
      `);

    const summary = result.recordset[0] || {
      total_cost: 0,
      total_tokens: 0,
      total_events: 0,
      period_start: null,
      period_end: null
    };

    res.json({
      month: targetMonth,
      year: targetYear,
      summary,
      breakdown: breakdownResult.recordset
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch billing information' });
  }
});

// GET /usage/export - Export usage data
router.get('/export', async (req: Request, res: Response) => {
  console.log('📊 GET /usage/export');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { start_date, end_date, format = 'json' } = req.query;

  try {
    const db = await pool;
    let query = `
      SELECT 
        action_type,
        tokens_used,
        model_used,
        cost_estimate,
        metadata,
        created_at
      FROM dbo.usage_tracking
      WHERE user_id = @user_id
    `;

    const request = db.request().input('user_id', sql.UniqueIdentifier, userId);

    if (start_date) {
      query += ' AND created_at >= @start_date';
      request.input('start_date', sql.DateTime2, new Date(start_date as string));
    }

    if (end_date) {
      query += ' AND created_at <= @end_date';
      request.input('end_date', sql.DateTime2, new Date(end_date as string));
    }

    query += ' ORDER BY created_at DESC';

    const result = await request.query(query);

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'Date,Action Type,Tokens Used,Model Used,Cost Estimate,Metadata\n';
      const csvRows = result.recordset.map(row => 
        `${row.created_at.toISOString()},${row.action_type},${row.tokens_used || 0},${row.model_used || ''},${row.cost_estimate || 0},"${(row.metadata || '').replace(/"/g, '""')}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=henry-usage-export.csv');
      res.send(csvHeader + csvRows);
    } else {
      res.json({ 
        usage_data: result.recordset,
        exported_at: new Date().toISOString(),
        total_records: result.recordset.length
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export usage data' });
  }
});

export default router;
