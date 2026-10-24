import { findChildren } from '@tiptap/core';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
// @ts-ignore
import highlight from 'highlight.js/lib/core';

function parseNodes(
  nodes: any[],
  className: string[] = [],
): { text: string; classes: string[] }[] {
  return nodes
    .map((node) => {
      const classes = [
        ...className,
        ...(node.properties ? node.properties.className : []),
      ];

      if (node.children) {
        return parseNodes(node.children, classes);
      }

      return {
        text: node.value,
        classes,
      };
    })
    .flat();
}

function getHighlightNodes(result: any) {
  // `.value` for lowlight v1, `.children` for lowlight v2
  return result.value || result.children || [];
}

function registered(aliasOrLanguage: string) {
  return Boolean(highlight.getLanguage(aliasOrLanguage));
}

// Max characters to sample for auto-detection to avoid performance issues with large code blocks
const AUTO_DETECT_SAMPLE_SIZE = 3000;

// Highlighting of a code block depends only on its node (text and language). ProseMirror
// nodes are immutable, so an unchanged block keeps the same object across transactions, also
// when y-prosemirror rebuilds the whole document for a remote change. Without this cache
// every such change ran lowlight (or auto-detection) over every code block of the page.
type Span = { from: number; to: number; className: string };
const spanCache = new WeakMap<
  ProsemirrorNode,
  { languageCount: number; spans: Span[] }
>();

function highlightSpans(
  node: ProsemirrorNode,
  lowlight: any,
  defaultLanguage: string | null | undefined,
  languages: string[],
): Span[] {
  const cached = spanCache.get(node);
  // a language registered later changes the result for blocks that fell back to auto
  if (cached && cached.languageCount === languages.length) return cached.spans;

  const language = node.attrs.language || defaultLanguage;
  const textContent = node.textContent;

  let nodes;
  if (
    language &&
    (languages.includes(language) ||
      registered(language) ||
      lowlight.registered?.(language))
  ) {
    nodes = getHighlightNodes(lowlight.highlight(language, textContent));
  } else {
    // For auto-detection, sample a limited portion to detect the language,
    // then highlight the full content with the detected language
    const sample =
      textContent.length > AUTO_DETECT_SAMPLE_SIZE
        ? textContent.slice(0, AUTO_DETECT_SAMPLE_SIZE)
        : textContent;
    const autoResult = lowlight.highlightAuto(sample);
    const detectedLanguage = autoResult.data?.language;
    if (detectedLanguage && textContent.length > AUTO_DETECT_SAMPLE_SIZE) {
      nodes = getHighlightNodes(
        lowlight.highlight(detectedLanguage, textContent),
      );
    } else {
      nodes = getHighlightNodes(autoResult);
    }
  }

  const spans: Span[] = [];
  let from = 0;
  parseNodes(nodes).forEach((part) => {
    const to = from + part.text.length;
    if (part.classes.length) {
      spans.push({ from, to, className: part.classes.join(' ') });
    }
    from = to;
  });
  spanCache.set(node, { languageCount: languages.length, spans });
  return spans;
}

function getDecorations({
  doc,
  name,
  lowlight,
  defaultLanguage,
}: {
  doc: ProsemirrorNode;
  name: string;
  lowlight: any;
  defaultLanguage: string | null | undefined;
}) {
  const decorations: Decoration[] = [];
  const languages = lowlight.listLanguages();

  findChildren(doc, (node) => node.type.name === name).forEach((block) => {
    const start = block.pos + 1;
    for (const span of highlightSpans(block.node, lowlight, defaultLanguage, languages)) {
      decorations.push(
        Decoration.inline(start + span.from, start + span.to, {
          class: span.className,
        }),
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function isFunction(param: any): param is Function {
  return typeof param === 'function';
}

export function LowlightPlugin({
  name,
  lowlight,
  defaultLanguage,
}: {
  name: string;
  lowlight: any;
  defaultLanguage: string | null | undefined;
}) {
  if (
    !['highlight', 'highlightAuto', 'listLanguages'].every((api) =>
      isFunction(lowlight[api]),
    )
  ) {
    throw Error(
      'You should provide an instance of lowlight to use the code-block-lowlight extension',
    );
  }

  const lowlightPlugin: Plugin<any> = new Plugin({
    key: new PluginKey('lowlight'),

    state: {
      init: (_, { doc }) =>
        getDecorations({
          doc,
          name,
          lowlight,
          defaultLanguage,
        }),
      apply: (transaction, decorationSet, oldState, newState) => {
        // selection-only transactions (every caret move) leave the highlighting as is;
        // the checks below walk the whole document twice
        if (!transaction.docChanged) {
          return decorationSet;
        }
        const oldNodeName = oldState.selection.$head.parent.type.name;
        const newNodeName = newState.selection.$head.parent.type.name;
        const oldNodes = findChildren(
          oldState.doc,
          (node) => node.type.name === name,
        );
        const newNodes = findChildren(
          newState.doc,
          (node) => node.type.name === name,
        );

        if (
          transaction.docChanged &&
          // Apply decorations if:
          // selection includes named node,
          ([oldNodeName, newNodeName].includes(name) ||
            // OR transaction adds/removes named node,
            newNodes.length !== oldNodes.length ||
            // OR transaction has changes that completely encapsulte a node
            // (for example, a transaction that affects the entire document).
            // Such transactions can happen during collab syncing via y-prosemirror, for example.
            transaction.steps.some((step) => {
              // @ts-ignore
              return (
                // @ts-ignore
                step.from !== undefined &&
                // @ts-ignore
                step.to !== undefined &&
                oldNodes.some((node) => {
                  // @ts-ignore
                  return (
                    // @ts-ignore
                    node.pos >= step.from &&
                    // @ts-ignore
                    node.pos + node.node.nodeSize <= step.to
                  );
                })
              );
            }))
        ) {
          return getDecorations({
            doc: transaction.doc,
            name,
            lowlight,
            defaultLanguage,
          });
        }

        return decorationSet.map(transaction.mapping, transaction.doc);
      },
    },

    props: {
      decorations(state) {
        return lowlightPlugin.getState(state);
      },
    },
  });

  return lowlightPlugin;
}
