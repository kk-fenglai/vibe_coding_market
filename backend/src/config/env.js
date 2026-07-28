// Startup environment validation. Import at the top of src/index.js so the
// process fails fast (exit 1) if anything critical is missing or dangerously
// weak. Never ship to production without a .env that passes this check.
//
// IMPORTANT: load backend/.env regardless of current working directory.
// Users sometimes start the server from repo root (e.g. `node backend/src/index.js`),
// which would otherwise make dotenv look for <repo>/.env and miss backend/.env.
const path = require('path');
const fs = require('fs');
require('dotenv').config({
  override: true,
  path: path.resolve(__dirname, '../../.env'),
});

// Local override (gitignored). Useful for pointing DATABASE_URL at a dev
// Neon branch without editing the production .env. Loaded AFTER .env so its
// values win.
const localEnv = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(localEnv)) {
  require('dotenv').config({ override: true, path: localEnv });
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

const errors = [];
const warnings = [];

function requireEnv(key, { minLength = 1, prodOnly = false } = {}) {
  if (prodOnly && !IS_PROD) return;
  const val = process.env[key];
  if (!val) {
    errors.push(`Missing required env: ${key}`);
    return;
  }
  if (val.length < minLength) {
    errors.push(`Env ${key} too short (need >= ${minLength} chars, got ${val.length})`);
  }
}

requireEnv('DATABASE_URL');
requireEnv('JWT_ACCESS_SECRET', { minLength: 32 });
requireEnv('JWT_REFRESH_SECRET', { minLength: 32 });
requireEnv('FRONTEND_URL');

// Background workers (auto-confirm etc.). Default ON in production, OFF in
// dev — prevents a local `npm run dev` from competing with production when
// DATABASE_URL is shared.
const RUN_BG_WORKERS = process.env.RUN_BG_WORKERS != null
  ? process.env.RUN_BG_WORKERS === 'true'
  : IS_PROD;
if (!IS_PROD && RUN_BG_WORKERS) {
  warnings.push('RUN_BG_WORKERS=true in development — workers will compete with production if DATABASE_URL is shared');
}

// Hard-block boilerplate placeholder secrets from .env.example
const placeholderMatchers = [/^change_?me/i, /xxx+/i];
['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].forEach((k) => {
  const v = process.env[k] || '';
  if (placeholderMatchers.some((r) => r.test(v))) {
    errors.push(`Env ${k} looks like the .env.example placeholder — generate a real secret with: openssl rand -hex 48`);
  }
  if (process.env.JWT_ACCESS_SECRET && process.env.JWT_REFRESH_SECRET
      && process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    if (k === 'JWT_REFRESH_SECRET') {
      errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
    }
  }
});

// Production: require SMTP + admin initial password changed + not the default super-admin password
if (IS_PROD) {
  ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].forEach((k) => requireEnv(k));
  if (process.env.ALLOW_PROD_SEED === 'true') {
    warnings.push('ALLOW_PROD_SEED=true in production — seed script will run and may recreate demo accounts');
  }
  if (!process.env.ADMIN_IP_ALLOWLIST) {
    warnings.push('ADMIN_IP_ALLOWLIST is empty in production — consider whitelisting admin IPs');
  }
}

// Escrow provider: MOCK (wallet ledger simulation) today; STRIPE_CONNECT later.
const ESCROW_PROVIDER = (process.env.ESCROW_PROVIDER || 'MOCK').toUpperCase();
if (IS_PROD && ESCROW_PROVIDER === 'MOCK') {
  warnings.push('ESCROW_PROVIDER=MOCK in production — deposits/withdrawals are simulated, no real money moves');
}

if (errors.length) {
  // eslint-disable-next-line no-console
  console.error('\n❌ FATAL: environment configuration invalid:\n  - ' + errors.join('\n  - ') + '\n');
  // eslint-disable-next-line no-console
  console.error('Fix the above in .env (see .env.example) and restart.\n');
  process.exit(1);
}

if (warnings.length) {
  // eslint-disable-next-line no-console
  console.warn('\n⚠️  env warnings:\n  - ' + warnings.join('\n  - ') + '\n');
}

module.exports = {
  NODE_ENV,
  IS_PROD,
  PORT: Number(process.env.PORT || 4000),
  LOG_LEVEL: process.env.LOG_LEVEL || (IS_PROD ? 'info' : 'debug'),
  FRONTEND_URL: process.env.FRONTEND_URL,
  RUN_BG_WORKERS,
  ESCROW_PROVIDER,
};
