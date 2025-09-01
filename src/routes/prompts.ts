import { Router, Request, Response } from 'express';
import sql from 'mssql';
import { pool } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * User Prompts API for Henry Assistant
 * Handles custom prompts/templates that users can create and reuse
 */

// GET /prompts - Get user's prompts
router.get('/', async (req: Request, res: Response) => {
  console.log('📝 GET /prompts');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { category, is_public } = req.query;

  try {
    const db = await pool;
    let query = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.prompt_text,
        p.category,
        p.is_public,
        p.usage_count,
        p.created_at,
        p.updated_at,
        u.full_name as author_name
      FROM dbo.user_prompts p
      JOIN dbo.users u ON p.user_id = u.id
      WHERE (p.user_id = @user_id OR p.is_public = 1)
    `;

    const request = db.request().input('user_id', sql.UniqueIdentifier, userId);

    if (category) {
      query += ' AND p.category = @category';
      request.input('category', sql.NVarChar(50), category);
    }

    if (is_public !== undefined) {
      query += ' AND p.is_public = @is_public';
      request.input('is_public', sql.Bit, is_public === 'true');
    }

    query += ' ORDER BY p.updated_at DESC';

    const result = await request.query(query);

    res.json({ prompts: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// POST /prompts - Create new prompt
router.post('/', async (req: Request, res: Response) => {
  console.log('📝 POST /prompts');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { name, description, prompt_text, category, is_public } = req.body;

  if (!name || !prompt_text) {
    res.status(400).json({ error: 'Name and prompt_text are required' });
    return;
  }

  try {
    const promptId = randomUUID();
    const db = await pool;
    
    await db
      .request()
      .input('id', sql.UniqueIdentifier, promptId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('name', sql.NVarChar(100), name)
      .input('description', sql.NVarChar(500), description)
      .input('prompt_text', sql.NVarChar(sql.MAX), prompt_text)
      .input('category', sql.NVarChar(50), category)
      .input('is_public', sql.Bit, is_public || false)
      .query(`
        INSERT INTO dbo.user_prompts 
        (id, user_id, name, description, prompt_text, category, is_public, created_at, updated_at)
        VALUES 
        (@id, @user_id, @name, @description, @prompt_text, @category, @is_public, GETDATE(), GETDATE())
      `);

    res.status(201).json({ 
      id: promptId,
      name,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

// GET /prompts/:id - Get specific prompt
router.get('/:id', async (req: Request, res: Response) => {
  console.log('📝 GET /prompts/:id');
  
  const userId = req.header('x-user-id');
  const promptId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    const result = await db
      .request()
      .input('prompt_id', sql.UniqueIdentifier, promptId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.prompt_text,
          p.category,
          p.is_public,
          p.usage_count,
          p.created_at,
          p.updated_at,
          u.full_name as author_name
        FROM dbo.user_prompts p
        JOIN dbo.users u ON p.user_id = u.id
        WHERE p.id = @prompt_id AND (p.user_id = @user_id OR p.is_public = 1)
      `);

    if (!result.recordset.length) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

// PUT /prompts/:id - Update prompt
router.put('/:id', async (req: Request, res: Response) => {
  console.log('📝 PUT /prompts/:id');
  
  const userId = req.header('x-user-id');
  const promptId = req.params.id;
  const { name, description, prompt_text, category, is_public } = req.body;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    const result = await db
      .request()
      .input('prompt_id', sql.UniqueIdentifier, promptId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('name', sql.NVarChar(100), name)
      .input('description', sql.NVarChar(500), description)
      .input('prompt_text', sql.NVarChar(sql.MAX), prompt_text)
      .input('category', sql.NVarChar(50), category)
      .input('is_public', sql.Bit, is_public)
      .query(`
        UPDATE dbo.user_prompts 
        SET 
          name = ISNULL(@name, name),
          description = ISNULL(@description, description),
          prompt_text = ISNULL(@prompt_text, prompt_text),
          category = ISNULL(@category, category),
          is_public = ISNULL(@is_public, is_public),
          updated_at = GETDATE()
        WHERE id = @prompt_id AND user_id = @user_id
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ error: 'Prompt not found or not owned by user' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// DELETE /prompts/:id - Delete prompt
router.delete('/:id', async (req: Request, res: Response) => {
  console.log('📝 DELETE /prompts/:id');
  
  const userId = req.header('x-user-id');
  const promptId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    const result = await db
      .request()
      .input('prompt_id', sql.UniqueIdentifier, promptId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        DELETE FROM dbo.user_prompts 
        WHERE id = @prompt_id AND user_id = @user_id
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ error: 'Prompt not found or not owned by user' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

// POST /prompts/:id/use - Increment usage count for a prompt
router.post('/:id/use', async (req: Request, res: Response) => {
  console.log('📝 POST /prompts/:id/use');
  
  const userId = req.header('x-user-id');
  const promptId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    const result = await db
      .request()
      .input('prompt_id', sql.UniqueIdentifier, promptId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        UPDATE dbo.user_prompts 
        SET usage_count = usage_count + 1
        WHERE id = @prompt_id AND (user_id = @user_id OR is_public = 1)
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update usage count' });
  }
});

// GET /prompts/categories - Get available categories
router.get('/categories', async (req: Request, res: Response) => {
  console.log('📝 GET /prompts/categories');
  
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
        SELECT DISTINCT category, COUNT(*) as count
        FROM dbo.user_prompts
        WHERE user_id = @user_id OR is_public = 1
        GROUP BY category
        ORDER BY count DESC, category
      `);

    res.json({ categories: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;
