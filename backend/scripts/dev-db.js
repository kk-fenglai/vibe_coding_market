// Local dev database — embedded PostgreSQL, no system install required.
// Usage: node scripts/dev-db.js   (keeps running; Ctrl+C to stop)
// Connection: postgresql://postgres:postgres@localhost:5433/builderhub
const EmbeddedPostgres = require('embedded-postgres').default || require('embedded-postgres');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '.pgdata');
const PORT = 5433;

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
    // Windows initdb defaults to WIN1252 — force UTF8 so Chinese text can be stored.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  const fs = require('fs');
  if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
    console.log('[dev-db] initializing data dir...');
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase('builderhub');
  } catch (e) {
    // already exists on subsequent runs
  }
  console.log(`[dev-db] PostgreSQL ready: postgresql://postgres:postgres@localhost:${PORT}/builderhub`);

  const stop = async () => {
    console.log('[dev-db] stopping...');
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error('[dev-db] failed:', e);
  process.exit(1);
});
