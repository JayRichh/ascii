// Copies the static site into dist/ and bakes the Giphy key into the browser module.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const key = process.env.GIPHY_API_KEY || '';
if (!key) console.warn('GIPHY_API_KEY not set: the GIF browser will show an error');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/src/js', { recursive: true });
for (const f of ['index.html', 'main.js', 'gif.worker.js', 'favicon.svg', 'favicon-16x16.png', 'favicon-32x32.png',
  'apple-touch-icon.png', 'site.webmanifest', 'preview.png', 'robots.txt', 'sitemap.xml', 'src/styles']) {
  cpSync(f, `dist/${f}`, { recursive: true });
}
cpSync('src/js/ascii.js', 'dist/src/js/ascii.js');
writeFileSync('dist/src/js/gifBrowser.js',
  readFileSync('src/js/gifBrowser.js', 'utf8').replace('__GIPHY_API_KEY__', key));
console.log('built dist/');
