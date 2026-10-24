import { type Extensions, getSchema } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';

const schemaCache = new WeakMap<Extensions, Schema>();

// Building the schema from all editor extensions takes about a millisecond, and
// a conversion asks for it several times; the extension lists are module-level
// constants, so build it once per list.
export function getCachedSchema(extensions: Extensions): Schema {
  let schema = schemaCache.get(extensions);
  if (!schema) {
    schema = getSchema(extensions);
    schemaCache.set(extensions, schema);
  }
  return schema;
}
