import { Router, Request, Response } from 'express';
import sql from "mssql";
import { pool } from "../db";
import { randomUUID } from 'crypto';

const router = Router();

/**
 * Azure AD Authentication API
 * Frontend handles MSAL authentication and passes Azure user info to backend
 * Backend creates/validates users based on Azure AD data
 */

// Quick health check
router.get('/health', (_req, res) => {
  console.log('🔐 Azure Auth /health ping');
  res.send('Azure auth ok');
});

// POST /api/user-auth/azure-login
// Frontend sends Azure AD user info after MSAL authentication
router.post('/azure-login', async (req: Request, res: Response) => {
  console.log('🔐 Azure Auth /azure-login');

  const { azureId, email, name, accessToken } = req.body;
  
  if (!azureId || !email) {
    res.status(400).json({ error: 'Azure ID and email are required' });
    return;
  }

  try {
    const db = await pool;
    
    // Check if user exists by Azure ID or email
    const userResult = await db
      .request()
      .input('azure_id', sql.UniqueIdentifier, azureId)
      .input('email', sql.NVarChar(200), email)
      .query(`
        SELECT 
          id, 
          azure_id, 
          email, 
          full_name, 
          role, 
          is_active,
          created_at
        FROM dbo.users 
        WHERE azure_id = @azure_id OR email = @email
      `);

    let userId;
    let isNewUser = false;

    if (userResult.recordset.length === 0) {
      // Create new user
      userId = randomUUID();
      isNewUser = true;
      
      await db
        .request()
        .input('id', sql.UniqueIdentifier, userId)
        .input('azure_id', sql.UniqueIdentifier, azureId)
        .input('email', sql.NVarChar(200), email)
        .input('full_name', sql.NVarChar(200), name || email)
        .query(`
          INSERT INTO dbo.users (id, azure_id, email, full_name, role, is_active, created_at)
          VALUES (@id, @azure_id, @email, @full_name, 'user', 1, GETDATE())
        `);

      // Create default preferences for new user
      await db
        .request()
        .input('user_id', sql.UniqueIdentifier, userId)
        .query(`
          INSERT INTO dbo.user_preferences (user_id, created_at, updated_at)
          VALUES (@user_id, GETDATE(), GETDATE())
        `);

      console.log(`✅ Created new Azure AD user: ${email}`);
    } else {
      // Update existing user info if needed
      const existingUser = userResult.recordset[0];
      userId = existingUser.id;
      
      // Update Azure ID if it was missing or update name if it changed
      await db
        .request()
        .input('user_id', sql.UniqueIdentifier, userId)
        .input('azure_id', sql.UniqueIdentifier, azureId)
        .input('full_name', sql.NVarChar(200), name || email)
        .query(`
          UPDATE dbo.users 
          SET 
            azure_id = @azure_id,
            full_name = @full_name,
            updated_at = GETDATE()
          WHERE id = @user_id
        `);

      console.log(`✅ Updated Azure AD user: ${email}`);
    }

    // Get updated user info
    const finalUserResult = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        SELECT 
          id, 
          azure_id, 
          email, 
          full_name, 
          role, 
          is_active
        FROM dbo.users 
        WHERE id = @user_id
      `);

    const user = finalUserResult.recordset[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        azureId: user.azure_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active
      },
      isNewUser
    });

  } catch (err) {
    console.error('Azure Auth Error:', err);
    res.status(500).json({ error: 'Azure authentication failed' });
  }
});

// POST /api/user-auth/validate-session
// Validate that a user ID exists and is active
router.post('/validate-session', async (req: Request, res: Response) => {
  console.log('🔐 Azure Auth /validate-session');

  const { userId } = req.body;
  
  if (!userId) {
    res.status(400).json({ error: 'User ID is required' });
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
          azure_id, 
          email, 
          full_name, 
          role, 
          is_active
        FROM dbo.users 
        WHERE id = @user_id AND is_active = 1
      `);

    if (result.recordset.length === 0) {
      res.status(401).json({ error: 'Invalid or inactive user session' });
      return;
    }

    const user = result.recordset[0];
    res.json({
      valid: true,
      user: {
        id: user.id,
        azureId: user.azure_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active
      }
    });

  } catch (err) {
    console.error('Session validation error:', err);
    res.status(500).json({ error: 'Session validation failed' });
  }
});

export default router;
