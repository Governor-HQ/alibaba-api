// scripts/run-sql.mjs
//
// Reusable migration runner. Usage:
//   node scripts/run-sql.mjs <path-to.sql>
//
// Connects to Postgres using DATABASE_URL, splits the .sql file into individual
// statements, and runs them all inside a SINGLE transaction: COMMIT only if
// every statement succeeds, otherwise ROLLBACK and print the exact error.
//
// DATABASE_URL is read from the process env if present, else from a local
// .env.local / .env file (no dotenv dependency). The secret is never printed —
// only the connection hostname is shown so you can confirm the target database.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pkg from 'pg';

const { Client } = pkg;

// ── Load DATABASE_URL without leaking it ──────────────────────────────────
function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const name of ['.env.local', '.env']) {
    const p = path.resolve(process.cwd(), name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
      if (key !== 'DATABASE_URL') continue;
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  return null;
}

// ── Split SQL into statements, respecting strings / dollar-quotes / comments ─
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  const n = sql.length;
  let inSingle = false;      // inside '...'
  let inDollar = false;      // inside $tag$...$tag$
  let dollarTag = '';

  while (i < n) {
    const ch = sql[i];
    const two = sql.slice(i, i + 2);

    if (!inSingle && !inDollar) {
      // line comment --...\n
      if (two === '--') {
        const nl = sql.indexOf('\n', i);
        i = nl === -1 ? n : nl;
        continue;
      }
      // block comment /* ... */
      if (two === '/*') {
        const end = sql.indexOf('*/', i + 2);
        i = end === -1 ? n : end + 2;
        continue;
      }
      // start of dollar-quote  $tag$
      if (ch === '$') {
        const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
        if (m) {
          inDollar = true;
          dollarTag = m[0];
          current += dollarTag;
          i += dollarTag.length;
          continue;
        }
      }
      if (ch === "'") { inSingle = true; current += ch; i++; continue; }
      if (ch === ';') { statements.push(current); current = ''; i++; continue; }
      current += ch; i++; continue;
    }

    if (inSingle) {
      // '' is an escaped quote inside a string
      if (ch === "'" && sql[i + 1] === "'") { current += "''"; i += 2; continue; }
      if (ch === "'") { inSingle = false; current += ch; i++; continue; }
      current += ch; i++; continue;
    }

    // inDollar
    if (sql.startsWith(dollarTag, i)) {
      current += dollarTag;
      i += dollarTag.length;
      inDollar = false;
      dollarTag = '';
      continue;
    }
    current += ch; i++;
  }
  if (current.trim()) statements.push(current);
  return statements.map(s => s.trim()).filter(Boolean);
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: node scripts/run-sql.mjs <path-to.sql>');
    process.exit(1);
  }
  const sqlPath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`);
    process.exit(1);
  }

  const connectionString = loadDatabaseUrl();
  if (!connectionString) {
    console.error('DATABASE_URL not found in env or .env.local / .env — aborting. (No connection string was guessed.)');
    process.exit(1);
  }

  // Show only the hostname (+ port / db name) — never user, password, or full URL.
  let hostLabel = '(unparseable host)';
  try {
    const u = new URL(connectionString);
    hostLabel = `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname || ''}`;
  } catch { /* leave placeholder */ }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = splitStatements(sql);

  console.log(`Connecting to host: ${hostLabel}`);
  console.log(`File: ${path.basename(sqlPath)} — ${statements.length} statement(s) to run in one transaction.`);

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query('BEGIN');
    for (let s = 0; s < statements.length; s++) {
      const stmt = statements[s];
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 70);
      process.stdout.write(`  [${s + 1}/${statements.length}] ${preview}${stmt.length > 70 ? '…' : ''}\n`);
      await client.query(stmt);
    }
    await client.query('COMMIT');
    console.log('✅ COMMIT — all statements succeeded.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ROLLBACK — a statement failed. No changes were applied.');
    console.error(`Error: ${err.message}`);
    if (err.position) console.error(`Position: ${err.position}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
