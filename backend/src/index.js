// Boot order matters: env validation MUST run before anything else imports
// from process.env (prisma, jwt, etc).
const env = require('./config/env');
const { logger, httpLogger } = require('./utils/logger');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const prisma = require('./prisma');
const { ipAllowlist } = require('./middleware/admin');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// ─────────────────────────────────────────────────────────────────────────
// CORE 平台模块（M1 鉴权 / M3 后台 / M6 反馈）—— 复用骨架，保留
// ─────────────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const passwordResetRoutes = require('./routes/passwordReset');
const userRoutes = require('./routes/user');
const feedbackRoutes = require('./routes/feedback');
const adminAuthRoutes = require('./routes/adminAuth');
const adminUserRoutes = require('./routes/adminUsers');
const adminStatsRoutes = require('./routes/adminStats');
const adminFeedbackRoutes = require('./routes/adminFeedback');

// ═════════════════════════════════════════════════════════════════════════
// ↓↓↓ BuilderHub marketplace 模块 require —— 后续阶段在此追加 ↓↓↓
// ═════════════════════════════════════════════════════════════════════════
const projectRoutes = require('./routes/projects');
const applicationRoutes = require('./routes/applications');
const builderRoutes = require('./routes/builders');
const escrowRoutes = require('./routes/escrow');
const reviewRoutes = require('./routes/reviews');
const conversationRoutes = require('./routes/conversations');
const adminProjectRoutes = require('./routes/adminProjects');
const adminDisputeRoutes = require('./routes/adminDisputes');
const adminBuilderRoutes = require('./routes/adminBuilders');
const autoConfirmWorker = require('./workers/autoConfirm');
// ═════════════════════════════════════════════════════════════════════════
// ↑↑↑ BuilderHub require 结束 ↑↑↑
// ═════════════════════════════════════════════════════════════════════════

const app = express();

app.set('trust proxy', 1);

// --- Security headers (M7) ---
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", env.FRONTEND_URL],
        mediaSrc: ["'self'", 'https:', 'blob:'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: env.IS_PROD ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: env.IS_PROD ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
  })
);

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// gzip JSON/text responses.
app.use(compression());

app.use(express.json({ limit: '2mb' }));
app.use(httpLogger);

// --- Rate limiters (M7) ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please retry later' },
});
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin login attempts' },
});
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests' },
});
const adminApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
// 任务发布/编辑等写操作；GET（任务市场浏览）不计数。
const marketplaceWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
  message: { error: '操作过于频繁，请稍后再试' },
});
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '提交过于频繁，请稍后再试' },
});

// --- Health (M7) ---
app.get('/api/health', async (_req, res) => {
  const health = { status: 'ok', service: 'builderhub-backend', ts: Date.now(), db: 'unknown' };
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.db = 'ok';
  } catch (e) {
    health.status = 'degraded';
    health.db = 'error';
  }
  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

// ═════════════════════════════════════════════════════════════════════════
// CORE 公开 API（M1 鉴权 / M6 反馈）
// ═════════════════════════════════════════════════════════════════════════
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth', passwordResetLimiter, passwordResetRoutes);
app.use('/api/user', userRoutes);
app.use('/api/feedback', feedbackLimiter, feedbackRoutes);

// ═════════════════════════════════════════════════════════════════════════
// ADMIN API（M3 后台）—— ipAllowlist 之后是各后台子路由
// ═════════════════════════════════════════════════════════════════════════
app.use('/api/admin', ipAllowlist);
app.use('/api/admin/auth', adminLoginLimiter, adminAuthRoutes);
app.use('/api/admin/users', adminApiLimiter, adminUserRoutes);
app.use('/api/admin/stats', adminApiLimiter, adminStatsRoutes);
app.use('/api/admin/feedback', adminApiLimiter, adminFeedbackRoutes);
app.use('/api/admin/projects', adminApiLimiter, adminProjectRoutes);
app.use('/api/admin/disputes', adminApiLimiter, adminDisputeRoutes);
app.use('/api/admin/builders', adminApiLimiter, adminBuilderRoutes);

// ═════════════════════════════════════════════════════════════════════════
// ↓↓↓ BuilderHub marketplace 挂载 —— 后续阶段在此追加 ↓↓↓
// 放在 admin 之后：部分路由挂在 /api 根，避免其限流器计入 admin 写操作。
// ═════════════════════════════════════════════════════════════════════════
// 浏览不限流，写操作限流（防刷审核队列）。
app.use('/api/projects', marketplaceWriteLimiter, projectRoutes);
// 申请/托管/评价/私信路由横跨 /projects/:id/* 与各自资源根路径，挂在 /api 根。
app.use('/api', marketplaceWriteLimiter, applicationRoutes);
app.use('/api', marketplaceWriteLimiter, escrowRoutes);
app.use('/api', marketplaceWriteLimiter, reviewRoutes);
app.use('/api', marketplaceWriteLimiter, conversationRoutes);
app.use('/api/builders', marketplaceWriteLimiter, builderRoutes);
// ═════════════════════════════════════════════════════════════════════════
// ↑↑↑ BuilderHub 挂载结束 ↑↑↑
// ═════════════════════════════════════════════════════════════════════════

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'backend started');
  if (env.RUN_BG_WORKERS) {
    // ↓↓↓ BuilderHub worker —— 后续阶段在此追加 ↓↓↓
    autoConfirmWorker.start();   // 交付超时自动确认放款（PRD 6.6）
    // ↑↑↑ BuilderHub worker 结束 ↑↑↑
  } else {
    logger.info('RUN_BG_WORKERS=false — background workers not started');
  }
});

// --- Graceful shutdown (M7) ---
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'graceful shutdown initiated');
  server.close(async (err) => {
    if (err) logger.error({ err }, 'error while closing http server');
    if (env.RUN_BG_WORKERS) {
      // ↓↓↓ BuilderHub worker drain —— 后续阶段在此追加 ↓↓↓
      // ↑↑↑ BuilderHub worker drain 结束 ↑↑↑
    }
    await prisma.disconnect();
    logger.info('shutdown complete');
    process.exit(err ? 1 : 0);
  });
  setTimeout(() => {
    logger.error('force exit after shutdown timeout');
    process.exit(1);
  }, 15000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandledRejection');
  shutdown('unhandledRejection');
});
