import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// Stamps the built asset filenames into the service worker's precache list.
//
// Caching assets lazily as they're requested doesn't actually work: on a first visit the
// bundle is fetched before the worker has activated, so it never passes through the
// worker and never lands in the cache — the app then loads to a blank page offline.
// Vite content-hashes these filenames, so the list can only be known after the build.
function serviceWorkerPrecache(): Plugin {
  return {
    name: 'vv-sw-precache',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      const swPath = path.join(outDir, 'sw.js');
      const assetsDir = path.join(outDir, 'assets');
      if (!fs.existsSync(swPath) || !fs.existsSync(assetsDir)) return;

      const base = process.env.BASE_PATH || '/';
      const assets = fs
        .readdirSync(assetsDir)
        .filter((f) => /\.(js|css)$/.test(f))
        .map((f) => `${base}assets/${f}`);

      const sw = fs
        .readFileSync(swPath, 'utf8')
        .replace('/*__VV_PRECACHE__*/[]', JSON.stringify(assets));
      fs.writeFileSync(swPath, sw);
      console.log(`  service worker precaching ${assets.length} assets`);
    },
  };
}

export default defineConfig(() => {
  return {
    // GitHub Pages serves project sites from a /<repo-name>/ subpath, so asset URLs
    // need that prefix baked in at build time. Set BASE_PATH=/VinylVault/ when building
    // for GitHub Pages (the deploy workflow does this); defaults to "/" everywhere else
    // (Netlify, Vercel, custom domains, local dev) where the site is served from the root.
    base: process.env.BASE_PATH || '/',
    plugins: [react(), tailwindcss(), serviceWorkerPrecache()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
