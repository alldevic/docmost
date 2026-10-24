import { type Kysely, sql } from 'kysely';

// Page search for Russian and English: the 'russian' configuration stems Cyrillic words with the
// Russian stemmer and Latin words with the English one. The trigger fires only when the title or
// the text changes (before, every update of the row, e.g. a move in the tree, rebuilt the vector).
// Existing vectors are rebuilt here: about 3 minutes per 100k pages of 4 KB.
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.tsv :=
                  setweight(to_tsvector('russian', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('russian', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`DROP TRIGGER IF EXISTS pages_tsvector_update ON pages`.execute(db);
  await sql`CREATE TRIGGER pages_tsvector_update BEFORE INSERT OR UPDATE OF title, text_content
            ON pages FOR EACH ROW EXECUTE FUNCTION pages_tsvector_trigger()`.execute(db);

  await sql`
    UPDATE pages SET tsv =
      setweight(to_tsvector('russian', f_unaccent(coalesce(title, ''))), 'A') ||
      setweight(to_tsvector('russian', f_unaccent(substring(coalesce(text_content, ''), 1, 1000000))), 'B')
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.tsv :=
                  setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`DROP TRIGGER IF EXISTS pages_tsvector_update ON pages`.execute(db);
  await sql`CREATE TRIGGER pages_tsvector_update BEFORE INSERT OR UPDATE
            ON pages FOR EACH ROW EXECUTE FUNCTION pages_tsvector_trigger()`.execute(db);

  await sql`
    UPDATE pages SET tsv =
      setweight(to_tsvector('english', f_unaccent(coalesce(title, ''))), 'A') ||
      setweight(to_tsvector('english', f_unaccent(substring(coalesce(text_content, ''), 1, 1000000))), 'B')
  `.execute(db);
}
