import { Router, Request, Response } from 'express';
import sql from 'mssql';
import { pool } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * User Management API for Henry Assistant
 * Handles user CRUD operations, profile management, and user administration
 */

// GET /users/profile - Get current user's profile
router.get('/profile', async (req: Request, res: Response) => {
  console.log('👤 GET /users/profile');
  
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
          u.id,
          u.email,
          u.full_name,
          u.role,
          u.is_active,
          u.created_at,
          u.updated_at,
          COUNT(c.id) as conversation_count,
          SUM(ut.cost_estimate) as total_cost_estimate
        FROM dbo.users u
        LEFT JOIN dbo.conversations c ON u.id = c.user_id
        LEFT JOIN dbo.usage_tracking ut ON u.id = ut.user_id
        WHERE u.id = @user_id
        GROUP BY u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, u.updated_at
      `);

    if (!result.recordset.length) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = result.recordset[0];

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// PUT /users/profile - Update current user's profile
router.put('/profile', async (req: Request, res: Response) => {
  console.log('👤 PUT /users/profile');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { full_name, email } = req.body;

  try {
    const db = await pool;
    
    // Check if email is already taken by another user
    if (email) {
      const emailCheck = await db
        .request()
        .input('email', sql.NVarChar(200), email)
        .input('user_id', sql.UniqueIdentifier, userId)
        .query(`
          SELECT id FROM dbo.users 
          WHERE email = @email AND id != @user_id
        `);

      if (emailCheck.recordset.length > 0) {
        res.status(400).json({ error: 'Email already in use by another user' });
        return;
      }
    }

    const result = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('full_name', sql.NVarChar(200), full_name)
      .input('email', sql.NVarChar(200), email)
      .query(`
        UPDATE dbo.users 
        SET 
          full_name = ISNULL(@full_name, full_name),
          email = ISNULL(@email, email),
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
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /users - Create new user (admin only)
router.post('/', async (req: Request, res: Response) => {
  console.log('👤 POST /users');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  // Check if requesting user is admin
  try {
    const db = await pool;
    const adminCheck = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT role FROM dbo.users WHERE id = @user_id AND is_active = 1
      `);

    if (!adminCheck.recordset.length || adminCheck.recordset[0].role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { email, azure_id, full_name, role = 'user' } = req.body;

    if (!email || !azure_id) {
      res.status(400).json({ error: 'Email and Azure ID are required' });
      return;
    }

    // Check if email already exists
    const emailCheck = await db
      .request()
      .input('email', sql.NVarChar(200), email)
      .query(`
        SELECT id FROM dbo.users WHERE email = @email
      `);

    if (emailCheck.recordset.length > 0) {
      res.status(400).json({ error: 'Email already exists' });
      return;
    }

    const newUserId = randomUUID();

    // Create user
    await db
      .request()
      .input('id', sql.UniqueIdentifier, newUserId)
      .input('azure_id', sql.UniqueIdentifier, azure_id)
      .input('email', sql.NVarChar(200), email)
      .input('full_name', sql.NVarChar(200), full_name)
      .input('role', sql.NVarChar(50), role)
      .query(`
        INSERT INTO dbo.users (id, azure_id, email, full_name, role, created_at, updated_at)
        VALUES (@id, @azure_id, @email, @full_name, @role, GETDATE(), GETDATE())
      `);

    // Create default preferences
    await db
      .request()
      .input('user_id', sql.UniqueIdentifier, newUserId)
      .query(`
        INSERT INTO dbo.user_preferences (user_id, created_at, updated_at)
        VALUES (@user_id, GETDATE(), GETDATE())
      `);

    res.status(201).json({ id: newUserId, azure_id, email, full_name, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// GET /users/:id - Get specific user (admin only or own profile)
router.get('/:id', async (req: Request, res: Response) => {
  console.log('👤 GET /users/:id');
  
  const userId = req.header('x-user-id');
  const targetUserId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    // Check if user is admin or requesting their own profile
    const userCheck = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT role FROM dbo.users WHERE id = @user_id AND is_active = 1
      `);

    if (!userCheck.recordset.length) {
      res.status(401).json({ error: 'Invalid user credentials' });
      return;
    }

    const isAdmin = userCheck.recordset[0].role === 'admin';
    const isOwnProfile = userId === targetUserId;

    if (!isAdmin && !isOwnProfile) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get target user
    const result = await db
      .request()
      .input('target_user_id', sql.UniqueIdentifier, targetUserId)
      .query(`
        SELECT 
          u.id,
          u.email,
          u.full_name,
          u.role,
          u.is_active,
          u.created_at,
          u.updated_at,
          COUNT(c.id) as conversation_count,
          SUM(ut.cost_estimate) as total_cost_estimate,
          MAX(ut.created_at) as last_activity
        FROM dbo.users u
        LEFT JOIN dbo.conversations c ON u.id = c.user_id
        LEFT JOIN dbo.usage_tracking ut ON u.id = ut.user_id
        WHERE u.id = @target_user_id
        GROUP BY u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, u.updated_at
      `);

    if (!result.recordset.length) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /users/:id - Update specific user (admin only)
router.put('/:id', async (req: Request, res: Response) => {
  console.log('👤 PUT /users/:id');
  
  const userId = req.header('x-user-id');
  const targetUserId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  // Check if requesting user is admin
  try {
    const db = await pool;
    const adminCheck = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT role FROM dbo.users WHERE id = @user_id AND is_active = 1
      `);

    if (!adminCheck.recordset.length || adminCheck.recordset[0].role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { email, full_name, role, is_active } = req.body;

    // Check if email is already taken by another user
    if (email) {
      const emailCheck = await db
        .request()
        .input('email', sql.NVarChar(200), email)
        .input('target_user_id', sql.UniqueIdentifier, targetUserId)
        .query(`
          SELECT id FROM dbo.users 
          WHERE email = @email AND id != @target_user_id
        `);

      if (emailCheck.recordset.length > 0) {
        res.status(400).json({ error: 'Email already in use by another user' });
        return;
      }
    }

    const result = await db
      .request()
      .input('target_user_id', sql.UniqueIdentifier, targetUserId)
      .input('email', sql.NVarChar(200), email)
      .input('full_name', sql.NVarChar(200), full_name)
      .input('role', sql.NVarChar(50), role)
      .input('is_active', sql.Bit, is_active)
      .query(`
        UPDATE dbo.users 
        SET 
          email = ISNULL(@email, email),
          full_name = ISNULL(@full_name, full_name),
          role = ISNULL(@role, role),
          is_active = ISNULL(@is_active, is_active),
          updated_at = GETDATE()
        WHERE id = @target_user_id
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

// DELETE /users/:id - Soft delete user (admin only)
router.delete('/:id', async (req: Request, res: Response) => {
  console.log('👤 DELETE /users/:id');
  
  const userId = req.header('x-user-id');
  const targetUserId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  // Check if requesting user is admin
  try {
    const db = await pool;
    const adminCheck = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT role FROM dbo.users WHERE id = @user_id AND is_active = 1
      `);

    if (!adminCheck.recordset.length || adminCheck.recordset[0].role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // Prevent admin from deleting themselves
    if (userId === targetUserId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    // Soft delete (set is_active to false)
    const result = await db
      .request()
      .input('target_user_id', sql.UniqueIdentifier, targetUserId)
      .query(`
        UPDATE dbo.users 
        SET is_active = 0, updated_at = GETDATE()
        WHERE id = @target_user_id
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /users - List users with pagination (admin only)
router.get('/', async (req: Request, res: Response) => {
  console.log('👤 GET /users');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  // Check if requesting user is admin
  try {
    const db = await pool;
    const adminCheck = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT role FROM dbo.users WHERE id = @user_id AND is_active = 1
      `);

    if (!adminCheck.recordset.length || adminCheck.recordset[0].role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { page = '1', limit = '20', search, role, is_active } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

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
        SUM(ut.cost_estimate) as total_cost_estimate,
        MAX(ut.created_at) as last_activity
      FROM dbo.users u
      LEFT JOIN dbo.conversations c ON u.id = c.user_id
      LEFT JOIN dbo.usage_tracking ut ON u.id = ut.user_id
      WHERE 1=1
    `;

    const request = db.request()
      .input('limit', sql.Int, parseInt(limit as string))
      .input('offset', sql.Int, offset);

    if (search) {
      query += ` AND (u.email LIKE @search OR u.full_name LIKE @search)`;
      request.input('search', sql.NVarChar(200), `%${search}%`);
    }

    if (role) {
      query += ` AND u.role = @role`;
      request.input('role', sql.NVarChar(50), role);
    }

    if (is_active !== undefined) {
      query += ` AND u.is_active = @is_active`;
      request.input('is_active', sql.Bit, is_active === 'true');
    }

    query += `
      GROUP BY u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, u.updated_at
      ORDER BY u.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const result = await request.query(query);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM dbo.users u WHERE 1=1`;
    const countRequest = db.request();
    
    if (search) {
      countQuery += ` AND (u.email LIKE @search OR u.full_name LIKE @search)`;
      countRequest.input('search', sql.NVarChar(200), `%${search}%`);
    }

    if (role) {
      countQuery += ` AND u.role = @role`;
      countRequest.input('role', sql.NVarChar(50), role);
    }

    if (is_active !== undefined) {
      countQuery += ` AND u.is_active = @is_active`;
      countRequest.input('is_active', sql.Bit, is_active === 'true');
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

export default router;
