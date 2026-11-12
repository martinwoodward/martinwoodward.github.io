#!/usr/bin/env node
/**
 * Exits 0 and prints "true" if any post's date falls between SINCE and now,
 * meaning a scheduled post has become due since the last deploy.
 *
 * Usage: SINCE=2026-11-12T10:00:00Z node scripts/check-scheduled-posts.js
 */
const fs = require("fs");
const path = require("path");

const POST_DIR = path.join(__dirname, "..", "src/content/post");
const since = new Date(process.env.SINCE || 0).getTime();
const now = Date.now();

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.mdx?$/.test(entry.name) ? [full] : [];
  });

const due = walk(POST_DIR).filter((file) => {
  const frontmatter = fs.readFileSync(file, "utf-8").split(/^---$/m)[1] || "";
  const match = frontmatter.match(/^date:\s*["']?([^"'\n]+)["']?\s*$/m);
  if (!match) return false;
  const date = new Date(match[1]).getTime();
  return date > since && date <= now;
});

due.forEach((file) => console.error(`📅 Now due: ${path.relative(POST_DIR, file)}`));
console.log(due.length > 0 ? "true" : "false");
