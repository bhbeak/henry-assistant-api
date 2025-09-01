# Henry Assistant API

A prod4. **Test Health Check**
   ```bash
   curl http://localhost:3000/health
   ```on-ready Node.js/TypeScript backend for Henry Assistant - an AI-powered conversational assistant with Azure SQL, authentication, and advanced features.

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp local.settings.json.template local.settings.json
   # Edit local.settings.json with your Azure SQL credentials
   ```

3. **Set up Database**
   ```bash
   # Run the database schema script in your Azure SQL database
   # See database/schema.sql for the complete Henry database structure
   ```

4. **Run Development Server**
   ```bash
   npm run build
   npm run dev
   ```

5. **Test Health Check**
   ```bash
   curl http://localhost:3001/health
   ```

## 🏗️ Architecture

- **Express.js** with TypeScript
- **Azure SQL** with connection pooling and retry logic
- **Argon2** password hashing
- **CORS** protection
- **Admin impersonation** middleware
- **Health monitoring** endpoints
- **Conversation management** for AI chats
- **User preferences** and customization
- **Knowledge base** for document uploads
- **Usage tracking** for analytics

## 📁 Project Structure

```
src/
├── config/
│   └── database.ts          # Azure SQL configuration
├── middleware/
│   └── viewAsMiddleware.ts   # Admin impersonation
├── routes/
│   ├── health.ts            # Health checks
│   └── userAuth.ts          # Authentication
├── utils/
│   └── loadLocalSettings.ts # Environment loader
├── db.ts                    # Connection pool
└── index.ts                 # Main Express app
```

## 🔧 Environment Variables

See `local.settings.json.template` for all required environment variables.

Key variables:
- `DB_SERVER` - Azure SQL server name
- `DB_DATABASE` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `FRONTEND_URL` - CORS allowed origin

## 🔒 Security Features

- **Parameterized SQL queries** prevent injection
- **Argon2 password hashing** (stronger than bcrypt)
- **Admin View As** functionality with audit trails
- **CORS protection** with configurable origins
- **Environment separation** (never commit credentials)

## 🗃️ Database Setup

Create a basic users table to get started:

```sql
CREATE TABLE dbo.users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(200) UNIQUE NOT NULL,
    full_name NVARCHAR(200),
    password_hash NVARCHAR(200) NOT NULL,
    role NVARCHAR(50) DEFAULT 'user',
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE()
);
```

## 📝 Customization

1. **Update database schema references** in `src/routes/userAuth.ts`
2. **Modify role system** in `src/middleware/viewAsMiddleware.ts`
3. **Add your business logic routes** to `src/index.ts`
4. **Configure deployment** for your Azure environment

## 📋 Available Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Run development server with hot reload
- `npm run start` - Run production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests (add your test framework)

## 🚀 Deployment

This template is Azure Functions ready. Configure your deployment pipeline to:

1. Build the TypeScript code
2. Set environment variables in Azure App Settings
3. Deploy to Azure Functions or App Service

## 📖 Additional Resources

See the main [AZURE-BACKEND-STARTER-CHECKLIST.md](../AZURE-BACKEND-STARTER-CHECKLIST.md) for comprehensive setup instructions and architecture details.
