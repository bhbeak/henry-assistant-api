# Henry Assistant Planning API Documentation

## Authentication

All planning endpoints require authentication via the `x-user-id` header containing the Azure AD user ID.

```javascript
headers: {
  'x-user-id': 'azure-ad-user-guid',
  'Content-Type': 'application/json'
}
```

## Base URL

- **Local**: `http://localhost:3000/api`
- **Test**: `https://henry-assistant-api-test.azurewebsites.net/api`
- **Production**: `https://henry-assistant-api.azurewebsites.net/api`

---

## Conditions API

**Base Path**: `/api/conditions`

Conditions represent the core areas of life management (Money, Career, Activity, Relationship).

### GET /api/conditions
List all conditions for the authenticated user.

**Query Parameters:**
- `status` (optional): Filter by status (`active`, `paused`, `completed`)

**Response:**
```json
{
  "conditions": [
    {
      "id": "guid",
      "name": "Money",
      "description": "Financial strategy and wealth building",
      "status": "active",
      "priority": 1,
      "created_at": "2024-01-01T00:00:00.000Z",
      "modified_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /api/conditions/:id
Get a specific condition by ID.

### POST /api/conditions
Create a new condition.

**Request Body:**
```json
{
  "name": "Career",
  "description": "Professional development and content strategy",
  "status": "active",
  "priority": 2
}
```

### PUT /api/conditions/:id
Update an existing condition.

### DELETE /api/conditions/:id
Delete a condition (only if no associated goals exist).

---

## Goals API

**Base Path**: `/api/goals`

Goals are specific objectives within each condition, organized hierarchically.

### GET /api/goals
List goals with filtering and pagination.

**Query Parameters:**
- `condition_id` (optional): Filter by condition
- `parent_goal_id` (optional): Filter by parent goal
- `status` (optional): Filter by status
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "goals": [
    {
      "id": "guid",
      "condition_id": "guid",
      "parent_goal_id": null,
      "name": "Reach $1M Net Worth",
      "description": "Build wealth through investments and income growth",
      "status": "active",
      "priority": 1,
      "target_date": "2025-12-31",
      "created_at": "2024-01-01T00:00:00.000Z",
      "modified_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "pages": 1
  }
}
```

### GET /api/goals/:id
Get a specific goal by ID.

### GET /api/goals/:id/sub-goals
Get all sub-goals for a specific goal.

### POST /api/goals
Create a new goal.

**Request Body:**
```json
{
  "condition_id": "guid",
  "parent_goal_id": null,
  "name": "Save $50k Emergency Fund",
  "description": "Build emergency fund for financial security",
  "status": "active",
  "priority": 1,
  "target_date": "2024-12-31"
}
```

### PUT /api/goals/:id
Update an existing goal.

### DELETE /api/goals/:id
Delete a goal (only if no associated actions or sub-goals exist).

---

## Actions API

**Base Path**: `/api/actions`

Actions are specific tasks that move goals forward, assignable to specific weeks/dates.

### GET /api/actions
List actions with filtering and pagination.

**Query Parameters:**
- `goal_id` (optional): Filter by goal
- `parent_action_id` (optional): Filter by parent action
- `status` (optional): Filter by status (`to_do`, `in_progress`, `on_hold`, `completed`)
- `assigned_week` (optional): Filter by week (YYYY-WW format)
- `assigned_date` (optional): Filter by date (YYYY-MM-DD format)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "actions": [
    {
      "id": "guid",
      "goal_id": "guid",
      "parent_action_id": null,
      "name": "Open high-yield savings account",
      "description": "Research and open account with 4%+ APY",
      "status": "to_do",
      "priority": 1,
      "assigned_week": "2024-15",
      "assigned_date": "2024-04-15",
      "estimated_duration_minutes": 60,
      "created_at": "2024-01-01T00:00:00.000Z",
      "modified_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "pages": 2
  }
}
```

### GET /api/actions/:id
Get a specific action by ID.

### GET /api/actions/:id/sub-actions
Get all sub-actions for a specific action.

### GET /api/actions/week/:week
Get all actions assigned to a specific week (YYYY-WW format).

### GET /api/actions/date/:date
Get all actions assigned to a specific date (YYYY-MM-DD format).

### POST /api/actions
Create a new action.

**Request Body:**
```json
{
  "goal_id": "guid",
  "parent_action_id": null,
  "name": "Research investment platforms",
  "description": "Compare Fidelity, Vanguard, and Schwab features",
  "status": "to_do",
  "priority": 2,
  "assigned_week": "2024-16",
  "assigned_date": "2024-04-20",
  "estimated_duration_minutes": 120
}
```

### PUT /api/actions/:id
Update an existing action.

### PUT /api/actions/:id/assign-week
Assign action to a specific week.

**Request Body:**
```json
{
  "week": "2024-17"
}
```

### PUT /api/actions/:id/assign-date
Assign action to a specific date.

**Request Body:**
```json
{
  "date": "2024-04-25"
}
```

### PUT /api/actions/:id/status
Update action status.

**Request Body:**
```json
{
  "status": "in_progress"
}
```

### DELETE /api/actions/:id
Delete an action (only if no sub-actions exist).

---

## Notes API

**Base Path**: `/api/notes`

Notes capture research, ideas, and quick thoughts for planning and reference.

### GET /api/notes
List notes with filtering and pagination.

**Query Parameters:**
- `search` (optional): Search in name, description, and summary
- `source` (optional): Filter by source (`manual`, `url`, `voice`, etc.)
- `is_key_priority` (optional): Filter key priority items (`true`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "notes": [
    {
      "id": "guid",
      "name": "Investment Strategy Article",
      "description": "Comprehensive guide to index fund investing",
      "link": "https://example.com/article",
      "source": "url",
      "summary": "Key points about low-cost index funds and diversification",
      "priority": 8,
      "is_key_priority": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "modified_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "pages": 3
  }
}
```

### GET /api/notes/:id
Get a specific note by ID.

### POST /api/notes
Create a new note.

**Request Body:**
```json
{
  "name": "Golf Training Schedule",
  "description": "Weekly practice routine for improving short game",
  "link": "https://golfdigest.com/training",
  "source": "manual",
  "summary": "Focus on putting and chipping 3x per week",
  "priority": 6,
  "is_key_priority": false
}
```

### POST /api/notes/quick-capture
Quick capture note from URL or text.

**Request Body:**
```json
{
  "content": "https://linkedin.com/pulse/great-article OR just text content",
  "source_type": "url"
}
```

**Response:**
```json
{
  "id": "guid",
  "name": "Auto-generated name",
  "description": "Original content",
  "link": "extracted URL if applicable",
  "source": "url",
  "summary": "Auto-generated summary",
  "priority": 5,
  "is_key_priority": false,
  "created_at": "2024-01-01T00:00:00.000Z",
  "modified_at": "2024-01-01T00:00:00.000Z"
}
```

### PUT /api/notes/:id
Update an existing note.

### DELETE /api/notes/:id
Delete a note.

---

## Common Patterns

### Error Responses
All endpoints return consistent error responses:

```json
{
  "error": "Descriptive error message"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing x-user-id header)
- `404` - Not Found
- `500` - Internal Server Error

### Pagination
List endpoints support pagination with consistent format:

**Query Parameters:**
- `page` - Page number (1-based, default: 1)
- `limit` - Items per page (default: 20)

**Response Format:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Date Formats
- **Dates**: ISO 8601 format (`YYYY-MM-DD`)
- **Weeks**: ISO week format (`YYYY-WW`)
- **Timestamps**: ISO 8601 with timezone (`2024-01-01T00:00:00.000Z`)

### Status Values
- **Conditions**: `active`, `paused`, `completed`
- **Goals**: `active`, `paused`, `completed`
- **Actions**: `to_do`, `in_progress`, `on_hold`, `completed`

## Usage Examples

### Creating a Complete Planning Structure

1. **Create Condition:**
```javascript
const condition = await fetch('/api/conditions', {
  method: 'POST',
  headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Money',
    description: 'Financial wealth building strategy',
    status: 'active',
    priority: 1
  })
});
```

2. **Create Goal:**
```javascript
const goal = await fetch('/api/goals', {
  method: 'POST',
  headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    condition_id: condition.id,
    name: 'Build Emergency Fund',
    description: 'Save 6 months of expenses',
    status: 'active',
    priority: 1,
    target_date: '2024-12-31'
  })
});
```

3. **Create Action:**
```javascript
const action = await fetch('/api/actions', {
  method: 'POST',
  headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    goal_id: goal.id,
    name: 'Open savings account',
    description: 'Research high-yield savings options',
    status: 'to_do',
    priority: 1,
    assigned_date: '2024-04-15',
    estimated_duration_minutes: 60
  })
});
```

### Daily Planning Workflow

**Get Today's Actions:**
```javascript
const today = new Date().toISOString().split('T')[0];
const todayActions = await fetch(`/api/actions/date/${today}`, {
  headers: { 'x-user-id': userId }
});
```

**Update Action Status:**
```javascript
await fetch(`/api/actions/${actionId}/status`, {
  method: 'PUT',
  headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'completed' })
});
```

**Quick Capture Note:**
```javascript
await fetch('/api/notes/quick-capture', {
  method: 'POST',
  headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'https://interesting-article.com/financial-planning',
    source_type: 'url'
  })
});
```
