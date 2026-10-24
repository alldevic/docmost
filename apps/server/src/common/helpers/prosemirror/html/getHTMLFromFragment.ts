import type { Node, Schema } from '@tiptap/pm/model';
import { DOMSerializer } from '@tiptap/pm/model';
import { createHtmlDocument } from './dom';

/**
 * Returns the HTML string representation of a given document node.
 *
 * @remarks Uses `linkedom` as the DOM implementation when no document is passed.
 * @param doc - The document node to serialize.
 * @param schema - The Prosemirror schema to use for serialization.
 * @returns A promise containing the HTML string representation of the document fragment.
 *
 * @example
 * ```typescript
 * const html = getHTMLFromFragment(doc, schema)
 * ```
 */
export function getHTMLFromFragment(
  doc: Node,
  schema: Schema,
  options?: { document?: Document },
): string {
  if (options?.document) {
    const wrap = options.document.createElement('div');

    DOMSerializer.fromSchema(schema).serializeFragment(
      doc.content,
      { document: options.document },
      wrap,
    );
    return wrap.innerHTML;
  }

  return getHTMLFromFragment(doc, schema, { document: createHtmlDocument() });
}
