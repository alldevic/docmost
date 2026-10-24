import type katexType from "katex";

// KaTeX (~250 KB) is loaded with the first formula, not with the app.
let katexPromise: Promise<typeof katexType> | null = null;

export function loadKatex(): Promise<typeof katexType> {
  return (katexPromise ??= Promise.all([
    import("katex"),
    import("katex/dist/katex.min.css"),
  ]).then(([m]) => m.default));
}
