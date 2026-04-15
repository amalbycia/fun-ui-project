import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    // wasm-doom uses fetch() internally to load its .wasm binary.
    // Pre-bundling rewrites paths and breaks that — exclude it completely.
    exclude: ['wasm-doom'],
  },
  // No COEP/COOP headers needed — wasm-doom does NOT use SharedArrayBuffer.
  // Adding those headers would block the WASM fetch. Leave server config plain.
});
