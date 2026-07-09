import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const assetsRoot = path.resolve(projectRoot, 'src/assets')

// Dev-only API the plot editor (usePlotMapEngine's persist()) posts to, so
// label/delete/add edits land straight in the village's -plots.json - the
// same file scripts/extract_plot_map.py writes - instead of localStorage,
// where the Python pipeline, git, and anyone else opening the project would
// never see them.
function savePlotsPlugin(): Plugin {
  return {
    name: 'save-plots-json',
    configureServer(server) {
      server.middlewares.use('/api/save-plots', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', async () => {
          try {
            const { relPath, plots } = JSON.parse(body)
            if (typeof relPath !== 'string' || !Array.isArray(plots)) {
              throw new Error('expected { relPath: string, plots: array }')
            }
            const target = path.resolve(projectRoot, relPath)
            if (target !== assetsRoot && !target.startsWith(assetsRoot + path.sep)) {
              throw new Error('refusing to write outside src/assets/')
            }
            if (!target.endsWith('.json')) {
              throw new Error('refusing to write a non-.json file')
            }
            await fs.writeFile(target, JSON.stringify(plots, null, 2))
            res.statusCode = 200
            res.end('ok')
          } catch (err) {
            res.statusCode = 400
            res.end(String(err))
          }
        })
      })
    },
    // The endpoint above writes into src/assets/**, which Vite's watcher
    // then sees and would otherwise push as an HMR update - forcing a full
    // page reload for JSON imports and dropping the current pan/zoom/
    // selection. Returning [] here skips *notifying the client*, but Vite
    // still invalidates its module cache first (that happens before this
    // hook runs), so the plots.json import still serves fresh content on
    // the next explicit reload - unlike ignoring the path from the watcher
    // entirely, which would leave Vite serving a stale cached copy forever.
    handleHotUpdate({ file }) {
      if (file.startsWith(assetsRoot + path.sep) && file.endsWith('.json')) {
        return []
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), savePlotsPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    globals: true,
    css: false,
  },
})
