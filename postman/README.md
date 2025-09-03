# Henry Assistant Planning API - Postman Collection

This directory contains Postman collection and environment files for testing the Henry Assistant Planning API.

## 📁 Files Included

### Collection
- `henry-assistant-planning-api.postman_collection.json` - Complete API collection with all endpoints

### Environments
- `henry-assistant-local.postman_environment.json` - Local development environment
- `henry-assistant-test.postman_environment.json` - Test/staging environment  
- `henry-assistant-production.postman_environment.json` - Production environment

## 🚀 Quick Start

### 1. Import Collection
1. Open Postman
2. Click **Import** 
3. Select `henry-assistant-planning-api.postman_collection.json`
4. Collection will appear in your workspace

### 2. Import Environment(s)
1. Click **Import** again
2. Select the environment file(s) you need:
   - Local: `henry-assistant-local.postman_environment.json`
   - Test: `henry-assistant-test.postman_environment.json`
   - Production: `henry-assistant-production.postman_environment.json`

### 3. Configure Environment
1. Select your environment from the dropdown (top right)
2. Click the **eye icon** to view/edit environment variables
3. **IMPORTANT**: Update the `userId` variable with your actual Azure AD user GUID

## 🔧 Environment Variables

Each environment includes these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `baseUrl` | API base URL | `http://localhost:3000` |
| `userId` | Your Azure AD user GUID | `12345678-1234-1234-1234-123456789012` |
| `adminUserId` | Admin user GUID for admin operations | `admin-guid-here` |
| `targetUserId` | Target user ID for user management | Auto-populated from responses |
| `conditionId` | Condition ID for testing | Auto-populated from responses |
| `goalId` | Goal ID for testing | Auto-populated from responses |
| `actionId` | Action ID for testing | Auto-populated from responses |
| `noteId` | Note ID for testing | Auto-populated from responses |

## 📋 Testing Workflow

### 1. Basic Health Check
Start with these requests to verify API connectivity:
- **Health Check** → `GET /`
- **Database Test** → `GET /test-db`
- **Auth Health Check** → `GET /api/user-auth/health`

### 2. Authentication Flow
Test the authentication system:

1. **Azure Login** → `POST /api/user-auth/azure-login`
   - Simulates frontend MSAL authentication
   - Creates or updates user record

2. **Validate Session** → `POST /api/user-auth/validate-session`
   - Verifies user session is valid

3. **Get My Profile** → `GET /api/users/profile`
   - Retrieves current user's profile information

### 3. Create Planning Structure
### 3. Create Planning Structure
Follow this order to build a complete planning structure:

1. **Create Condition** → `POST /api/conditions`
   - Creates a life area (Money, Career, etc.)
   - Copy the returned `id` to `conditionId` variable

2. **Create Goal** → `POST /api/goals` 
   - Links to the condition
   - Copy the returned `id` to `goalId` variable

3. **Create Action** → `POST /api/actions`
   - Links to the goal
   - Copy the returned `id` to `actionId` variable

4. **Create Note** → `POST /api/notes`
   - Independent knowledge capture
   - Copy the returned `id` to `noteId` variable

### 4. Test CRUD Operations
For each entity type, test:
- **List** (GET with filters)
- **Get by ID** (GET specific item)
- **Update** (PUT)
- **Delete** (DELETE)

### 5. Test User Management
For user management operations:
- **List Users** (Admin only)
- **Create User** (Admin only)
- **Update User** (Admin only)
- **Delete User** (Admin only)

### 6. Test Special Features
- **Sub-Goals**: Create goals with `parent_goal_id`
- **Sub-Actions**: Create actions with `parent_action_id`
- **Week/Date Assignment**: Use assign-week and assign-date endpoints
- **Status Updates**: Use status-specific endpoints
- **Quick Capture**: Test URL and text capture for notes

## 🔐 Authentication

All planning endpoints require the `x-user-id` header:

```
x-user-id: your-azure-ad-user-guid
```

This is automatically included in all requests using the `{{userId}}` variable.

## 📊 Example Test Scenarios

### Authentication Workflow
1. **Azure Login**: `POST /api/user-auth/azure-login`
2. **Get Profile**: `GET /api/users/profile`
3. **Update Profile**: `PUT /api/users/profile`

### Daily Planning Workflow
1. **Get Today's Actions**: `GET /api/actions/date/2025-09-03`
2. **Update Action Status**: `PUT /api/actions/{{actionId}}/status`
3. **Quick Capture Note**: `POST /api/notes/quick-capture`

### Weekly Planning Workflow  
1. **Get Week's Actions**: `GET /api/actions/week/2025-36`
2. **Assign Actions to Days**: `PUT /api/actions/{{actionId}}/assign-date`
3. **Create New Actions**: `POST /api/actions`

### Monthly Planning Workflow
1. **List All Goals**: `GET /api/goals`
2. **Create Monthly Actions**: `POST /api/actions`
3. **Review Progress**: Various GET endpoints with filters

## 🛠️ Troubleshooting

### Common Issues

**401 Unauthorized**
- Check that `userId` variable is set correctly
- Verify the `x-user-id` header is included

**404 Not Found**  
- Verify the ID variables are set correctly
- Check that the resource exists and belongs to your user

**500 Internal Server Error**
- Check server logs
- Verify database connection
- Ensure all required fields are provided

### Environment-Specific Notes

**Local Development**
- Make sure your local server is running (`npm run dev`)
- Database must be running and accessible
- Check `local.settings.json` configuration

**Test Environment**
- Verify the test URL is correct
- Check Azure deployment status
- Database might be different from local

**Production Environment**
- Use carefully - this affects real data
- Consider using a dedicated test user account
- Always test in lower environments first

## 📚 Additional Resources

- [API Documentation](../docs/planning-api.md) - Complete API reference
- [Database Schema](../database/planning-schema.sql) - Database structure
- [Backend README](../README.md) - Development setup guide

## 🔄 Updating the Collection

When the API changes:
1. Export the updated collection from Postman
2. Replace the existing `.json` file
3. Update this README if needed
4. Commit changes to the repository

## 💡 Tips

- Use **Test** tab in requests to automatically set variables from responses
- Use **Pre-request Script** tab for dynamic data generation
- Save frequently used values as environment variables
- Use **Runner** for automated testing sequences
- Export results for sharing with team members
