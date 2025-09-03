// Load environment variables from local.settings.json first
import { loadLocalSettings } from './utils/loadLocalSettings';
loadLocalSettings();

import cors from 'cors';
import express from 'express';
import { pool } from './db';
import morgan from 'morgan';

const app = express();
app.use(express.json());

const allowedOrigin = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:8080'
].filter((origin): origin is string => typeof origin === 'string' && origin.length > 0);

if (allowedOrigin.length === 0) {
  throw new Error('FRONTEND_URL must be set in local.settings.json');
}

app.use(cors({ origin: allowedOrigin }));
// now only the exact URL in FRONTEND_URL can call your API

app.use(morgan('dev')); // or 'combined' for more detail
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  if (req.body) console.log('Body:', req.body);
  next();
});

const port = process.env.PORT ?? 3000;

// Azure Authentication Routes
import authRouter from './routes/userAuth';
app.use('/api/user-auth', authRouter);
console.log('🔐 Mounting authRouter at /api/user-auth');

// View As middleware for admin impersonation - applies to all routes
import { viewAsMiddleware } from './middleware/viewAsMiddleware';
app.use(viewAsMiddleware);
console.log('👁️ View As middleware enabled for admin impersonation');

// Henry Assistant API Routes
import conversationsRouter from './routes/conversations';
app.use('/api/conversations', conversationsRouter);
console.log('💬 Mounting conversationsRouter at /api/conversations');

import preferencesRouter from './routes/preferences';
app.use('/api/preferences', preferencesRouter);
console.log('⚙️ Mounting preferencesRouter at /api/preferences');

import promptsRouter from './routes/prompts';
app.use('/api/prompts', promptsRouter);
console.log('📝 Mounting promptsRouter at /api/prompts');

import usageRouter from './routes/usage';
app.use('/api/usage', usageRouter);
console.log('📊 Mounting usageRouter at /api/usage');

import adminRouter from './routes/admin';
app.use('/api/admin', adminRouter);
console.log('🛠️ Mounting adminRouter at /api/admin');

import usersRouter from './routes/users';
app.use('/api/users', usersRouter);
console.log('👤 Mounting usersRouter at /api/users');

// Planning System Routes
import conditionsRouter from './routes/conditions';
app.use('/api/conditions', conditionsRouter);
console.log('🎯 Mounting conditionsRouter at /api/conditions');

import goalsRouter from './routes/goals';
app.use('/api/goals', goalsRouter);
console.log('📈 Mounting goalsRouter at /api/goals');

import actionsRouter from './routes/actions';
app.use('/api/actions', actionsRouter);
console.log('✅ Mounting actionsRouter at /api/actions');

import notesRouter from './routes/notes';
app.use('/api/notes', notesRouter);
console.log('📝 Mounting notesRouter at /api/notes');

// 2) Simple root check
app.get('/', (_req, res) => {
  res.send('API is up! 🚀');
});

// 3) Health‐check endpoints with database monitoring
import healthRouter from './routes/health';
app.use('/health', healthRouter);

// 4) Test DB connectivity
app.get('/test-db', async (_req, res) => {
  try {
    const db = await pool;
    const result = await db.request().query('SELECT GETDATE() AS now');
    res.json({ serverTime: result.recordset[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB test failed', details: err });
  }
});

// TODO: Add your application-specific routes here
// Example:
// import usersRouter from './routes/users';
// app.use('/users', usersRouter);

app.listen(port, () => {
  console.log(`⚡️ Server listening on http://localhost:${port}`);
});
