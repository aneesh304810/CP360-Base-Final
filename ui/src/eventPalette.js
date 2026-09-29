// Event 360's palette, in a module of its own.
//
// IT LIVED IN Event360.jsx AND THAT WAS A CYCLE. Event360 imports the
// Commit boundary tab; the tab imported the palette back from Event360 and
// read it at module top level. Whichever module the bundler evaluates
// first, the other's constants are still in the temporal dead zone --
// "Cannot access 'P' before initialization", at runtime, in the browser.
// esbuild resolves the cycle happily at build time and says nothing.
//
// A shared constant that two modules need belongs to neither of them.
// The mockup's palette, so the module reads as one system with Lineage 360.
export const P = {
  ink: '#233240', sub: '#7b8894', rule: '#c9d4dc', page: '#f4f7f9',
  panel: '#fff', link: '#31bced', accent: '#0f4775', ok: '#159943',
  warn: '#e67e22', warnInk: '#a8560f', danger: '#c1113a', tint: '#eef3f8',
  mono: '"Roboto Mono",ui-monospace,SFMono-Regular,Menlo,monospace',
  // sequential, one hue, magnitude only
  s: ['#e4edf5', '#c3d8e9', '#9dbdd8', '#3a6f9e', '#0f4775'],
};
// categorical — event type. Three slots, validated all-pairs (CVD dE 9.2,
// normal-vision 24.0). Never cycled, never reused for anything else.
export const TC = { Business: '#2a78d6', Technical: '#eb6834', Marker: '#1baf7a' };
// ordered severity, not categories; every chip carries its word as well
const BC = { Critical: '#c1113a', High: '#e67e22', Moderate: '#3a6f9e', Low: '#7b8894' };

