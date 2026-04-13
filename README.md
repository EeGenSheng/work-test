# Work Test

Next.js 16.1.6 workspace with TypeScript, TailwindCSS, Ant Design, PostgreSQL, AWS S3, OpenAI, and the required dependency set.

## Setup

1. Install Node.js v24.14.0.
2. Run `npm install`.
4. Run database migrations with `npm run migrate`.
5. Start the app with `npm run dev`.

## Database Migrations

- Migration files live in `db/migrations` and are committed to git.
- Apply pending migrations: `npm run migrate`
- Create a new migration file: `npm run migrate:new -- add_descriptive_name`

Recommended deployment order:
1. Set `DATABASE_URL` for the environment.
2. Run `npm run migrate`.
3. Deploy/start the app.

## GitHub Actions Deployment

- Workflow file: `.github/workflows/deploy-with-migrations.yml`
- Triggered on push to `main` and manual `workflow_dispatch`.
- Runs `npm ci`, then `npm run migrate`, then `npm run build`.

Required repository secret:
- `DATABASE_URL`: PostgreSQL connection string used during the migration step.

## Stack

- Next.js 16.1.6
- TypeScript
- TailwindCSS
- PostgreSQL via `pg` and `kysely`
- AWS S3-ready environment variables
- OpenAI-ready environment variables
