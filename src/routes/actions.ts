import { Router, Request, Response } from 'express';
import sql from 'mssql';
import { pool } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * Actions API for Henry Assistant Planning System
 * Manages actions that support goals, with week and date assignment
 */

// GET /api/actions - List actions with filtering
router.get('/', async (req: Request, res: Response) => {
  console.log('⚡ GET /api/actions');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { 
    goal_id, 
    week_number, 
    assigned_date, 
    status, 
    parent_action_id,
    is_key_priority,
    date_range
  } = req.query;

  try {
    const db = await pool;
    let query = `
      SELECT 
        a.id,
        a.name,
        a.goal_id,
        a.week_number,
        a.assigned_date,
        a.parent_action_id,
        a.priority,
        a.is_key_priority,
        a.status,
        a.created_at,
        a.modified_at,
        g.name as goal_name,
        g.year as goal_year,
        g.month as goal_month,
        c.name as condition_name,
        c.sort_order as condition_sort,
        pa.name as parent_action_name
      FROM dbo.actions a
      INNER JOIN dbo.goals g ON a.goal_id = g.id
      INNER JOIN dbo.conditions c ON g.condition_id = c.id
      LEFT JOIN dbo.actions pa ON a.parent_action_id = pa.id
      WHERE g.created_by = @user_id
    `;

    const request = db.request().input('user_id', sql.UniqueIdentifier, userId);

    if (goal_id) {
      query += ` AND a.goal_id = @goal_id`;
      request.input('goal_id', sql.UniqueIdentifier, goal_id);
    }

    if (week_number) {
      query += ` AND a.week_number = @week_number`;
      request.input('week_number', sql.Int, parseInt(week_number as string));
    }

    if (assigned_date) {
      query += ` AND a.assigned_date = @assigned_date`;
      request.input('assigned_date', sql.Date, assigned_date);
    }

    if (status) {
      query += ` AND a.status = @status`;
      request.input('status', sql.NVarChar(20), status);
    }

    if (parent_action_id) {
      query += ` AND a.parent_action_id = @parent_action_id`;
      request.input('parent_action_id', sql.UniqueIdentifier, parent_action_id);
    }

    if (is_key_priority === 'true') {
      query += ` AND a.is_key_priority = 1`;
    }

    // Date range filtering
    if (date_range === 'today') {
      query += ` AND a.assigned_date = CAST(GETDATE() AS DATE)`;
    } else if (date_range === 'tomorrow') {
      query += ` AND a.assigned_date = CAST(DATEADD(day, 1, GETDATE()) AS DATE)`;
    } else if (date_range === 'this_week') {
      query += ` AND a.assigned_date BETWEEN CAST(GETDATE() AS DATE) AND CAST(DATEADD(day, 7, GETDATE()) AS DATE)`;
    } else if (date_range === 'unscheduled') {
      query += ` AND a.assigned_date IS NULL AND a.week_number IS NULL`;
    }

    query += ` ORDER BY a.is_key_priority DESC, a.priority DESC, a.assigned_date ASC, a.created_at ASC`;

    const result = await request.query(query);

    res.json({ actions: result.recordset });
  } catch (err) {
    console.error('Actions list error:', err);
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
});

// GET /api/actions/:id - Get specific action with sub-actions
router.get('/:id', async (req: Request, res: Response) => {
  console.log('⚡ GET /api/actions/:id');
  
  const userId = req.header('x-user-id');
  const actionId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    // Get action
    const actionResult = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('action_id', sql.UniqueIdentifier, actionId)
      .query(`
        SELECT 
          a.id,
          a.name,
          a.goal_id,
          a.week_number,
          a.assigned_date,
          a.parent_action_id,
          a.priority,
          a.is_key_priority,
          a.status,
          a.created_at,
          a.modified_at,
          g.name as goal_name,
          g.year as goal_year,
          g.month as goal_month,
          c.name as condition_name,
          pa.name as parent_action_name
        FROM dbo.actions a
        INNER JOIN dbo.goals g ON a.goal_id = g.id
        INNER JOIN dbo.conditions c ON g.condition_id = c.id
        LEFT JOIN dbo.actions pa ON a.parent_action_id = pa.id
        WHERE a.id = @action_id AND g.created_by = @user_id
      `);

    if (!actionResult.recordset.length) {
      res.status(404).json({ error: 'Action not found' });
      return;
    }

    const action = actionResult.recordset[0];

    // Get sub-actions
    const subActionsResult = await db
      .request()
      .input('parent_action_id', sql.UniqueIdentifier, actionId)
      .query(`
        SELECT 
          id, name, week_number, assigned_date, priority, is_key_priority, status, created_at
        FROM dbo.actions 
        WHERE parent_action_id = @parent_action_id
        ORDER BY priority DESC, is_key_priority DESC, created_at ASC
      `);
    
    action.sub_actions = subActionsResult.recordset;

    res.json({ action });
  } catch (err) {
    console.error('Action fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch action' });
  }
});

// POST /api/actions - Create new action
router.post('/', async (req: Request, res: Response) => {
  console.log('⚡ POST /api/actions');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { 
    name, 
    goal_id, 
    week_number, 
    assigned_date, 
    parent_action_id, 
    priority = 5, 
    is_key_priority = false,
    status = 'todo'
  } = req.body;

  if (!name || !goal_id) {
    res.status(400).json({ error: 'Name and goal_id are required' });
    return;
  }

  try {
    const db = await pool;
    
    // Verify goal ownership
    const goalCheck = await db
      .request()
      .input('goal_id', sql.UniqueIdentifier, goal_id)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT id FROM dbo.goals 
        WHERE id = @goal_id AND created_by = @user_id
      `);

    if (!goalCheck.recordset.length) {
      res.status(400).json({ error: 'Goal not found or not owned by user' });
      return;
    }

    const actionId = randomUUID();

    await db
      .request()
      .input('id', sql.UniqueIdentifier, actionId)
      .input('name', sql.NVarChar(200), name)
      .input('goal_id', sql.UniqueIdentifier, goal_id)
      .input('week_number', sql.Int, week_number)
      .input('assigned_date', sql.Date, assigned_date)
      .input('parent_action_id', sql.UniqueIdentifier, parent_action_id)
      .input('priority', sql.Int, priority)
      .input('is_key_priority', sql.Bit, is_key_priority)
      .input('status', sql.NVarChar(20), status)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        INSERT INTO dbo.actions (
          id, name, goal_id, week_number, assigned_date, parent_action_id,
          priority, is_key_priority, status, created_by, modified_by
        )
        VALUES (
          @id, @name, @goal_id, @week_number, @assigned_date, @parent_action_id,
          @priority, @is_key_priority, @status, @user_id, @user_id
        )
      `);

    res.status(201).json({ 
      id: actionId, 
      name, 
      goal_id,
      week_number,
      assigned_date,
      parent_action_id,
      priority,
      is_key_priority,
      status,
      created_at: new Date(),
      modified_at: new Date()
    });
  } catch (err) {
    console.error('Action creation error:', err);
    res.status(500).json({ error: 'Failed to create action' });
  }
});

// PUT /api/actions/:id - Update action
router.put('/:id', async (req: Request, res: Response) => {
  console.log('⚡ PUT /api/actions/:id');
  
  const userId = req.header('x-user-id');
  const actionId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { 
    name, 
    goal_id, 
    week_number, 
    assigned_date, 
    parent_action_id, 
    priority, 
    is_key_priority,
    status
  } = req.body;

  try {
    const db = await pool;
    
    // Check ownership through goal
    const ownerCheck = await db
      .request()
      .input('action_id', sql.UniqueIdentifier, actionId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT a.id 
        FROM dbo.actions a
        INNER JOIN dbo.goals g ON a.goal_id = g.id
        WHERE a.id = @action_id AND g.created_by = @user_id
      `);

    if (!ownerCheck.recordset.length) {
      res.status(404).json({ error: 'Action not found' });
      return;
    }

    await db
      .request()
      .input('action_id', sql.UniqueIdentifier, actionId)
      .input('name', sql.NVarChar(200), name)
      .input('goal_id', sql.UniqueIdentifier, goal_id)
      .input('week_number', sql.Int, week_number)
      .input('assigned_date', sql.Date, assigned_date)
      .input('parent_action_id', sql.UniqueIdentifier, parent_action_id)
      .input('priority', sql.Int, priority)
      .input('is_key_priority', sql.Bit, is_key_priority)
      .input('status', sql.NVarChar(20), status)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        UPDATE dbo.actions 
        SET 
          name = ISNULL(@name, name),
          goal_id = ISNULL(@goal_id, goal_id),
          week_number = @week_number,
          assigned_date = @assigned_date,
          parent_action_id = @parent_action_id,
          priority = ISNULL(@priority, priority),
          is_key_priority = ISNULL(@is_key_priority, is_key_priority),
          status = ISNULL(@status, status),
          modified_by = @user_id,
          modified_at = GETDATE()
        WHERE id = @action_id
      `);

    res.json({ success: true });
  } catch (err) {
    console.error('Action update error:', err);
    res.status(500).json({ error: 'Failed to update action' });
  }
});

// POST /api/actions/:id/assign-to-week - Assign action to specific week
router.post('/:id/assign-to-week', async (req: Request, res: Response) => {
  console.log('⚡ POST /api/actions/:id/assign-to-week');
  
  const userId = req.header('x-user-id');
  const actionId = req.params.id;
  const { week_number } = req.body;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  if (!week_number || week_number < 1 || week_number > 52) {
    res.status(400).json({ error: 'Valid week_number (1-52) is required' });
    return;
  }

  try {
    const db = await pool;
    
    await db
      .request()
      .input('action_id', sql.UniqueIdentifier, actionId)
      .input('week_number', sql.Int, week_number)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        UPDATE dbo.actions 
        SET 
          week_number = @week_number,
          assigned_date = NULL, -- Clear specific date when assigning to week
          modified_by = @user_id,
          modified_at = GETDATE()
        FROM dbo.actions a
        INNER JOIN dbo.goals g ON a.goal_id = g.id
        WHERE a.id = @action_id AND g.created_by = @user_id
      `);

    res.json({ success: true });
  } catch (err) {
    console.error('Action week assignment error:', err);
    res.status(500).json({ error: 'Failed to assign action to week' });
  }
});

// POST /api/actions/:id/assign-to-date - Assign action to specific date
router.post('/:id/assign-to-date', async (req: Request, res: Response) => {
  console.log('⚡ POST /api/actions/:id/assign-to-date');
  
  const userId = req.header('x-user-id');
  const actionId = req.params.id;
  const { assigned_date } = req.body;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  if (!assigned_date) {
    res.status(400).json({ error: 'assigned_date is required' });
    return;
  }

  try {
    const db = await pool;
    
    await db
      .request()
      .input('action_id', sql.UniqueIdentifier, actionId)
      .input('assigned_date', sql.Date, assigned_date)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        UPDATE dbo.actions 
        SET 
          assigned_date = @assigned_date,
          modified_by = @user_id,
          modified_at = GETDATE()
        FROM dbo.actions a
        INNER JOIN dbo.goals g ON a.goal_id = g.id
        WHERE a.id = @action_id AND g.created_by = @user_id
      `);

    res.json({ success: true });
  } catch (err) {
    console.error('Action date assignment error:', err);
    res.status(500).json({ error: 'Failed to assign action to date' });
  }
});

// DELETE /api/actions/:id - Delete action
router.delete('/:id', async (req: Request, res: Response) => {
  console.log('⚡ DELETE /api/actions/:id');
  
  const userId = req.header('x-user-id');
  const actionId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    // Check if action has sub-actions
    const subActionsCheck = await db
      .request()
      .input('action_id', sql.UniqueIdentifier, actionId)
      .query(`
        SELECT COUNT(*) as sub_action_count 
        FROM dbo.actions 
        WHERE parent_action_id = @action_id
      `);

    if (subActionsCheck.recordset[0].sub_action_count > 0) {
      res.status(400).json({ error: 'Cannot delete action with existing sub-actions' });
      return;
    }

    // Delete action
    const result = await db
      .request()
      .input('action_id', sql.UniqueIdentifier, actionId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        DELETE a 
        FROM dbo.actions a
        INNER JOIN dbo.goals g ON a.goal_id = g.id
        WHERE a.id = @action_id AND g.created_by = @user_id
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ error: 'Action not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Action deletion error:', err);
    res.status(500).json({ error: 'Failed to delete action' });
  }
});

export default router;
