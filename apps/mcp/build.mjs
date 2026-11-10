// Empacota o servidor MCP em um único arquivo .mjs sem dependências (só precisa de Node 18+).
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const apiUrl = process.env.ORBITASK_API_URL ?? 'https://task-manager-production-8ff8.up.railway.app/api/v1'

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/orbitask-mcp.mjs',
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  minify: false,
  legalComments: 'eof',
  banner: { js: "#!/usr/bin/env node\nimport { createRequire as __orbitaskRequire } from 'node:module';\nconst require = __orbitaskRequire(import.meta.url);" },
  define: { __ORBITASK_MCP_VERSION__: JSON.stringify(version), __ORBITASK_DEFAULT_API_URL__: JSON.stringify(apiUrl) },
})
console.log(`dist/orbitask-mcp.mjs (v${version}) → ${apiUrl}`)
