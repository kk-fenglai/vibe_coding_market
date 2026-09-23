// Ensure DATABASE_URL is read from .env + .env.local before instantiating
// PrismaClient. Scripts that import this file directly (e.g. seedCoDemo.js)
// would otherwise connect to whatever DATABASE_URL was preset in the shell
// — which on this repo defaults to production via the system .env.
require('./config/env');

const { PrismaClient } = require('@prisma/client');

// DEV_DATABASE_URL: shell-provided local-dev override (e.g. the embedded
// Postgres from scripts/dev-db.js). Unlike DATABASE_URL it is never defined
// in .env, so dotenv's override:true cannot clobber it. Unset in production.
const devUrl = process.env.NODE_ENV !== 'production' && process.env.DEV_DATABASE_URL;

const prisma = new PrismaClient({
  ...(devUrl ? { datasources: { db: { url: devUrl } } } : {}),
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

async function disconnect() {
  try { await prisma.$disconnect(); } catch { /* best-effort */ }
}

module.exports = prisma;
module.exports.disconnect = disconnect;
