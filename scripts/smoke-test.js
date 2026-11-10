#!/usr/bin/env node
/**
 * Build-output smoke tests. Run after `astro build` (and optionally OG image
 * generation) to catch dependency upgrades that build "successfully" but
 * produce broken output: missing pages, empty RSS, unrendered markdown, etc.
 *
 * Usage: node scripts/smoke-test.js [distDir]
 * Set SMOKE_SKIP_OG=1 to skip checks that need generated OG images.
 */
const fs = require('fs');
const path = require('path');

const dist = path.resolve(process.argv[2] || 'dist');
const skipOg = process.env.SMOKE_SKIP_OG === '1';
const failures = [];
let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function read(rel) {
  const file = path.join(dist, rel);
  assert(fs.existsSync(file), `${rel} does not exist`);
  return fs.readFileSync(file, 'utf8');
}

function findFiles(dir, name, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, name, out);
    else if (entry.name === name) out.push(full);
  }
  return out;
}

const SAMPLE_POST = 'post/2026/11/building-with-heart-in-the-age-of-ai/index.html';

console.log(`🔎 Smoke testing build output in ${dist}`);
assert(fs.existsSync(dist), `dist directory ${dist} not found`);

check('static pages exist', () => {
  for (const rel of ['index.html', '404.html', 'robots.txt', 'llms.txt']) read(rel);
  assert(/<title>[^<]+<\/title>/.test(read('index.html')), 'homepage has no <title>');
});

const postPages = findFiles(path.join(dist, 'post'), 'index.html');
check('post pages generated', () => {
  assert(postPages.length >= 400, `expected >= 400 post pages, found ${postPages.length}`);
});

check('RSS feed is valid and populated', () => {
  const rss = read('rss.xml');
  assert(rss.startsWith('<?xml'), 'rss.xml missing XML declaration');
  assert(/<rss[^>]+version="2.0"/.test(rss), 'rss.xml missing <rss version="2.0">');
  const items = rss.match(/<item>[\s\S]*?<\/item>/g) || [];
  assert(items.length >= 100, `expected >= 100 RSS items, found ${items.length}`);
  const bad = items.filter((i) => !/<link>https:\/\/[^<]+<\/link>/.test(i) || !/<title>[^<]+<\/title>/.test(i));
  assert(bad.length === 0, `${bad.length} RSS items missing title or absolute link`);
});

check('category RSS feeds exist', () => {
  const feeds = fs.readdirSync(path.join(dist, 'rss')).filter((f) => f.endsWith('.xml'));
  assert(feeds.length >= 5, `expected >= 5 category feeds, found ${feeds.length}`);
  for (const f of feeds) assert(/<channel>/.test(read(`rss/${f}`)), `rss/${f} has no <channel>`);
});

check('markdown renders headings with ids', () => {
  const html = read(SAMPLE_POST);
  assert(/<h1[^>]*>\s*Building with Heart in the Age of AI/.test(html), 'post title <h1> missing');
  assert(/<h2 id="[a-z0-9-]+"/.test(html), 'markdown <h2> headings with slug ids missing');
  assert(!/^#{1,6} /m.test(html.replace(/<pre[\s\S]*?<\/pre>/g, '')), 'raw markdown heading syntax found in HTML');
});

check('markdown lists and links render', () => {
  const html = read('post/2020/08/2020-08-21-my-rpi-cluster/index.html');
  assert(/<li>[^<]*<a href="https:\/\/amzn\.to\/[^"]+"[^>]*>🇬🇧<\/a>/.test(html), 'list item links not rendered');
});

check('code blocks are syntax highlighted (shiki)', () => {
  const html = read('post/2013/05/2013-05-11-getting-started-with-libgit2sharp/index.html');
  assert(/<pre[^>]*class="astro-code/.test(html), 'no shiki-highlighted <pre class="astro-code"> found');
});

check('React components render (YouTube embed)', () => {
  const html = read('post/2021/pumpkinpi-spooky-build-status-indicator/index.html');
  assert(/yt-lite|lite-youtube/.test(html), 'YouTube embed component not rendered');
});

check('MDX shortcodes render (Notice)', () => {
  const html = read(SAMPLE_POST);
  assert(/class="notice [a-z]+"/.test(html) && /class="notice-body"/.test(html), 'Notice shortcode not rendered');
});

check('search index matches built posts', () => {
  const file = path.resolve('.json/search.json');
  assert(fs.existsSync(file), '.json/search.json missing (run yarn generate-json)');
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert(entries.length >= 400, `only ${entries.length} search entries`);
  const bad = entries.filter((e) => !e.slug || !e.frontmatter?.title || !e.content);
  assert(bad.length === 0, `${bad.length} entries missing slug/title/content, e.g. ${bad[0]?.slug}`);
  const missing = entries.filter((e) => !fs.existsSync(path.join(dist, e.slug, 'index.html')));
  assert(missing.length === 0, `${missing.length} search entries have no built page, e.g. ${missing[0]?.slug}`);
});

check('og:image meta tag present', () => {
  const html = read(SAMPLE_POST);
  assert(/<meta[^>]+property="og:image"[^>]+content="https?:\/\/[^"]+\.png"/.test(html), 'og:image meta missing');
});

if (!skipOg) {
  check('OG images generated', () => {
    const img = path.join(dist, 'api/og/2026/11/building-with-heart-in-the-age-of-ai.png');
    assert(fs.existsSync(img), 'OG PNG for sample post missing');
    const header = fs.readFileSync(img).subarray(0, 8);
    assert(header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'OG image is not a valid PNG');
  });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
