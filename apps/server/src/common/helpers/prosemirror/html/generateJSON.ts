import type { Extensions } from '@tiptap/core';
import { type ParseOptions, DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { getCachedSchema } from '../schema';
import { createHtmlDocument } from './dom';

/**
 * Generates a JSON object from the given HTML string and converts it into a Prosemirror node with content.
 * @remarks Uses `linkedom` as the DOM implementation: it parses several times faster than `happy-dom`.
 * @param {string} html - The HTML string to be converted into a Prosemirror node.
 * @param {Extensions} extensions - The extensions to be used for generating the schema.
 * @param {ParseOptions} options - The options to be supplied to the parser.
 * @returns {Record<string, any>} - The generated JSON object.
 * @example
 * const html = '<p>Hello, world!</p>'
 * const extensions = [...]
 * const json = generateJSON(html, extensions)
 * console.log(json) // { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello, world!' }] }] }
 */
export function generateJSON(
  html: string,
  extensions: Extensions,
  options?: ParseOptions,
): Record<string, any> {
  if (typeof window !== 'undefined') {
    throw new Error(
      'generateJSON can only be used in a Node environment\nIf you want to use this in a browser environment, use the `@tiptap/html` import instead.',
    );
  }

  const doc = createHtmlDocument(html);

  return PMDOMParser.fromSchema(getCachedSchema(extensions))
    .parse(doc.body as unknown as Node, options)
    .toJSON();
}
