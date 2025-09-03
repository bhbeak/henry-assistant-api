import { Router, Request, Response } from 'express';
import sql from 'mssql';
import { pool } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * Conditions API for Henry Assistant Planning System
 * Manages life areas/conditions (Money, Activity, Relationship, Career, etc.)
 */

// GET /api/conditions - List all conditions for current user
router.get('/', async (req: Request, res: Response) => {
  console.log('📋 GET /api/conditions');
  
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
        SELECT 
          id,
          name,
          sort_order,
          created_at,
          modified_at
        FROM dbo.conditions 
        WHERE created_by = @user_id
        ORDER BY sort_order ASC, name ASC
      `);

    res.json({ conditions: result.recordset });
  } catch (err) {
    console.error('Conditions list error:', err);
    res.status(500).json({ error: 'Failed to fetch conditions' });
  }
});

// GET /api/conditions/:id - Get specific condition
router.get('/:id', async (req: Request, res: Response) => {
  console.log('📋 GET /api/conditions/:id');
  
  const userId = req.header('x-user-id');
  const conditionId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    const result = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('condition_id', sql.UniqueIdentifier, conditionId)
      .query(`
        SELECT 
          id,
          name,
          sort_order,
          created_at,
          modified_at
        FROM dbo.conditions 
        WHERE id = @condition_id AND created_by = @user_id
      `);

    if (!result.recordset.length) {
      res.status(404).json({ error: 'Condition not found' });
      return;
    }

    res.json({ condition: result.recordset[0] });
  } catch (err) {
    console.error('Condition fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch condition' });
  }
});

// POST /api/conditions - Create new condition
router.post('/', async (req: Request, res: Response) => {
  console.log('📋 POST /api/conditions');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { name, sort_order = 0 } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  try {
    const db = await pool;
    const conditionId = randomUUID();

    await db
      .request()
      .input('id', sql.UniqueIdentifier, conditionId)
      .input('name', sql.NVarChar(100), name)
      .input('sort_order', sql.Int, sort_order)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        INSERT INTO dbo.conditions (id, name, sort_order, created_by, modified_by)
        VALUES (@id, @name, @sort_order, @user_id, @user_id)
      `);

    res.status(201).json({ 
      id: conditionId, 
      name, 
      sort_order,
      created_at: new Date(),
      modified_at: new Date()
    });
  } catch (err) {
    console.error('Condition creation error:', err);
    res.status(500).json({ error: 'Failed to create condition' });
  }
});

// PUT /api/conditions/:id - Update condition
router.put('/:id', async (req: Request, res: Response) => {
  console.log('📋 PUT /api/conditions/:id');
  
  const userId = req.header('x-user-id');
  const conditionId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { name, sort_order } = req.body;

  try {
    const db = await pool;
    
    // Check ownership
    const ownerCheck = await db
      .request()
      .input('condition_id', sql.UniqueIdentifier, conditionId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT id FROM dbo.conditions 
        WHERE id = @condition_id AND created_by = @user_id
      `);

    if (!ownerCheck.recordset.length) {
      res.status(404).json({ error: 'Condition not found' });
      return;
    }

    await db
      .request()
      .input('condition_id', sql.UniqueIdentifier, conditionId)
      .input('name', sql.NVarChar(100), name)
      .input('sort_order', sql.Int, sort_order)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        UPDATE dbo.conditions 
        SET 
          name = ISNULL(@name, name),
          sort_order = ISNULL(@sort_order, sort_order),
          modified_by = @user_id,
          modified_at = GETDATE()
        WHERE id = @condition_id
      `);

    res.json({ success: true });
  } catch (err) {
    console.error('Condition update error:', err);
    res.status(500).json({ error: 'Failed to update condition' });
  }
});

// DELETE /api/conditions/:id - Delete condition
router.delete('/:id', async (req: Request, res: Response) => {
  console.log('📋 DELETE /api/conditions/:id');
  
  const userId = req.header('x-user-id');
  const conditionId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    // Check if condition has goals
    const goalsCheck = await db
      .request()
      .input('condition_id', sql.UniqueIdentifier, conditionId)
      .query(`
        SELECT COUNT(*) as goal_count 
        FROM dbo.goals 
        WHERE condition_id = @condition_id
      `);

    if (goalsCheck.recordset[0].goal_count > 0) {
      res.status(400).json({ error: 'Cannot delete condition with existing goals' });
      return;
    }

    // Delete condition
    const result = await db
      .request()
      .input('condition_id', sql.UniqueIdentifier, conditionId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        DELETE FROM dbo.conditions 
        WHERE id = @condition_id AND created_by = @user_id
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ error: 'Condition not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Condition deletion error:', err);
    res.status(500).json({ error: 'Failed to delete condition' });
  }
});

export default router;
