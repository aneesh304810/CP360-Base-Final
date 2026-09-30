import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";

// MERMAID IS OPTIONAL, AND THE TOOLING HAS TO AGREE.
//
// DocDrill renders diagrams with `mermaid` through a dynamic import, and
// MermaidBlock already falls back to the diagram source when that import
// rejects -- deliberately, so the catalogue still builds and runs on a
// host that cannot reach the registry. Vite did not know that. Without
// the package installed, `npm run build` failed outright and the dev
// server returned a 500 for DocDrill.jsx, which takes out the whole Doc
// Drill screen rather than one diagram.
//
// Marking it external is not enough on its own: it quiets the dependency
// scanner but vite:import-analysis still refuses to resolve the bare
// specifier, and that is the 500. So when the package is absent the
// import is pointed at a stub module that throws on evaluation -- which
// is exactly the rejection MermaidBlock is already written to catch.
//
//   present -> nothing happens here. Bundled and pre-bundled as usual.
//   absent  -> stubbed. Diagrams show their source with a caption;
//              everything else on the page works.
//
// `npm install mermaid` (from Nexus inside the BBH network) turns the
// diagrams on with no config change.
const require = createRequire(import.meta.url);
let hasMermaid = true;
try {
  require.resolve("mermaid");
} catch {
  hasMermaid = false;
}

const STUB = "\0mermaid-not-installed";

function optionalMermaid() {
  return {
    name: "cp360:optional-mermaid",
    // Rollup convention: a leading \0 marks an id no other plugin and no
    // filesystem lookup should touch.
    resolveId(id) {
      return id === "mermaid" ? STUB : null;
    },
    load(id) {
      if (id !== STUB) return null;
      // Throwing on evaluation is the point: import("mermaid") rejects,
      // MermaidBlock catches it and renders the diagram source. The
      // message is what a developer sees in the console if they wonder
      // why.
      return 'throw new Error("mermaid is not installed - run '
           + '`npm install mermaid` in ui/ to render diagrams");';
    },
  };
}

if (!hasMermaid) {
  console.warn(
    "[vite] mermaid is not installed - DocDrill will show diagram source\n" +
    "       instead of rendered diagrams. `npm install mermaid` to enable them.");
}

export default defineConfig({
  plugins: [react(), ...(hasMermaid ? [] : [optionalMermaid()])],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  optimizeDeps: { exclude: hasMermaid ? [] : ["mermaid"] },
  build: { outDir: "dist", sourcemap: false },
});
