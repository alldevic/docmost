import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
        ALTER TABLE workspaces
        ADD COLUMN oidc_enabled BOOLEAN DEFAULT FALSE,
        ADD COLUMN oidc_client_id TEXT,
        ADD COLUMN oidc_client_secret TEXT,
        ADD COLUMN oidc_issuer_url TEXT,
        ADD COLUMN oidc_jit_enabled BOOLEAN DEFAULT FALSE,
        ADD COLUMN oidc_button_name TEXT;
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
        ALTER TABLE workspaces
        DROP COLUMN oidc_enabled,
        DROP COLUMN oidc_client_id,
        DROP COLUMN oidc_client_secret,
        DROP COLUMN oidc_issuer_url,
        DROP COLUMN oidc_jit_enabled,
        DROP COLUMN oidc_button_name
    `.execute(db);
}
