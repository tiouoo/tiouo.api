import express from 'express';
import { readdirSync, statSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const apiDir = __dirname;

function shouldIgnore(filename) {
  const ignorePatterns = ['index.js', '@index.js', '.js.bak', '.backup.js'];
  return ignorePatterns.includes(filename);
}

function getApiFiles(dir, basePath = '') {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    try {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        const subFiles = getApiFiles(fullPath, join(basePath, entry));
        files.push(...subFiles);
      } else if (extname(entry) === '.js' && !shouldIgnore(entry)) {
        const relativePath = join(basePath, basename(entry, '.js'));
        files.push({ relativePath });
      }
    } catch {
      continue;
    }
  }

  return files;
}

function getPrefixFromPath(relativePath) {
  const segments = relativePath.split(/[/\\]/);
  const routeSegments = segments
    .map((seg) => {
      if (seg === 'index') return '';
      return seg;
    })
    .filter(Boolean);
  return routeSegments.join('/');
}

async function createRouter() {
  const router = express.Router();

  const apiFiles = getApiFiles(apiDir);

  for (const { relativePath } of apiFiles) {
    const modulePath = `./${relativePath.replace(/\\/g, '/')}.js`;

    if (modulePath.includes('..')) {
      console.warn(`[Router] Skipping invalid path: ${modulePath}`);
      continue;
    }

    try {
      const module = await import(modulePath);

      if (module && module.default) {
        const prefix = getPrefixFromPath(relativePath);
        const routePath = prefix ? `/${prefix}` : '';

        router.use(routePath, module.default);
        console.log(`[Router] Mounted ${relativePath} -> /api${routePath}`);
      } else if (module) {
        console.warn(`[Router] ${relativePath} has no default export, skipping`);
      }
    } catch (err) {
      console.error(`[Router] Failed to load ${relativePath}:`, err.message);
    }
  }

  return router;
}

let routerInstance = null;

const initRouter = (async () => {
  routerInstance = await createRouter();
  return routerInstance;
})();

export default initRouter;
