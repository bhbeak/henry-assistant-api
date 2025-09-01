import { Request, Response, NextFunction } from 'express';
import sql from "mssql";
import { pool } from "../db";

/**
 * Middleware to handle "View As" functionality for admin users
 * 
 * Security Model:
 * - x-user-id: Always contains the actual admin user ID (for audit trails)
 * - x-view-as-user: Optional header containing the target user ID to view as
 * - Only admin users can use the "View As" functionality
 * - Database operations still use admin ID for audit trails
 * - API responses use the viewed user's perspective and data
 */

// Extend Express Request interface to include our custom properties
declare global {
  namespace Express {
    interface Request {
      adminUserId?: string;
      viewAsUserId?: string;
      effectiveUserId?: string;
      isViewingAsUser?: boolean;
    }
  }
}

export const viewAsMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const adminUserId = req.header('x-user-id');
  const viewAsUserId = req.header('x-view-as-user');

  // If no x-view-as-user header, proceed normally
  if (!viewAsUserId) {
    req.effectiveUserId = adminUserId;
    req.isViewingAsUser = false;
    return next();
  }

  // If x-view-as-user is provided, validate admin permissions
  if (!adminUserId) {
    res.status(401).json({ error: 'Missing required header: x-user-id' });
    return;
  }

  try {
    const db = await pool;

    // TODO: Customize this query based on your user/role table schema
    // Validate that the requesting user is an admin
    const adminResult = await db
      .request()
      .input('user_id', sql.UniqueIdentifier, adminUserId)
      .query(`
        SELECT u.id, u.role
        FROM dbo.users u
        WHERE u.id = @user_id AND u.is_active = 1
      `);

    if (!adminResult.recordset.length) {
      res.status(401).json({ error: 'Invalid user credentials' });
      return;
    }

    const adminUser = adminResult.recordset[0];
    if (adminUser.role !== 'admin') {
      res.status(403).json({ 
        error: 'Insufficient permissions. View As functionality is restricted to admin users only.' 
      });
      return;
    }

    // Validate that the target user exists and is active
    const targetUserResult = await db
      .request()
      .input('target_user_id', sql.UniqueIdentifier, viewAsUserId)
      .query(`
        SELECT u.id, u.email, u.full_name, u.role
        FROM dbo.users u
        WHERE u.id = @target_user_id AND u.is_active = 1
      `);

    if (!targetUserResult.recordset.length) {
      res.status(404).json({ 
        error: 'Target user not found or inactive' 
      });
      return;
    }

    const targetUser = targetUserResult.recordset[0];

    // Set request properties for downstream handlers
    req.adminUserId = adminUserId;
    req.viewAsUserId = viewAsUserId;
    req.effectiveUserId = viewAsUserId; // This is what auth endpoints should use
    req.isViewingAsUser = true;

    // Add response headers to indicate "View As" mode
    res.setHeader('X-Viewing-As-User', targetUser.email);
    res.setHeader('X-Viewing-As-Role', targetUser.role || 'none');
    res.setHeader('X-Admin-User', adminUserId);
    res.setHeader('X-View-As-Active', 'true');

    console.log(`🔍 Admin ${adminUserId} viewing as user ${viewAsUserId} (${targetUser.email})`);

    next();
  } catch (err) {
    console.error('❌ View As middleware error:', err);
    res.status(500).json({ error: 'Could not validate View As permissions' });
  }
};
