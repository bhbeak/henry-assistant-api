-- Henry Assistant Database Schema
-- This script creates the database structure for Henry Assistant application

-- Users table (Azure AD authentication only)
CREATE TABLE dbo.users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    azure_ad_id NVARCHAR(100) UNIQUE NOT NULL, -- Azure AD Object ID
    email NVARCHAR(200) UNIQUE NOT NULL,
    full_name NVARCHAR(200),
    role NVARCHAR(50) DEFAULT 'user', -- 'user', 'admin', 'premium'
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- User preferences and settings
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
GO

-- Conversations/Chat sessions
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
GO

-- Individual messages within conversations
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
GO

-- User's custom prompts/templates
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
GO

-- Knowledge base/documents that users can upload
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
GO

-- Usage tracking for analytics and billing
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
GO

-- Shared conversations for collaboration
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
GO

-- Indexes for better performance
CREATE INDEX IX_conversations_user_id ON dbo.conversations(user_id);
CREATE INDEX IX_conversations_updated_at ON dbo.conversations(updated_at DESC);
CREATE INDEX IX_messages_conversation_id ON dbo.messages(conversation_id);
CREATE INDEX IX_messages_created_at ON dbo.messages(created_at);
CREATE INDEX IX_user_prompts_user_id ON dbo.user_prompts(user_id);
CREATE INDEX IX_knowledge_documents_user_id ON dbo.knowledge_documents(user_id);
CREATE INDEX IX_usage_tracking_user_id ON dbo.usage_tracking(user_id);
CREATE INDEX IX_usage_tracking_created_at ON dbo.usage_tracking(created_at);
GO

-- Insert a default admin user (update the password hash with a real one)
INSERT INTO dbo.users (id, email, full_name, password_hash, role)
VALUES (
    NEWID(), 
    'admin@henry-app.com', 
    'Henry Admin', 
    '$argon2id$v=19$m=65536,t=3,p=4$placeholder-hash', -- Replace with real hash
    'admin'
);
GO

-- Create default preferences for admin user
INSERT INTO dbo.user_preferences (user_id)
SELECT id FROM dbo.users WHERE email = 'admin@henry-app.com';
GO
