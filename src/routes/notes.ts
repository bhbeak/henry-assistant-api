import { Router, Request, Response } from 'express';
import sql from 'mssql';
import { pool } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * Notes API for Henry Assistant Planning System
 * Manages personal notes, research, and quick captures for planning
 */

// GET /api/notes - List notes with filtering and pagination
router.get('/', async (req: Request, res: Response) => {
  console.log('📝 GET /api/notes');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { 
    page = '1', 
    limit = '20', 
    search, 
    source, 
    is_key_priority 
  } = req.query;

  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  try {
    const db = await pool;
    let query = `
      SELECT 
        id,
        name,
        description,
        link,
        source,
        summary,
        priority,
        is_key_priority,
        created_at,
        modified_at
      FROM dbo.notes 
      WHERE created_by = @user_id
    `;

    const request = db.request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('limit', sql.Int, parseInt(limit as string))
      .input('offset', sql.Int, offset);

    if (search) {
      query += ` AND (name LIKE @search OR description LIKE @search OR summary LIKE @search)`;
      request.input('search', sql.NVarChar(500), `%${search}%`);
    }

    if (source) {
      query += ` AND source = @source`;
      request.input('source', sql.NVarChar(50), source);
    }

    if (is_key_priority === 'true') {
      query += ` AND is_key_priority = 1`;
    }

    query += `
      ORDER BY is_key_priority DESC, priority DESC, created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const result = await request.query(query);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM dbo.notes WHERE created_by = @user_id`;
    const countRequest = db.request().input('user_id', sql.UniqueIdentifier, userId);
    
    if (search) {
      countQuery += ` AND (name LIKE @search OR description LIKE @search OR summary LIKE @search)`;
      countRequest.input('search', sql.NVarChar(500), `%${search}%`);
    }

    if (source) {
      countQuery += ` AND source = @source`;
      countRequest.input('source', sql.NVarChar(50), source);
    }

    if (is_key_priority === 'true') {
      countQuery += ` AND is_key_priority = 1`;
    }

    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0].total;

    res.json({
      notes: result.recordset,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (err) {
    console.error('Notes list error:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET /api/notes/:id - Get specific note
router.get('/:id', async (req: Request, res: Response) => {
  console.log('📝 GET /api/notes/:id');
  
  const userId = req.header('x-user-id');
  const noteId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    const result = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('note_id', sql.UniqueIdentifier, noteId)
      .query(`
        SELECT 
          id,
          name,
          description,
          link,
          source,
          summary,
          priority,
          is_key_priority,
          created_at,
          modified_at
        FROM dbo.notes 
        WHERE id = @note_id AND created_by = @user_id
      `);

    if (!result.recordset.length) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    res.json({ note: result.recordset[0] });
  } catch (err) {
    console.error('Note fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// POST /api/notes - Create new note
router.post('/', async (req: Request, res: Response) => {
  console.log('📝 POST /api/notes');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { 
    name, 
    description, 
    link, 
    source = 'manual', 
    summary, 
    priority = 5, 
    is_key_priority = false 
  } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  try {
    const db = await pool;
    const noteId = randomUUID();

    await db
      .request()
      .input('id', sql.UniqueIdentifier, noteId)
      .input('name', sql.NVarChar(200), name)
      .input('description', sql.NVarChar(sql.MAX), description)
      .input('link', sql.NVarChar(500), link)
      .input('source', sql.NVarChar(50), source)
      .input('summary', sql.NVarChar(1000), summary)
      .input('priority', sql.Int, priority)
      .input('is_key_priority', sql.Bit, is_key_priority)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        INSERT INTO dbo.notes (
          id, name, description, link, source, summary, 
          priority, is_key_priority, created_by, modified_by
        )
        VALUES (
          @id, @name, @description, @link, @source, @summary,
          @priority, @is_key_priority, @user_id, @user_id
        )
      `);

    res.status(201).json({ 
      id: noteId, 
      name, 
      description,
      link,
      source,
      summary,
      priority,
      is_key_priority,
      created_at: new Date(),
      modified_at: new Date()
    });
  } catch (err) {
    console.error('Note creation error:', err);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// PUT /api/notes/:id - Update note
router.put('/:id', async (req: Request, res: Response) => {
  console.log('📝 PUT /api/notes/:id');
  
  const userId = req.header('x-user-id');
  const noteId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { 
    name, 
    description, 
    link, 
    source, 
    summary, 
    priority, 
    is_key_priority 
  } = req.body;

  try {
    const db = await pool;
    
    // Check ownership
    const ownerCheck = await db
      .request()
      .input('note_id', sql.UniqueIdentifier, noteId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT id FROM dbo.notes 
        WHERE id = @note_id AND created_by = @user_id
      `);

    if (!ownerCheck.recordset.length) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    await db
      .request()
      .input('note_id', sql.UniqueIdentifier, noteId)
      .input('name', sql.NVarChar(200), name)
      .input('description', sql.NVarChar(sql.MAX), description)
      .input('link', sql.NVarChar(500), link)
      .input('source', sql.NVarChar(50), source)
      .input('summary', sql.NVarChar(1000), summary)
      .input('priority', sql.Int, priority)
      .input('is_key_priority', sql.Bit, is_key_priority)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        UPDATE dbo.notes 
        SET 
          name = ISNULL(@name, name),
          description = ISNULL(@description, description),
          link = ISNULL(@link, link),
          source = ISNULL(@source, source),
          summary = ISNULL(@summary, summary),
          priority = ISNULL(@priority, priority),
          is_key_priority = ISNULL(@is_key_priority, is_key_priority),
          modified_by = @user_id,
          modified_at = GETDATE()
        WHERE id = @note_id
      `);

    res.json({ success: true });
  } catch (err) {
    console.error('Note update error:', err);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/notes/:id - Delete note
router.delete('/:id', async (req: Request, res: Response) => {
  console.log('📝 DELETE /api/notes/:id');
  
  const userId = req.header('x-user-id');
  const noteId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    const result = await db
      .request()
      .input('note_id', sql.UniqueIdentifier, noteId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        DELETE FROM dbo.notes 
        WHERE id = @note_id AND created_by = @user_id
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Note deletion error:', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// POST /api/notes/quick-capture - Quick capture from URL/text
router.post('/quick-capture', async (req: Request, res: Response) => {
  console.log('📝 POST /api/notes/quick-capture');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { content, source_type = 'text' } = req.body;

  if (!content) {
    res.status(400).json({ error: 'Content is required' });
    return;
  }

  try {
    const db = await pool;
    const noteId = randomUUID();

    // Auto-generate name and summary from content
    let name = content.substring(0, 100);
    let link = null;
    let summary = content.length > 500 ? content.substring(0, 500) + '...' : content;
    
    // If content looks like a URL, extract domain for name
    if (content.startsWith('http')) {
      try {
        const url = new URL(content);
        name = `Link: ${url.hostname}`;
        link = content;
        summary = `Captured link from ${url.hostname}`;
      } catch {
        // Not a valid URL, treat as text
      }
    }

    await db
      .request()
      .input('id', sql.UniqueIdentifier, noteId)
      .input('name', sql.NVarChar(200), name)
      .input('description', sql.NVarChar(sql.MAX), content)
      .input('link', sql.NVarChar(500), link)
      .input('source', sql.NVarChar(50), source_type)
      .input('summary', sql.NVarChar(1000), summary)
      .input('priority', sql.Int, 5)
      .input('is_key_priority', sql.Bit, false)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        INSERT INTO dbo.notes (
          id, name, description, link, source, summary, 
          priority, is_key_priority, created_by, modified_by
        )
        VALUES (
          @id, @name, @description, @link, @source, @summary,
          @priority, @is_key_priority, @user_id, @user_id
        )
      `);

    res.status(201).json({ 
      id: noteId, 
      name, 
      description: content,
      link,
      source: source_type,
      summary,
      priority: 5,
      is_key_priority: false,
      created_at: new Date(),
      modified_at: new Date()
    });
  } catch (err) {
    console.error('Quick capture error:', err);
    res.status(500).json({ error: 'Failed to capture note' });
  }
});

export default router;
