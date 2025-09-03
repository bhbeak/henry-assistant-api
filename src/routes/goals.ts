import { Router, Request, Response } from 'express';
import sql from 'mssql';
import { pool } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * Goals API for Henry Assistant Planning System
 * Manages yearly goals and monthly sub-goals
 */

// GET /api/goals - List goals with filtering
router.get('/', async (req: Request, res: Response) => {
  console.log('🎯 GET /api/goals');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { year, month, condition_id, status, parent_goal_id, type } = req.query;

  try {
    const db = await pool;
    let query = `
      SELECT 
        g.id,
        g.name,
        g.text,
        g.year,
        g.month,
        g.parent_goal_id,
        g.condition_id,
        g.priority,
        g.is_key_priority,
        g.status,
        g.created_at,
        g.modified_at,
        c.name as condition_name,
        c.sort_order as condition_sort,
        pg.name as parent_goal_name
      FROM dbo.goals g
      INNER JOIN dbo.conditions c ON g.condition_id = c.id
      LEFT JOIN dbo.goals pg ON g.parent_goal_id = pg.id
      WHERE g.created_by = @user_id
    `;

    const request = db.request().input('user_id', sql.UniqueIdentifier, userId);

    if (year) {
      query += ` AND g.year = @year`;
      request.input('year', sql.Int, parseInt(year as string));
    }

    if (month) {
      query += ` AND g.month = @month`;
      request.input('month', sql.Int, parseInt(month as string));
    }

    if (condition_id) {
      query += ` AND g.condition_id = @condition_id`;
      request.input('condition_id', sql.UniqueIdentifier, condition_id);
    }

    if (status) {
      query += ` AND g.status = @status`;
      request.input('status', sql.NVarChar(20), status);
    }

    if (parent_goal_id) {
      query += ` AND g.parent_goal_id = @parent_goal_id`;
      request.input('parent_goal_id', sql.UniqueIdentifier, parent_goal_id);
    }

    // Filter by type: yearly (no month) or monthly (has month)
    if (type === 'yearly') {
      query += ` AND g.month IS NULL`;
    } else if (type === 'monthly') {
      query += ` AND g.month IS NOT NULL`;
    }

    query += ` ORDER BY g.priority DESC, g.is_key_priority DESC, c.sort_order ASC, g.created_at ASC`;

    const result = await request.query(query);

    res.json({ goals: result.recordset });
  } catch (err) {
    console.error('Goals list error:', err);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// GET /api/goals/:id - Get specific goal with sub-goals and actions
router.get('/:id', async (req: Request, res: Response) => {
  console.log('🎯 GET /api/goals/:id');
  
  const userId = req.header('x-user-id');
  const goalId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    // Get goal
    const goalResult = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('goal_id', sql.UniqueIdentifier, goalId)
      .query(`
        SELECT 
          g.id,
          g.name,
          g.text,
          g.year,
          g.month,
          g.parent_goal_id,
          g.condition_id,
          g.priority,
          g.is_key_priority,
          g.status,
          g.created_at,
          g.modified_at,
          c.name as condition_name,
          pg.name as parent_goal_name
        FROM dbo.goals g
        INNER JOIN dbo.conditions c ON g.condition_id = c.id
        LEFT JOIN dbo.goals pg ON g.parent_goal_id = pg.id
        WHERE g.id = @goal_id AND g.created_by = @user_id
      `);

    if (!goalResult.recordset.length) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }

    const goal = goalResult.recordset[0];

    // Get sub-goals if this is a yearly goal
    if (!goal.month) {
      const subGoalsResult = await db
        .request()
        .input('parent_goal_id', sql.UniqueIdentifier, goalId)
        .query(`
          SELECT 
            id, name, text, month, priority, is_key_priority, status, created_at
          FROM dbo.goals 
          WHERE parent_goal_id = @parent_goal_id
          ORDER BY month ASC, priority DESC
        `);
      
      goal.sub_goals = subGoalsResult.recordset;
    }

    // Get actions for this goal
    const actionsResult = await db
      .request()
      .input('goal_id', sql.UniqueIdentifier, goalId)
      .query(`
        SELECT 
          id, name, week_number, assigned_date, priority, is_key_priority, status, created_at
        FROM dbo.actions 
        WHERE goal_id = @goal_id
        ORDER BY priority DESC, is_key_priority DESC, created_at ASC
      `);
    
    goal.actions = actionsResult.recordset;

    res.json({ goal });
  } catch (err) {
    console.error('Goal fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch goal' });
  }
});

// POST /api/goals - Create new goal
router.post('/', async (req: Request, res: Response) => {
  console.log('🎯 POST /api/goals');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { 
    name, 
    text, 
    year, 
    month, 
    parent_goal_id, 
    condition_id, 
    priority = 5, 
    is_key_priority = false,
    status = 'draft'
  } = req.body;

  if (!name || !year || !condition_id) {
    res.status(400).json({ error: 'Name, year, and condition_id are required' });
    return;
  }

  try {
    const db = await pool;
    const goalId = randomUUID();

    await db
      .request()
      .input('id', sql.UniqueIdentifier, goalId)
      .input('name', sql.NVarChar(200), name)
      .input('text', sql.NVarChar(sql.MAX), text)
      .input('year', sql.Int, year)
      .input('month', sql.Int, month)
      .input('parent_goal_id', sql.UniqueIdentifier, parent_goal_id)
      .input('condition_id', sql.UniqueIdentifier, condition_id)
      .input('priority', sql.Int, priority)
      .input('is_key_priority', sql.Bit, is_key_priority)
      .input('status', sql.NVarChar(20), status)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        INSERT INTO dbo.goals (
          id, name, text, year, month, parent_goal_id, condition_id, 
          priority, is_key_priority, status, created_by, modified_by
        )
        VALUES (
          @id, @name, @text, @year, @month, @parent_goal_id, @condition_id,
          @priority, @is_key_priority, @status, @user_id, @user_id
        )
      `);

    res.status(201).json({ 
      id: goalId, 
      name, 
      text,
      year,
      month,
      parent_goal_id,
      condition_id,
      priority,
      is_key_priority,
      status,
      created_at: new Date(),
      modified_at: new Date()
    });
  } catch (err) {
    console.error('Goal creation error:', err);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// PUT /api/goals/:id - Update goal
router.put('/:id', async (req: Request, res: Response) => {
  console.log('🎯 PUT /api/goals/:id');
  
  const userId = req.header('x-user-id');
  const goalId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { 
    name, 
    text, 
    year, 
    month, 
    parent_goal_id, 
    condition_id, 
    priority, 
    is_key_priority,
    status
  } = req.body;

  try {
    const db = await pool;
    
    // Check ownership
    const ownerCheck = await db
      .request()
      .input('goal_id', sql.UniqueIdentifier, goalId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT id FROM dbo.goals 
        WHERE id = @goal_id AND created_by = @user_id
      `);

    if (!ownerCheck.recordset.length) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }

    await db
      .request()
      .input('goal_id', sql.UniqueIdentifier, goalId)
      .input('name', sql.NVarChar(200), name)
      .input('text', sql.NVarChar(sql.MAX), text)
      .input('year', sql.Int, year)
      .input('month', sql.Int, month)
      .input('parent_goal_id', sql.UniqueIdentifier, parent_goal_id)
      .input('condition_id', sql.UniqueIdentifier, condition_id)
      .input('priority', sql.Int, priority)
      .input('is_key_priority', sql.Bit, is_key_priority)
      .input('status', sql.NVarChar(20), status)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        UPDATE dbo.goals 
        SET 
          name = ISNULL(@name, name),
          text = ISNULL(@text, text),
          year = ISNULL(@year, year),
          month = ISNULL(@month, month),
          parent_goal_id = ISNULL(@parent_goal_id, parent_goal_id),
          condition_id = ISNULL(@condition_id, condition_id),
          priority = ISNULL(@priority, priority),
          is_key_priority = ISNULL(@is_key_priority, is_key_priority),
          status = ISNULL(@status, status),
          modified_by = @user_id,
          modified_at = GETDATE()
        WHERE id = @goal_id
      `);

    res.json({ success: true });
  } catch (err) {
    console.error('Goal update error:', err);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// DELETE /api/goals/:id - Delete goal
router.delete('/:id', async (req: Request, res: Response) => {
  console.log('🎯 DELETE /api/goals/:id');
  
  const userId = req.header('x-user-id');
  const goalId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    // Check if goal has sub-goals or actions
    const dependenciesCheck = await db
      .request()
      .input('goal_id', sql.UniqueIdentifier, goalId)
      .query(`
        SELECT 
          (SELECT COUNT(*) FROM dbo.goals WHERE parent_goal_id = @goal_id) as sub_goal_count,
          (SELECT COUNT(*) FROM dbo.actions WHERE goal_id = @goal_id) as action_count
      `);

    const deps = dependenciesCheck.recordset[0];
    if (deps.sub_goal_count > 0 || deps.action_count > 0) {
      res.status(400).json({ 
        error: 'Cannot delete goal with existing sub-goals or actions',
        sub_goals: deps.sub_goal_count,
        actions: deps.action_count
      });
      return;
    }

    // Delete goal
    const result = await db
      .request()
      .input('goal_id', sql.UniqueIdentifier, goalId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        DELETE FROM dbo.goals 
        WHERE id = @goal_id AND created_by = @user_id
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Goal deletion error:', err);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

export default router;
