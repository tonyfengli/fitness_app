/**
 * opentype.js 1.3.4 ships no types; this covers the parts src/lib/celebrations/text.ts uses.
 * Pinned to 1.3.4 on purpose: 2.0.0 returned NaN x-coordinates for some Montserrat glyphs
 * ('f', 'p'), which cut the card text off mid-word.
 */
declare module "opentype.js" {
  export interface Path {
    toPathData(decimals?: number): string;
  }
  export interface Font {
    getPath(text: string, x: number, y: number, fontSize: number): Path;
    getAdvanceWidth(text: string, fontSize: number): number;
    names: { fontFamily?: Record<string, string> };
  }
  const opentype: { parse(buffer: ArrayBuffer): Font };
  export default opentype;
}
