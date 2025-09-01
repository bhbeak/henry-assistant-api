/**
 * Environment loader for backend app
 * Loads environment variables from local.settings.json when running locally
 */

import * as fs from 'fs';
import * as path from 'path';

export function loadLocalSettings(): void {
  // Only load local.settings.json in development/local environment
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const localSettingsPath = path.join(process.cwd(), 'local.settings.json');
  
  if (fs.existsSync(localSettingsPath)) {
    try {
      const localSettings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
      
      if (localSettings.Values) {
        // Load all values from local.settings.json into process.env
        Object.assign(process.env, localSettings.Values);
        console.log('✅ Loaded environment variables from local.settings.json');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load local.settings.json:', error);
    }
  } else {
    console.warn('⚠️ local.settings.json not found, using system environment variables');
  }
}
