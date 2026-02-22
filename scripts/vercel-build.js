// On Vercel: use Postgres schema (SQLite not supported on serverless).
// Locally: use default SQLite schema.
const { execSync } = require('child_process');
const schema = process.env.VERCEL ? 'prisma/schema.postgres.prisma' : 'prisma/schema.prisma';
execSync(`npx prisma generate --schema=${schema}`, { stdio: 'inherit' });
execSync('npx next build', { stdio: 'inherit' });
