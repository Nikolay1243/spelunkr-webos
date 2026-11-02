// Make the packaged app self-contained: pull every font it uses into dist/ and
// rewrite app.css to point at local files.
//
// Why: the upstream CSS takes all typography from the network - two Google Fonts
// @imports plus @font-face rules pointing at https://spelunkr.tv/fonts/... with
// font-display:block. On a TV that means requests after first paint (measured: the
// last one landing 9.6s in, forcing a reflow during playback), a blank-text window,
// and a hard failure when the CDN is slow or blocked. The upstream bundle also
// waits up to 2500ms on document.fonts.load() for the Star faces.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function get(url) {
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

export async function localizeFonts(dir = 'dist') {
  const cssPath = join(dir, 'app.css');
  let css = await readFile(cssPath, 'utf8');
  const before = css.length;
  let files = 0;
  let bytes = 0;

  async function save(folder, name, url) {
    const target = join(dir, folder, name);
    if (await exists(target)) return;
    const body = await get(url);
    await mkdir(join(dir, folder), { recursive: true });
    await writeFile(target, body);
    files += 1;
    bytes += body.length;
  }

  // 1. The Star4000/Star3000 faces the CSS already references by absolute URL.
  const starUrls = [...new Set([...css.matchAll(/url\((https:\/\/spelunkr\.tv\/(fonts\/star4000\/[A-Za-z0-9._-]+\.woff2))\)/g)].map(m => m[1]))];
  for (const url of starUrls) {
    const name = url.split('/').pop();
    await save('fonts/star4000', name, url);
    css = css.split(`url(${url})`).join(`url(fonts/star4000/${name})`);
  }

  // 2. The Google Fonts @imports: fetch the real CSS, keep the latin subset of each
  //    face, inline the faces against local files and drop the imports.
  const imports = [...css.matchAll(/@import\s*"(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"\s*;?/g)].map(m => m[1]);
  let localFaces = '';
  for (const url of imports) {
    const body = (await get(url)).toString('utf8');
    for (const block of body.split('@font-face').slice(1).map(b => ('@font-face' + b.trim()))) {
      const range = (block.match(/unicode-range:([^;}]+)/) || [])[1] || '';
      if (range && !/U\+0000-00FF/i.test(range)) continue;          // latin basic only
      const source = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
      if (!source) continue;
      const name = source[1].split('/').pop();
      await save('fonts/google', name, source[1]);
      localFaces += block.split(`url(${source[1]})`).join(`url(fonts/google/${name})`);
    }
    css = css.split(`@import"${url}";`).join('').split(`@import"${url}"`).join('');
  }

  css = localFaces + css;
  await writeFile(cssPath, css);

  const leftover = css.match(/fonts\.(googleapis|gstatic)\.com|spelunkr\.tv\/fonts/);
  if (leftover) throw new Error(`fonts: still remote -> ${leftover[0]}`);
  console.log(`fonts: ${files} files, ${(bytes / 1024).toFixed(0)} KB, ${starUrls.length} star + ${imports.length} google imports inlined, css ${before} -> ${css.length} bytes`);
  return { files, bytes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await localizeFonts(process.argv[2] || 'dist');
}
