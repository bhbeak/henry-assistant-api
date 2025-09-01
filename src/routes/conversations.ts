import { Router, Request, Response } from 'express';
import sql from 'mssql';
import { pool } from '../db';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * Conversations API for Henry Assistant
 * Handles chat sessions, messages, and conversation management
 */

// GET /conversations - Get user's conversations
router.get('/', async (req: Request, res: Response) => {
  console.log('💬 GET /conversations');
  
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
          c.id,
          c.title,
          c.is_archived,
          c.is_shared,
          c.created_at,
          c.updated_at,
          (SELECT COUNT(*) FROM dbo.messages m WHERE m.conversation_id = c.id) as message_count,
          (SELECT TOP 1 m.content 
           FROM dbo.messages m 
           WHERE m.conversation_id = c.id 
           ORDER BY m.message_order DESC) as last_message
        FROM dbo.conversations c
        WHERE c.user_id = @user_id
        ORDER BY c.updated_at DESC
      `);

    res.json({ conversations: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// POST /conversations - Create new conversation
router.post('/', async (req: Request, res: Response) => {
  console.log('💬 POST /conversations');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const { title } = req.body;

  try {
    const conversationId = randomUUID();
    const db = await pool;
    
    await db
      .request()
      .input('id', sql.UniqueIdentifier, conversationId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('title', sql.NVarChar(200), title || 'New Conversation')
      .query(`
        INSERT INTO dbo.conversations (id, user_id, title, created_at, updated_at)
        VALUES (@id, @user_id, @title, GETDATE(), GETDATE())
      `);

    res.status(201).json({ 
      id: conversationId,
      title: title || 'New Conversation',
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// GET /conversations/:id - Get specific conversation with messages
router.get('/:id', async (req: Request, res: Response) => {
  console.log('💬 GET /conversations/:id');
  
  const userId = req.header('x-user-id');
  const conversationId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    // Get conversation details
    const conversationResult = await db
      .request()
      .input('conversation_id', sql.UniqueIdentifier, conversationId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT id, title, is_archived, is_shared, created_at, updated_at
        FROM dbo.conversations
        WHERE id = @conversation_id AND user_id = @user_id
      `);

    if (!conversationResult.recordset.length) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Get messages
    const messagesResult = await db
      .request()
      .input('conversation_id', sql.UniqueIdentifier, conversationId)
      .query(`
        SELECT id, role, content, model_used, tokens_used, message_order, metadata, created_at
        FROM dbo.messages
        WHERE conversation_id = @conversation_id
        ORDER BY message_order ASC
      `);

    const conversation = conversationResult.recordset[0];
    conversation.messages = messagesResult.recordset;

    res.json(conversation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// POST /conversations/:id/messages - Add message to conversation
router.post('/:id/messages', async (req: Request, res: Response) => {
  console.log('💬 POST /conversations/:id/messages');
  
  const userId = req.header('x-user-id');
  const conversationId = req.params.id;
  const { role, content, model_used, tokens_used, metadata } = req.body;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  if (!role || !content) {
    res.status(400).json({ error: 'Role and content are required' });
    return;
  }

  try {
    const db = await pool;
    
    // Verify conversation ownership
    const conversationCheck = await db
      .request()
      .input('conversation_id', sql.UniqueIdentifier, conversationId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT id FROM dbo.conversations
        WHERE id = @conversation_id AND user_id = @user_id
      `);

    if (!conversationCheck.recordset.length) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Get next message order
    const orderResult = await db
      .request()
      .input('conversation_id', sql.UniqueIdentifier, conversationId)
      .query(`
        SELECT ISNULL(MAX(message_order), 0) + 1 as next_order
        FROM dbo.messages
        WHERE conversation_id = @conversation_id
      `);

    const nextOrder = orderResult.recordset[0].next_order;
    const messageId = randomUUID();

    // Insert message
    await db
      .request()
      .input('id', sql.UniqueIdentifier, messageId)
      .input('conversation_id', sql.UniqueIdentifier, conversationId)
      .input('role', sql.NVarChar(20), role)
      .input('content', sql.NVarChar(sql.MAX), content)
      .input('model_used', sql.NVarChar(50), model_used)
      .input('tokens_used', sql.Int, tokens_used || 0)
      .input('message_order', sql.Int, nextOrder)
      .input('metadata', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null)
      .query(`
        INSERT INTO dbo.messages 
        (id, conversation_id, role, content, model_used, tokens_used, message_order, metadata, created_at)
        VALUES 
        (@id, @conversation_id, @role, @content, @model_used, @tokens_used, @message_order, @metadata, GETDATE())
      `);

    // Update conversation timestamp
    await db
      .request()
      .input('conversation_id', sql.UniqueIdentifier, conversationId)
      .query(`
        UPDATE dbo.conversations 
        SET updated_at = GETDATE()
        WHERE id = @conversation_id
      `);

    res.status(201).json({ 
      id: messageId,
      message_order: nextOrder,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// PUT /conversations/:id - Update conversation (title, archive status)
router.put('/:id', async (req: Request, res: Response) => {
  console.log('💬 PUT /conversations/:id');
  
  const userId = req.header('x-user-id');
  const conversationId = req.params.id;
  const { title, is_archived } = req.body;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    const result = await db
      .request()
      .input('conversation_id', sql.UniqueIdentifier, conversationId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('title', sql.NVarChar(200), title)
      .input('is_archived', sql.Bit, is_archived)
      .query(`
        UPDATE dbo.conversations 
        SET 
          title = ISNULL(@title, title),
          is_archived = ISNULL(@is_archived, is_archived),
          updated_at = GETDATE()
        WHERE id = @conversation_id AND user_id = @user_id
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// DELETE /conversations/:id - Delete conversation
router.delete('/:id', async (req: Request, res: Response) => {
  console.log('💬 DELETE /conversations/:id');
  
  const userId = req.header('x-user-id');
  const conversationId = req.params.id;
  
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  try {
    const db = await pool;
    
    const result = await db
      .request()
      .input('conversation_id', sql.UniqueIdentifier, conversationId)
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        DELETE FROM dbo.conversations 
        WHERE id = @conversation_id AND user_id = @user_id
      `);

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
