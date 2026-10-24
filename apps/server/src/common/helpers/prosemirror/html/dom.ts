import { Element, parseHTML } from 'linkedom';
import { parse, serialize } from 'parse5';

// linkedom returns "" for a missing class attribute where the DOM spec returns
// null, so ProseMirror parse rules would store class: "" on marks like links.
const getAttribute = Element.prototype.getAttribute;
Element.prototype.getAttribute = function (name: string) {
  if (name === 'class' && !this.hasAttribute(name)) {
    return null;
  }
  return getAttribute.call(this, name);
};

// linkedom returns undefined for unset style properties where CSSOM returns "",
// so rules like `element.style.backgroundColor` would yield null instead of "".
const styleGetter = Object.getOwnPropertyDescriptor(Element.prototype, 'style').get;
Object.defineProperty(Element.prototype, 'style', {
  configurable: true,
  get() {
    return new Proxy(styleGetter.call(this), {
      get(style, name) {
        const value = Reflect.get(style, name);
        return value === undefined && typeof name === 'string' ? '' : value;
      },
    });
  },
});

export function createHtmlDocument(bodyHtml = ''): Document {
  let html = `<!DOCTYPE html><html><body>${bodyHtml}</body></html>`;
  if (bodyHtml) {
    // linkedom's parser does not implement HTML5 tree construction: it keeps
    // attribute name case (colSpan), adds no tbody and leaves misnested tags.
    // Re-serialising through parse5 gives it the tree a browser would build.
    html = serialize(parse(html));
  }
  const { document } = parseHTML(html);
  return document as unknown as Document;
}
