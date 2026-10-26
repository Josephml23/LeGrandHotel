/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import JavaScriptObfuscator from 'javascript-obfuscator'

/**
 * EXTRA "cifrar el código": ofusca el bundle final de producción.
 * Se aplica al chunk ya generado (renderChunk) para que funcione con cualquier bundler de Vite.
 * `npm run build:plain` genera el build sin ofuscar para comparar el antes/después.
 */
function obfuscate(): Plugin {
  return {
    name: 'legrandhotel-obfuscate',
    apply: 'build',
    renderChunk(code, chunk) {
      if (!chunk.fileName.endsWith('.js')) return null
      const result = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        splitStrings: true,
        splitStringsChunkLength: 8,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        selfDefending: false,
        sourceMap: false,
      })
      return { code: result.getObfuscatedCode(), map: null }
    },
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', '')
  const shouldObfuscate = command === 'build' && mode !== 'plain' && env.VITE_OBFUSCATE !== 'false'

  return {
    plugins: [react(), shouldObfuscate && obfuscate()].filter(Boolean),
    server: { port: 5173 },
    preview: { port: 4173 },
    build: { sourcemap: false },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }
})
