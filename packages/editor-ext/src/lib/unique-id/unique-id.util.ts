import type { Extensions, JSONContent } from "@tiptap/core";
import { getSchema } from "@tiptap/core";
import { Node, Schema } from "@tiptap/pm/model";
import type { UniqueID } from "./unique-id";

const schemaCache = new WeakMap<Extensions, Schema>();

/**
 * Creates a new document with unique IDs added to the nodes. Does the same
 * thing as the UniqueID extension, but without the need to create an `Editor`
 * instance. This lets you add unique IDs to the document in the server.
 *
 * When you call it, include the `UniqueID` extension in the `extensions` array.
 * The configuration from the `UniqueID` extension will be picked up
 * automatically, including its configuration options like `types` and
 * `attributeName`.
 *
 * @see `UniqueID` extension for more information.
 *
 * @throws {Error} If the `UniqueID` extension is not found in the extensions array.
 *
 * @example
 * const doc = {
 *   type: 'doc',
 *   content: [
 *     { type: 'paragraph', content: [{ type: 'text', text: 'Hello, world!' }] }
 *   ]
 * }
 * const newDoc = addUniqueIds(doc, [StarterKit, UniqueID.configure({ types: ['paragraph', 'heading'] })])
 * console.log(newDoc)
 * // Result:
 * // {
 * //   type: 'doc',
 * //   content: [
 * //     { type: 'paragraph', content: [{ type: 'text', text: 'Hello, world!' }], id: '123' }
 * //   ]
 * // }
 *
 * @param doc - A Tiptap JSON document to add unique IDs to.
 * @param extensions - The extensions to use. Must include the `UniqueID` extension.
 * @returns The updated Tiptap JSON document, with the unique IDs added to the nodes.
 */
export function addUniqueIdsToDoc(
  doc: JSONContent,
  extensions: Extensions,
): JSONContent {
  // Find the UniqueID extension in the extensions array. If it's not found, throw an error.
  const uniqueIDExtension = extensions.find(
    (ext) => ext.name === "uniqueID",
  ) as typeof UniqueID | undefined;
  if (!uniqueIDExtension) {
    throw new Error("UniqueID extension not found in the extensions array");
  }
  const { types, attributeName, generateID } = uniqueIDExtension.options;

  // Convert the JSON content to a ProseMirror node
  let schema = schemaCache.get(extensions);
  if (!schema) {
    schema = getSchema([
      ...extensions.filter((ext) => ext.name !== "uniqueID"),
      uniqueIDExtension,
    ]);
    schemaCache.set(extensions, schema);
  }
  const contentNode = Node.fromJSON(schema, doc);
  const result = contentNode.toJSON();

  // Set IDs on the JSON copy while walking the node tree in parallel. A
  // transaction step per node would rebuild the document each time, which is
  // quadratic on large documents.
  const assignIds = (node: Node, json: JSONContent, contentStart: number) => {
    node.forEach((child, offset, index) => {
      const pos = contentStart + offset;
      const childJson = json.content[index];
      if (!child.attrs[attributeName] && types.includes(child.type.name)) {
        childJson.attrs = {
          ...childJson.attrs,
          [attributeName]: generateID({ node: child, pos }),
        };
      }
      assignIds(child, childJson, pos + 1);
    });
  };
  assignIds(contentNode, result, 0);

  return result;
}
