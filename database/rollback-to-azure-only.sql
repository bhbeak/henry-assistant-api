-- Rollback Migration: Remove Password Authentication and Convert to Azure AD Only
-- File: database/rollback-to-azure-only.sql
-- Purpose: Remove password-based authentication, keep only Azure AD authentication

USE [henry-test]
GO

PRINT 'Starting rollback to Azure AD only authentication...'
GO

-- Remove password_hash column from users table if it exists
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'password_hash')
BEGIN
    ALTER TABLE dbo.users DROP COLUMN password_hash;
    PRINT 'Removed password_hash column from users table';
END
ELSE
BEGIN
    PRINT 'password_hash column already removed or never existed';
END
GO

-- Remove any existing password-based admin users
DELETE FROM dbo.users WHERE email IN ('admin@henry-app.com', 'bvail@smartconnx.com') AND role = 'admin';
PRINT 'Removed any existing password-based admin users';
GO

-- Add azure_id column if it doesn't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'azure_id')
BEGIN
    ALTER TABLE dbo.users ADD azure_id UNIQUEIDENTIFIER NULL;
    PRINT 'Added azure_id column to users table';
END
ELSE
BEGIN
    PRINT 'azure_id column already exists';
END
GO

-- Update users table to ensure it only has Azure AD fields
-- Make sure azure_id is required and unique
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
               WHERE CONSTRAINT_TYPE = 'UNIQUE' 
               AND TABLE_NAME = 'users' 
               AND CONSTRAINT_NAME = 'UQ_users_azure_id')
BEGIN
    ALTER TABLE dbo.users ADD CONSTRAINT UQ_users_azure_id UNIQUE (azure_id);
    PRINT 'Added unique constraint to azure_id column';
END
ELSE
BEGIN
    PRINT 'azure_id unique constraint already exists';
END
GO

-- Make azure_id NOT NULL if it isn't already
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 'users' 
           AND COLUMN_NAME = 'azure_id' 
           AND IS_NULLABLE = 'YES')
BEGIN
    -- First, remove any users without azure_id
    DELETE FROM dbo.users WHERE azure_id IS NULL;
    
    -- Drop the unique constraint temporarily
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
               WHERE CONSTRAINT_NAME = 'UQ_users_azure_id' AND TABLE_NAME = 'users')
    BEGIN
        ALTER TABLE dbo.users DROP CONSTRAINT UQ_users_azure_id;
        PRINT 'Temporarily dropped unique constraint on azure_id';
    END
    
    -- Then make the column NOT NULL
    ALTER TABLE dbo.users ALTER COLUMN azure_id UNIQUEIDENTIFIER NOT NULL;
    
    -- Recreate the unique constraint
    ALTER TABLE dbo.users ADD CONSTRAINT UQ_users_azure_id UNIQUE (azure_id);
    PRINT 'Made azure_id column NOT NULL and recreated unique constraint';
END
ELSE
BEGIN
    PRINT 'azure_id column is already NOT NULL';
END
GO

-- Create a sample Azure AD admin user (you'll need to replace with real Azure ID)
-- This is just for testing - replace with actual Azure AD user ID
DECLARE @sampleAzureId UNIQUEIDENTIFIER = '12345678-1234-5678-9012-123456789012'; -- Replace with real Azure AD user ID
DECLARE @adminEmail NVARCHAR(255) = 'bvail@smartconnx.com';

IF NOT EXISTS (SELECT * FROM dbo.users WHERE email = @adminEmail)
BEGIN
    DECLARE @adminUserId UNIQUEIDENTIFIER = NEWID();
    
    INSERT INTO dbo.users (id, azure_id, email, full_name, role, created_at)
    VALUES (
        @adminUserId,
        @sampleAzureId, -- You'll need to update this with the real Azure AD user ID
        @adminEmail,
        'Brandon Vail',
        'admin',
        GETDATE()
    );
    
    -- Create default preferences for admin user
    IF NOT EXISTS (SELECT * FROM dbo.user_preferences WHERE user_id = @adminUserId)
    BEGIN
        INSERT INTO dbo.user_preferences (user_id)
        VALUES (@adminUserId);
    END
    
    PRINT 'Created Azure AD admin user (update azure_id with real value)';
END
ELSE
BEGIN
    PRINT 'Admin user already exists';
END
GO

PRINT 'Rollback to Azure AD only authentication completed!';
PRINT 'IMPORTANT: Update the admin user azure_id with the real Azure AD user ID';
GO
