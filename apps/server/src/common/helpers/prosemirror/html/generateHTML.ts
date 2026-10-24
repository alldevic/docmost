import { type Extensions, type JSONContent } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import { getHTMLFromFragment } from './getHTMLFromFragment';
import { getCachedSchema } from '../schema';

/**
 * This function generates HTML from a ProseMirror JSON content object.
 *
 * @param doc - The ProseMirror JSON content object.
 * @param extensions - The Tiptap extensions used to build the schema.
 * @returns The generated HTML string.
 * @example
 * ```js
 * const html = generateHTML(doc, extensions)
 * console.log(html)
 * ```
 */
export function generateHTML(doc: JSONContent, extensions: Extensions): string {
  if (typeof window !== 'undefined') {
    throw new Error(
      'generateHTML can only be used in a Node environment\nIf you want to use this in a browser environment, use the `@tiptap/html` import instead.',
    );
  }

  const schema = getCachedSchema(extensions);
  const contentNode = Node.fromJSON(schema, doc);

  return getHTMLFromFragment(contentNode, schema);
}
