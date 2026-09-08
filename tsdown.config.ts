import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: { index: 'src/host.ts', typert: 'src/typert.ts', remote: 'src/remote.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    fixedExtension: false,
    dts: false,
    external: [/^@deepseek-ai\//, /^@deepseek-ai\/cordis/],
  },
  {
    entry: { client: 'src/client.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    fixedExtension: false,
    dts: false,
    external: [/^@deepseek-ai\//, /^react($|\/)/],
    deps: { alwaysBundle: ['zod'] },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "llm-inspector", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
