const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Rendered PNGs are cached by a hash of their source HTML so unchanged images are reused across builds
const cacheDir = process.env.OG_CACHE_DIR || path.join(__dirname, '..', '.og-cache');
const RENDER_VERSION = 'v1';

function prepareHtml(htmlContent) {
  // Replace Google Fonts with system fonts to avoid network requests
  return htmlContent
    .replace(/@import url\('https:\/\/fonts\.googleapis\.com\/[^']+'\);/g, '')
    .replace(
      /font-family: 'Inter'[^;]+;/g,
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"
    );
}

function cachePathFor(htmlContent) {
  const hash = crypto.createHash('sha256').update(RENDER_VERSION).update(htmlContent).digest('hex');
  return path.join(cacheDir, `${hash}.png`);
}

async function generateOGImages() {
  console.log('🎨 Starting OG image generation...');

  const distPath = path.join(__dirname, '..', 'dist');
  const ogApiPath = path.join(distPath, 'api', 'og');

  if (!fs.existsSync(ogApiPath)) {
    console.log('❌ No OG API directory found in dist. Make sure to run astro build first.');
    return;
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  const usedCacheFiles = new Set();
  const pending = [];
  let cached = 0;

  for (const htmlFile of findHtmlFiles(ogApiPath)) {
    const htmlContent = prepareHtml(fs.readFileSync(htmlFile, 'utf8'));
    const cacheFile = cachePathFor(htmlContent);
    usedCacheFiles.add(path.basename(cacheFile));
    if (fs.existsSync(cacheFile)) {
      fs.copyFileSync(cacheFile, htmlFile);
      cached++;
    } else {
      pending.push({ htmlFile, htmlContent, cacheFile });
    }
  }

  console.log(`♻️  Reused ${cached} cached OG images, ${pending.length} to render`);

  // Drop cache entries no longer referenced so the cache doesn't grow forever
  for (const file of fs.readdirSync(cacheDir)) {
    if (!usedCacheFiles.has(file)) fs.rmSync(path.join(cacheDir, file), { force: true });
  }

  if (pending.length === 0) {
    console.log('✅ All OG images up to date');
    return;
  }

  let browser;
  try {
    // Try to use system browser first if available
    browser = await chromium.launch({
      headless: true,
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
  } catch (error) {
    console.log('System Chrome not available, trying Playwright managed browser...');
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor']
      });
    } catch (playwrightError) {
      console.error('❌ Failed to launch browser:', playwrightError.message);
      console.log('💡 Please run "npx playwright install chromium" to install the browser');
      return;
    }
  }

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 630 });

    let converted = 0;
    let failed = 0;
    
    for (const { htmlFile, htmlContent, cacheFile } of pending) {
      try {
        console.log(`🖼️  Converting: ${path.relative(distPath, htmlFile)}`);
        
        // Set the content with a shorter timeout
        await page.setContent(htmlContent, { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });
        
        // Wait for any remaining resources with a simple delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Take screenshot
        const screenshot = await page.screenshot({
          type: 'png',
          fullPage: false,
          clip: { x: 0, y: 0, width: 1200, height: 630 }
        });
        
        // Write the PNG file
        fs.writeFileSync(htmlFile, screenshot);
        fs.writeFileSync(cacheFile, screenshot);
        converted++;
        
      } catch (error) {
        console.error(`❌ Failed to convert ${path.relative(distPath, htmlFile)}: ${error.message}`);
        failed++;
      }
    }
    
    console.log(`✅ Successfully converted ${converted} images to PNG format`);
    if (failed > 0) {
      console.log(`⚠️  Failed to convert ${failed} images`);
    }
    
  } catch (error) {
    console.error('❌ Error during OG image generation:', error);
  } finally {
    await browser.close();
  }
}

function findHtmlFiles(dir) {
  const files = [];
  
  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (item.endsWith('.png')) {
        // Check if it's actually an HTML file
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.trim().startsWith('<!DOCTYPE html>')) {
            files.push(fullPath);
          }
        } catch (error) {
          // Skip files that can't be read as text
        }
      }
    }
  }
  
  scan(dir);
  return files;
}

// Run the script
generateOGImages().catch(console.error);
