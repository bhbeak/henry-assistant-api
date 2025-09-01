-- Henry Assistant Database Migration Script
-- This script safely creates or updates the database structure for Henry Assistant application
-- It checks for existing objects before creating them

-- Check and create Users table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
BEGIN
    CREATE TABLE dbo.users (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        email NVARCHAR(200) UNIQUE NOT NULL,
        full_name NVARCHAR(200),
        password_hash NVARCHAR(200) NOT NULL,
        role NVARCHAR(50) DEFAULT 'user', -- 'user', 'admin', 'premium'
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Created users table';
END
ELSE
BEGIN
    PRINT 'Users table already exists';
END
GO

-- Check and create User preferences table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_preferences' AND xtype='U')
BEGIN
    CREATE TABLE dbo.user_preferences (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        theme NVARCHAR(20) DEFAULT 'light', -- 'light', 'dark', 'auto'
        language NVARCHAR(10) DEFAULT 'en', -- Language preference
        timezone NVARCHAR(50) DEFAULT 'UTC',
        notification_email BIT DEFAULT 1,
        notification_push BIT DEFAULT 1,
        ai_model_preference NVARCHAR(50) DEFAULT 'gpt-4', -- Preferred AI model
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
    PRINT 'Created user_preferences table';
END
ELSE
BEGIN
    PRINT 'User_preferences table already exists';
END
GO

-- Check and create Conversations table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='conversations' AND xtype='U')
BEGIN
    CREATE TABLE dbo.conversations (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        title NVARCHAR(200), -- Auto-generated or user-defined title
        is_archived BIT DEFAULT 0,
        is_shared BIT DEFAULT 0, -- For sharing conversations
        share_token UNIQUEIDENTIFIER NULL, -- Public share token if shared
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
    PRINT 'Created conversations table';
END
ELSE
BEGIN
    PRINT 'Conversations table already exists';
END
GO

-- Check and create Messages table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='messages' AND xtype='U')
BEGIN
    CREATE TABLE dbo.messages (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        conversation_id UNIQUEIDENTIFIER NOT NULL,
        role NVARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
        content NVARCHAR(MAX) NOT NULL,
        model_used NVARCHAR(50), -- Which AI model was used for assistant responses
        tokens_used INT DEFAULT 0, -- Token count for billing/analytics
        message_order INT NOT NULL, -- Order within conversation
        metadata NVARCHAR(MAX), -- JSON for additional data (attachments, etc.)
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (conversation_id) REFERENCES dbo.conversations(id) ON DELETE CASCADE
    );
    PRINT 'Created messages table';
END
ELSE
BEGIN
    PRINT 'Messages table already exists';
END
GO

-- Check and create User prompts table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_prompts' AND xtype='U')
BEGIN
    CREATE TABLE dbo.user_prompts (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(500),
        prompt_text NVARCHAR(MAX) NOT NULL,
        category NVARCHAR(50), -- 'work', 'personal', 'creative', etc.
        is_public BIT DEFAULT 0, -- Can other users see/use this prompt
        usage_count INT DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
    PRINT 'Created user_prompts table';
END
ELSE
BEGIN
    PRINT 'User_prompts table already exists';
END
GO

-- Check and create Knowledge documents table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='knowledge_documents' AND xtype='U')
BEGIN
    CREATE TABLE dbo.knowledge_documents (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        filename NVARCHAR(255) NOT NULL,
        original_filename NVARCHAR(255) NOT NULL,
        file_type NVARCHAR(50), -- 'pdf', 'docx', 'txt', etc.
        file_size BIGINT,
        content_text NVARCHAR(MAX), -- Extracted text content
        embedding_processed BIT DEFAULT 0, -- Whether embeddings have been created
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
    PRINT 'Created knowledge_documents table';
END
ELSE
BEGIN
    PRINT 'Knowledge_documents table already exists';
END
GO

-- Check and create Usage tracking table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='usage_tracking' AND xtype='U')
BEGIN
    CREATE TABLE dbo.usage_tracking (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        action_type NVARCHAR(50) NOT NULL, -- 'message', 'document_upload', 'prompt_use'
        tokens_used INT DEFAULT 0,
        model_used NVARCHAR(50),
        cost_estimate DECIMAL(10,6) DEFAULT 0, -- Estimated cost in dollars
        metadata NVARCHAR(MAX), -- JSON for additional tracking data
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
    PRINT 'Created usage_tracking table';
END
ELSE
BEGIN
    PRINT 'Usage_tracking table already exists';
END
GO

-- Check and create Conversation shares table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='conversation_shares' AND xtype='U')
BEGIN
    CREATE TABLE dbo.conversation_shares (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        conversation_id UNIQUEIDENTIFIER NOT NULL,
        shared_by_user_id UNIQUEIDENTIFIER NOT NULL,
        shared_with_user_id UNIQUEIDENTIFIER NULL, -- NULL for public shares
        permission_level NVARCHAR(20) DEFAULT 'read', -- 'read', 'comment', 'edit'
        share_token UNIQUEIDENTIFIER DEFAULT NEWID(),
        expires_at DATETIME2 NULL, -- NULL for no expiration
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (conversation_id) REFERENCES dbo.conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_by_user_id) REFERENCES dbo.users(id) ON DELETE NO ACTION,
        FOREIGN KEY (shared_with_user_id) REFERENCES dbo.users(id) ON DELETE NO ACTION
    );
    PRINT 'Created conversation_shares table';
END
ELSE
BEGIN
    PRINT 'Conversation_shares table already exists';
END
GO

-- Create indexes if they don't exist
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_conversations_user_id')
BEGIN
    CREATE INDEX IX_conversations_user_id ON dbo.conversations(user_id);
    PRINT 'Created index IX_conversations_user_id';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_conversations_updated_at')
BEGIN
    CREATE INDEX IX_conversations_updated_at ON dbo.conversations(updated_at DESC);
    PRINT 'Created index IX_conversations_updated_at';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_messages_conversation_id')
BEGIN
    CREATE INDEX IX_messages_conversation_id ON dbo.messages(conversation_id);
    PRINT 'Created index IX_messages_conversation_id';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_messages_created_at')
BEGIN
    CREATE INDEX IX_messages_created_at ON dbo.messages(created_at);
    PRINT 'Created index IX_messages_created_at';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_prompts_user_id')
BEGIN
    CREATE INDEX IX_user_prompts_user_id ON dbo.user_prompts(user_id);
    PRINT 'Created index IX_user_prompts_user_id';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_knowledge_documents_user_id')
BEGIN
    CREATE INDEX IX_knowledge_documents_user_id ON dbo.knowledge_documents(user_id);
    PRINT 'Created index IX_knowledge_documents_user_id';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_usage_tracking_user_id')
BEGIN
    CREATE INDEX IX_usage_tracking_user_id ON dbo.usage_tracking(user_id);
    PRINT 'Created index IX_usage_tracking_user_id';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_usage_tracking_created_at')
BEGIN
    CREATE INDEX IX_usage_tracking_created_at ON dbo.usage_tracking(created_at);
    PRINT 'Created index IX_usage_tracking_created_at';
END
GO

-- Insert admin user if it doesn't exist
IF NOT EXISTS (SELECT * FROM dbo.users WHERE email = 'bvail@smartconnx.com')
BEGIN
    DECLARE @adminId UNIQUEIDENTIFIER = NEWID();
    
    INSERT INTO dbo.users (id, email, full_name, password_hash, role)
    VALUES (
        @adminId, 
        'bvail@smartconnx.com', 
        'Brandon Vail', 
        '$argon2id$v=19$m=65536,t=3,p=4$sB6KyYY8+4U9exu2RhvSZA$g0eM+lHijuGALzU6TM8lg90sMCSlirigbY5Hlb1dl78',
        'admin'
    );
    
    -- Create default preferences for admin user
    INSERT INTO dbo.user_preferences (user_id)
    VALUES (@adminId);
    
    PRINT 'Created admin user and preferences';
END
ELSE
BEGIN
    PRINT 'Admin user already exists';
    
    -- Ensure admin user has preferences
    IF NOT EXISTS (SELECT * FROM dbo.user_preferences WHERE user_id = (SELECT id FROM dbo.users WHERE email = 'admin@henry-app.com'))
    BEGIN
        INSERT INTO dbo.user_preferences (user_id)
        SELECT id FROM dbo.users WHERE email = 'admin@henry-app.com';
        PRINT 'Created preferences for existing admin user';
    END
END
GO

PRINT 'Henry Assistant database migration completed successfully!';
