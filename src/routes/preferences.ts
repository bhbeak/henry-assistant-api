import { Router, Request, Response } from 'express';
import sql from 'mssql';
import { pool } from '../db';

const router = Router();

/**
 * User Preferences API for Henry Assistant
 * Handles user settings, themes, and customization options
 */

// GET /preferences - Get user preferences
router.get('/', async (req: Request, res: Response) => {
  console.log('⚙️ GET /preferences');
  
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
          theme,
          language,
          timezone,
          notification_email,
          notification_push,
          ai_model_preference,
          created_at,
          updated_at
        FROM dbo.user_preferences
        WHERE user_id = @user_id
      `);

    if (!result.recordset.length) {
      // Create default preferences if none exist
      await db
        .request()
        .input('user_id', sql.UniqueIdentifier, userId)
        .query(`
          INSERT INTO dbo.user_preferences (user_id)
          VALUES (@user_id)
        `);

      // Return default preferences
      res.json({
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        notification_email: true,
        notification_push: true,
        ai_model_preference: 'gpt-4',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return;
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PUT /preferences - Update user preferences
router.put('/', async (req: Request, res: Response) => {
  console.log('⚙️ PUT /preferences');
  
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return;
  }

  const {
    theme,
    language,
    timezone,
    notification_email,
    notification_push,
    ai_model_preference
  } = req.body;

  try {
    const db = await pool;
    
    // Check if preferences exist
    const existsResult = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT id FROM dbo.user_preferences WHERE user_id = @user_id
      `);

    if (!existsResult.recordset.length) {
      // Create new preferences
      await db
        .request()
        .input('user_id', sql.UniqueIdentifier, userId)
        .input('theme', sql.NVarChar(20), theme)
        .input('language', sql.NVarChar(10), language)
        .input('timezone', sql.NVarChar(50), timezone)
        .input('notification_email', sql.Bit, notification_email)
        .input('notification_push', sql.Bit, notification_push)
        .input('ai_model_preference', sql.NVarChar(50), ai_model_preference)
        .query(`
          INSERT INTO dbo.user_preferences 
          (user_id, theme, language, timezone, notification_email, notification_push, ai_model_preference)
          VALUES 
          (@user_id, 
           ISNULL(@theme, 'light'), 
           ISNULL(@language, 'en'), 
           ISNULL(@timezone, 'UTC'),
           ISNULL(@notification_email, 1),
           ISNULL(@notification_push, 1),
           ISNULL(@ai_model_preference, 'gpt-4'))
        `);
    } else {
      // Update existing preferences
      await db
        .request()
        .input('user_id', sql.UniqueIdentifier, userId)
        .input('theme', sql.NVarChar(20), theme)
        .input('language', sql.NVarChar(10), language)
        .input('timezone', sql.NVarChar(50), timezone)
        .input('notification_email', sql.Bit, notification_email)
        .input('notification_push', sql.Bit, notification_push)
        .input('ai_model_preference', sql.NVarChar(50), ai_model_preference)
        .query(`
          UPDATE dbo.user_preferences 
          SET 
            theme = ISNULL(@theme, theme),
            language = ISNULL(@language, language),
            timezone = ISNULL(@timezone, timezone),
            notification_email = ISNULL(@notification_email, notification_email),
            notification_push = ISNULL(@notification_push, notification_push),
            ai_model_preference = ISNULL(@ai_model_preference, ai_model_preference),
            updated_at = GETDATE()
          WHERE user_id = @user_id
        `);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// GET /preferences/models - Get available AI models
router.get('/models', async (_req: Request, res: Response) => {
  console.log('⚙️ GET /preferences/models');
  
  // This would typically come from a configuration or external service
  const availableModels = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      description: 'Most capable model, best for complex tasks',
      tier: 'premium'
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Fast and efficient for most conversations',
      tier: 'standard'
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      description: 'Excellent for analysis and reasoning',
      tier: 'premium'
    }
  ];

  res.json({ models: availableModels });
});

// GET /preferences/themes - Get available themes
router.get('/themes', async (_req: Request, res: Response) => {
  console.log('⚙️ GET /preferences/themes');
  
  const availableThemes = [
    {
      id: 'light',
      name: 'Light',
      description: 'Clean light theme'
    },
    {
      id: 'dark',
      name: 'Dark',
      description: 'Easy on the eyes dark theme'
    },
    {
      id: 'auto',
      name: 'Auto',
      description: 'Follows system preference'
    }
  ];

  res.json({ themes: availableThemes });
});

export default router;
