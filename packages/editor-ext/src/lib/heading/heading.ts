import TiptapHeading, {
  HeadingOptions as TiptapHeadingOptions,
} from "@tiptap/extension-heading";
import { mergeAttributes } from "@tiptap/react";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey, Transaction } from "@tiptap/pm/state";
import { Node as PMNode } from "@tiptap/pm/model";
import { copyToClipboard } from "../utils";

const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><!-- Icon from Material Symbols Light by Google - https://github.com/google/material-design-icons/blob/master/LICENSE --><path fill="currentColor" d="M10.616 16.077H7.077q-1.692 0-2.884-1.192T3 12t1.193-2.885t2.884-1.193h3.539v1H7.077q-1.27 0-2.173.904Q4 10.731 4 12t.904 2.173t2.173.904h3.539zM8.5 12.5v-1h7v1zm4.885 3.577v-1h3.538q1.27 0 2.173-.904Q20 13.269 20 12t-.904-2.173t-2.173-.904h-3.538v-1h3.538q1.692 0 2.885 1.192T21 12t-1.193 2.885t-2.884 1.193z"/></svg>`;
const successIcon = `<svg xmlns="http://www.w3.org/2000/svg" style="color: forestgreen;" width="18" height="18" viewBox="0 0 24 24"><!-- Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE --><path fill="currentColor" d="m10.6 16.6l7.05-7.05l-1.4-1.4l-5.65 5.65l-2.85-2.85l-1.4 1.4zM12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22"/></svg>`;

// Copy-link button after each heading. One stable toDOM function, so ProseMirror keeps the
// widget DOM across updates instead of redrawing every heading on every keystroke.
function createLinkButton(): HTMLElement {
  const icon = document.createElement("span");
  icon.classList.add("link-btn");
  icon.innerHTML = "&nbsp;";
  icon.contentEditable = "false";

  const linkBtnContent = document.createElement("span");
  linkBtnContent.classList.add("link-btn-content");
  linkBtnContent.innerHTML = copyIcon;
  icon.appendChild(linkBtnContent);

  icon.addEventListener("mousedown", (e) => e.preventDefault());
  icon.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    // the heading element carries the node id (see renderHTML)
    const id = icon.closest("h1, h2, h3, h4, h5, h6")?.id;
    const baseUrl = window.location.href.split("#")[0];
    copyToClipboard(`${baseUrl}#${id}`);
    linkBtnContent.innerHTML = successIcon;
    setTimeout(() => (linkBtnContent.innerHTML = copyIcon), 2000);
  });

  return icon;
}

function buildLinkDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "heading" && node.content.size > 1) {
      decorations.push(
        Decoration.widget(pos + node.nodeSize - 1, createLinkButton, {
          side: 1, // render after node content
          key: "heading-link",
        }),
      );
    }
    // inline content holds no headings
    return !node.isTextblock;
  });
  return DecorationSet.create(doc, decorations);
}

// Does the transaction touch a heading (edited, added, removed, emptied)?
function touchesHeading(tr: Transaction): boolean {
  let touched = false;
  tr.mapping.maps.forEach((stepMap, i) => {
    if (touched) return;
    const rest = tr.mapping.slice(i + 1);
    stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
      if (touched) return;
      const from = Math.max(0, rest.map(newStart, -1));
      const to = Math.min(tr.doc.content.size, rest.map(newEnd, 1));
      tr.doc.nodesBetween(from, to, (node) => {
        if (node.type.name === "heading") touched = true;
        return !touched && !node.isTextblock;
      });
    });
  });
  return touched;
}

const headingLinkKey = new PluginKey<DecorationSet>("headingLink");

export const Heading = TiptapHeading.extend<TiptapHeadingOptions>({
  // @ts-ignore
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: headingLinkKey,
        state: {
          init: (_, { doc }) => buildLinkDecorations(doc),
          apply(tr, set) {
            if (!tr.docChanged) return set;
            return touchesHeading(tr)
              ? buildLinkDecorations(tr.doc)
              : set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return headingLinkKey.getState(state);
          },
        },
      }),
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const hasLevel = this.options.levels.includes(node.attrs.level);
    const level = hasLevel ? node.attrs.level : this.options.levels[0];

    return [
      `h${level}`,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        id: node.attrs.id,
      }),
      0,
    ];
  },
});
