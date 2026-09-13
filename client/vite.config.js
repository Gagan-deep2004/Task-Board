import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GITHUB_PAGES_BASE is set by the deploy workflow to "/<repo-name>/" since a
// GitHub Pages project site is served from a subpath. Defaults to "/" for
// local dev and for hosts that serve from the domain root.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE || '/',
})
