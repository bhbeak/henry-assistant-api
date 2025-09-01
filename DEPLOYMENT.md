# Deployment Configuration

## GitHub Workflow Overview

The workflow has been adapted for backend API deployment to Azure App Service:

- **Test Environment**: Deploys from `test` branch to `henry-assistant-api-test` App Service
- **Production Environment**: Deploys from `main` branch to `henry-assistant-api-prod` App Service
- **Build Process**: Compiles TypeScript (`npm run build`), creates production deployment package
- **Deploy Package**: Includes compiled JavaScript from `dist/`, production dependencies, and supporting files

## Required Azure App Services

Create these Azure App Services:
1. **henry-assistant-api-test** - For test environment
2. **henry-assistant-api-prod** - For production environment

## Required GitHub Secrets

Add these secrets to your GitHub repository:

### App Service Publish Profiles
- `AZURE_API_TEST_PUBLISH_PROFILE` - Download from henry-assistant-api-test App Service
- `AZURE_API_PROD_PUBLISH_PROFILE` - Download from henry-assistant-api-prod App Service

### How to Get Publish Profiles
1. Go to Azure Portal → App Services → [Your App Service]
2. Click "Get publish profile" to download the `.publishsettings` file
3. Copy the entire contents of the file
4. Add as a GitHub secret with the name above

## Deployment Process

Following the copilot instructions for preserving commit messages:

### Deploy to Test
```bash
# Commit and push to test branch triggers workflow
git add . && git commit -m "your descriptive change message" && git push origin test
```

### Promote to Production
```bash
# Promote to production preserving commit message
COMMIT_MSG=$(git log --format=%B -n 1 HEAD)
git checkout main && git merge test --no-ff -m "$COMMIT_MSG" && git push origin main && git checkout test
```

## Azure App Service Configuration

### Runtime Settings
- **Node.js Version**: 20.x
- **Startup Command**: `node dist/src/index.js`
- **Platform**: Linux

### Environment Variables
Set these in Azure App Service → Configuration → Application settings:

#### Database Configuration
- `DB_SERVER` - Your Azure SQL server name
- `DB_NAME` - Database name  
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password

#### Azure AD Configuration
- `AZURE_TENANT_ID` - Your Azure AD tenant ID
- `AZURE_CLIENT_ID` - Your app registration client ID
- `AZURE_CLIENT_SECRET` - Your app registration client secret

#### Other Settings
- `PORT` - Set to `8080` (Azure default)
- `NODE_ENV` - Set to `production` for prod, `test` for test

## File Structure After Build

The deployment package includes:
```
api.zip
├── routes/           # Compiled route handlers
├── middleware/       # Compiled middleware
├── config/          # Compiled configuration
├── utils/           # Compiled utilities  
├── index.js         # Main entry point
├── db.js           # Database connection
├── package.json     # Dependencies list
└── node_modules/    # Production dependencies
```

## Adding Staging Environment Later

When ready to add staging:
1. Update workflow to include `staging` branch in triggers
2. Add staging case to environment determination
3. Create `henry-assistant-api-staging` App Service
4. Add `AZURE_API_STAGING_PUBLISH_PROFILE` secret
5. Update publish profile logic to handle staging

## Troubleshooting

### Common Issues
- **Build Failures**: Check TypeScript compilation errors
- **Deploy Failures**: Verify publish profile is correct and App Service exists
- **Runtime Errors**: Check App Service logs and environment variables

### Logs
- GitHub Actions: Check workflow run logs
- Azure: App Service → Log stream or Monitoring → Logs
