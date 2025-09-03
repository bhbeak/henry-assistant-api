-- Henry Assistant Planning System Database Schema
-- Created: September 3, 2025
-- Purpose: Life planning with Conditions, Goals, Actions, and Notes

-- ============================================================================
-- CONDITIONS TABLE
-- ============================================================================
-- Areas of life (Money, Activity, Relationship, Career, etc.)
CREATE TABLE dbo.conditions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    modified_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    created_by UNIQUEIDENTIFIER NOT NULL,
    modified_by UNIQUEIDENTIFIER NOT NULL,
    
    -- Foreign Keys
    CONSTRAINT FK_conditions_created_by FOREIGN KEY (created_by) REFERENCES dbo.users(id),
    CONSTRAINT FK_conditions_modified_by FOREIGN KEY (modified_by) REFERENCES dbo.users(id),
    
    -- Indexes
    INDEX IX_conditions_sort_order (sort_order),
    INDEX IX_conditions_created_by (created_by)
);

-- ============================================================================
-- GOALS TABLE
-- ============================================================================
-- Yearly goals and monthly sub-goals
CREATE TABLE dbo.goals (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(200) NOT NULL,
    text NVARCHAR(MAX),
    year INT NOT NULL,
    month INT NULL, -- 1-12, NULL for yearly goals, set for monthly sub-goals
    parent_goal_id UNIQUEIDENTIFIER NULL, -- For monthly sub-goals
    condition_id UNIQUEIDENTIFIER NOT NULL,
    priority INT NOT NULL DEFAULT 5, -- 1-10 scale
    is_key_priority BIT NOT NULL DEFAULT 0, -- Top priority flag
    status NVARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, active, completed, on-hold
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    modified_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    created_by UNIQUEIDENTIFIER NOT NULL,
    modified_by UNIQUEIDENTIFIER NOT NULL,
    
    -- Foreign Keys
    CONSTRAINT FK_goals_parent_goal FOREIGN KEY (parent_goal_id) REFERENCES dbo.goals(id),
    CONSTRAINT FK_goals_condition FOREIGN KEY (condition_id) REFERENCES dbo.conditions(id),
    CONSTRAINT FK_goals_created_by FOREIGN KEY (created_by) REFERENCES dbo.users(id),
    CONSTRAINT FK_goals_modified_by FOREIGN KEY (modified_by) REFERENCES dbo.users(id),
    
    -- Constraints
    CONSTRAINT CK_goals_month CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
    CONSTRAINT CK_goals_priority CHECK (priority >= 1 AND priority <= 10),
    CONSTRAINT CK_goals_status CHECK (status IN ('draft', 'active', 'completed', 'on-hold')),
    
    -- Indexes
    INDEX IX_goals_year (year),
    INDEX IX_goals_month (month),
    INDEX IX_goals_condition (condition_id),
    INDEX IX_goals_parent (parent_goal_id),
    INDEX IX_goals_created_by (created_by),
    INDEX IX_goals_priority (priority, is_key_priority),
    INDEX IX_goals_status (status)
);

-- ============================================================================
-- ACTIONS TABLE
-- ============================================================================
-- Actions to complete goals, with week and date assignment
CREATE TABLE dbo.actions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(200) NOT NULL,
    goal_id UNIQUEIDENTIFIER NOT NULL,
    week_number INT NULL, -- 1-52, assigned week
    assigned_date DATE NULL, -- Specific date when pulled into today/tomorrow
    parent_action_id UNIQUEIDENTIFIER NULL, -- For breaking actions into sub-actions
    priority INT NOT NULL DEFAULT 5, -- 1-10 scale
    is_key_priority BIT NOT NULL DEFAULT 0, -- Top priority flag
    status NVARCHAR(20) NOT NULL DEFAULT 'todo', -- todo, in-progress, completed, cancelled
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    modified_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    created_by UNIQUEIDENTIFIER NOT NULL,
    modified_by UNIQUEIDENTIFIER NOT NULL,
    
    -- Foreign Keys
    CONSTRAINT FK_actions_goal FOREIGN KEY (goal_id) REFERENCES dbo.goals(id),
    CONSTRAINT FK_actions_parent_action FOREIGN KEY (parent_action_id) REFERENCES dbo.actions(id),
    CONSTRAINT FK_actions_created_by FOREIGN KEY (created_by) REFERENCES dbo.users(id),
    CONSTRAINT FK_actions_modified_by FOREIGN KEY (modified_by) REFERENCES dbo.users(id),
    
    -- Constraints
    CONSTRAINT CK_actions_week_number CHECK (week_number IS NULL OR (week_number >= 1 AND week_number <= 52)),
    CONSTRAINT CK_actions_priority CHECK (priority >= 1 AND priority <= 10),
    CONSTRAINT CK_actions_status CHECK (status IN ('todo', 'in-progress', 'completed', 'cancelled')),
    
    -- Indexes
    INDEX IX_actions_goal (goal_id),
    INDEX IX_actions_week_number (week_number),
    INDEX IX_actions_assigned_date (assigned_date),
    INDEX IX_actions_parent (parent_action_id),
    INDEX IX_actions_created_by (created_by),
    INDEX IX_actions_priority (priority, is_key_priority),
    INDEX IX_actions_status (status)
);

-- ============================================================================
-- NOTES TABLE
-- ============================================================================
-- Personal notes, research, and quick captures for planning
CREATE TABLE dbo.notes (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX),
    link NVARCHAR(500),
    source NVARCHAR(50) NOT NULL DEFAULT 'manual', -- manual, email, text, link, web
    summary NVARCHAR(1000),
    priority INT NOT NULL DEFAULT 5, -- 1-10 scale
    is_key_priority BIT NOT NULL DEFAULT 0, -- Top priority flag
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    modified_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    created_by UNIQUEIDENTIFIER NOT NULL,
    modified_by UNIQUEIDENTIFIER NOT NULL,
    
    -- Foreign Keys
    CONSTRAINT FK_notes_created_by FOREIGN KEY (created_by) REFERENCES dbo.users(id),
    CONSTRAINT FK_notes_modified_by FOREIGN KEY (modified_by) REFERENCES dbo.users(id),
    
    -- Constraints
    CONSTRAINT CK_notes_priority CHECK (priority >= 1 AND priority <= 10),
    CONSTRAINT CK_notes_source CHECK (source IN ('manual', 'email', 'text', 'link', 'web')),
    
    -- Indexes
    INDEX IX_notes_created_by (created_by),
    INDEX IX_notes_priority (priority, is_key_priority),
    INDEX IX_notes_source (source)
);

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View for yearly goals with condition info
GO
CREATE VIEW vw_yearly_goals AS
SELECT 
    g.id,
    g.name,
    g.text,
    g.year,
    g.priority,
    g.is_key_priority,
    g.status,
    g.created_at,
    g.modified_at,
    g.created_by,
    c.name as condition_name,
    c.sort_order as condition_sort
FROM dbo.goals g
INNER JOIN dbo.conditions c ON g.condition_id = c.id
WHERE g.month IS NULL; -- Yearly goals only

-- View for monthly sub-goals with parent goal info
GO
CREATE VIEW vw_monthly_goals AS
SELECT 
    g.id,
    g.name,
    g.text,
    g.year,
    g.month,
    g.priority,
    g.is_key_priority,
    g.status,
    g.created_at,
    g.modified_at,
    g.created_by,
    pg.name as parent_goal_name,
    c.name as condition_name,
    c.sort_order as condition_sort
FROM dbo.goals g
INNER JOIN dbo.goals pg ON g.parent_goal_id = pg.id
INNER JOIN dbo.conditions c ON g.condition_id = c.id
WHERE g.month IS NOT NULL; -- Monthly sub-goals only

-- View for actions with goal and condition context
GO
CREATE VIEW vw_actions_context AS
SELECT 
    a.id,
    a.name,
    a.week_number,
    a.assigned_date,
    a.priority,
    a.is_key_priority,
    a.status,
    a.created_at,
    a.modified_at,
    a.created_by,
    g.name as goal_name,
    g.year as goal_year,
    g.month as goal_month,
    c.name as condition_name,
    c.sort_order as condition_sort,
    pa.name as parent_action_name
FROM dbo.actions a
INNER JOIN dbo.goals g ON a.goal_id = g.id
INNER JOIN dbo.conditions c ON g.condition_id = c.id
LEFT JOIN dbo.actions pa ON a.parent_action_id = pa.id;
