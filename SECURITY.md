# Security Guidelines

## 🔐 Azure AD Authentication

### Authentication Flow
- **Frontend**: Handles MSAL authentication with Azure AD
- **Backend**: Receives Azure user ID and info via API calls
- **No passwords**: All authentication is handled by Azure AD

### Important Security Practices

1. **Azure AD Integration** - Frontend handles all authentication
2. **User headers** - Backend expects `x-user-id` in API headers
3. **Admin impersonation** - Via `x-view-as-user` header
4. **Database security** - Azure SQL with connection pooling

## 🛡️ Environment Variables

### Required Environment Variables
```bash
DB_PASSWORD=your_actual_database_password_here
FRONTEND_URL=http://localhost:8080
```

### Development Setup
1. Copy `local.settings.json.template` to `local.settings.json`
2. Replace `*** REDACTED FOR SECURITY ***` with the actual database password
3. Never commit `local.settings.json` with real passwords

## 🚨 Security Checklist

- [ ] Database password not in source control
- [ ] Azure AD authentication properly configured on frontend
- [ ] CORS properly configured for production domains
- [ ] Environment variables used for sensitive data
- [ ] SSL/TLS enabled for production database connections

## 🔑 Azure AD User Management

- Users are created automatically when they first authenticate via Azure AD
- User roles can be managed through the admin endpoints
- No passwords stored - all authentication via Azure AD
- Admin users can impersonate other users via headers

## 📝 Notes

- Frontend must handle MSAL authentication and pass Azure user info to backend
- Backend creates/updates users based on Azure AD data
- Use Azure Key Vault or similar for production secrets
- No password-based authentication - Azure AD only
