#!/usr/bin/env node

/**
 * Generate images for blog posts using Ideogram.ai API
 * 
 * This script reads image-prompts.json, calls the Ideogram.ai API to generate images,
 * and saves them to the public/images/post/ directory.
 * 
 * Prerequisites:
 * - IDEOGRAM_API_KEY environment variable must be set
 * - image-prompts.json file must exist in the scripts directory
 * 
 * Usage:
 *   IDEOGRAM_API_KEY=your_key node scripts/generate-images-with-ideogram.js
 *   
 * Options:
 *   --limit N     Only generate N images (for testing)
 *   --year YYYY   Only generate images for posts from specific year
 *   --skip-existing  Skip posts that already have images
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const API_KEY = process.env.IDEOGRAM_API_KEY;
const IDEOGRAM_API_URL = 'https://api.ideogram.ai/v1/ideogram-v3/generate';
const IMAGE_PROMPTS_FILE = path.join(__dirname, 'image-prompts.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'images', 'post');

// Parse command line arguments
const args = process.argv.slice(2);
let limit = null;
let yearFilter = null;
let skipExisting = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && i + 1 < args.length) {
    limit = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--year' && i + 1 < args.length) {
    yearFilter = args[i + 1];
    i++;
  } else if (args[i] === '--skip-existing') {
    skipExisting = true;
  }
}

// Validation
if (!API_KEY) {
  console.error('❌ Error: IDEOGRAM_API_KEY environment variable is not set.');
  console.error('\nPlease set your Ideogram API key:');
  console.error('  export IDEOGRAM_API_KEY=your_api_key_here');
  console.error('\nOr run with:');
  console.error('  IDEOGRAM_API_KEY=your_key node scripts/generate-images-with-ideogram.js');
  process.exit(1);
}

if (!fs.existsSync(IMAGE_PROMPTS_FILE)) {
  console.error(`❌ Error: ${IMAGE_PROMPTS_FILE} not found.`);
  console.error('\nPlease run the generate-image-prompts.js script first:');
  console.error('  node scripts/generate-image-prompts.js');
  process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
}

/**
 * Call Ideogram.ai API to generate an image
 * @param {string} prompt - The text prompt for image generation
 * @returns {Promise<string>} - URL of the generated image
 */
async function generateImageWithIdeogram(prompt) {
  return new Promise((resolve, reject) => {
    // Prepare form data
    const boundary = '----FormBoundary' + Math.random().toString(36);
    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="prompt"',
      '',
      prompt,
      `--${boundary}`,
      'Content-Disposition: form-data; name="rendering_speed"',
      '',
      'TURBO',
      `--${boundary}`,
      'Content-Disposition: form-data; name="aspect_ratio"',
      '',
      'ASPECT_16_9',
      `--${boundary}`,
      'Content-Disposition: form-data; name="magic_prompt"',
      '',
      'AUTO',
      `--${boundary}--`,
    ].join('\r\n');

    const options = {
      method: 'POST',
      hostname: 'api.ideogram.ai',
      path: '/v1/ideogram-v3/generate',
      headers: {
        'Api-Key': API_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(formData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            if (response.data && response.data.length > 0 && response.data[0].url) {
              resolve(response.data[0].url);
            } else {
              reject(new Error('No image URL in API response'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(formData);
    req.end();
  });
}

/**
 * Download an image from a URL
 * @param {string} url - The URL of the image
 * @param {string} outputPath - The path to save the image
 * @returns {Promise<void>}
 */
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (res) => {
      if (res.statusCode === 200) {
        const fileStream = fs.createWriteStream(outputPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        fileStream.on('error', reject);
      } else {
        reject(new Error(`Failed to download image: HTTP ${res.statusCode}`));
      }
    }).on('error', reject);
  });
}

/**
 * Main function to process all posts
 */
async function main() {
  console.log('🎨 Ideogram.ai Image Generator for Blog Posts\n');
  
  // Load image prompts
  const allPosts = JSON.parse(fs.readFileSync(IMAGE_PROMPTS_FILE, 'utf8'));
  
  // Filter posts based on options
  let posts = allPosts;
  
  if (yearFilter) {
    posts = posts.filter(post => post.date.startsWith(yearFilter));
    console.log(`📅 Filtering to posts from ${yearFilter}`);
  }
  
  if (skipExisting) {
    posts = posts.filter(post => {
      const outputPath = path.join(OUTPUT_DIR, post.suggestedFilename);
      return !fs.existsSync(outputPath);
    });
    console.log(`⏭️  Skipping ${allPosts.length - posts.length} posts with existing images`);
  }
  
  if (limit) {
    posts = posts.slice(0, limit);
    console.log(`🔢 Limiting to ${limit} images`);
  }
  
  console.log(`📊 Processing ${posts.length} posts\n`);
  
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const outputPath = path.join(OUTPUT_DIR, post.suggestedFilename);
    
    console.log(`\n[${i + 1}/${posts.length}] Processing: ${post.title}`);
    console.log(`   Date: ${post.date}`);
    console.log(`   Output: ${post.suggestedFilename}`);
    
    // Check if image already exists
    if (fs.existsSync(outputPath)) {
      console.log(`   ⏭️  Image already exists, skipping`);
      skippedCount++;
      continue;
    }
    
    try {
      // Generate image with Ideogram
      console.log(`   🎨 Generating image...`);
      console.log(`   Prompt: ${post.imagePrompt.substring(0, 100)}...`);
      
      const imageUrl = await generateImageWithIdeogram(post.imagePrompt);
      console.log(`   ✓ Image generated: ${imageUrl.substring(0, 60)}...`);
      
      // Download image
      console.log(`   ⬇️  Downloading image...`);
      await downloadImage(imageUrl, outputPath);
      console.log(`   ✅ Image saved to: ${outputPath}`);
      
      successCount++;
      
      // Add a small delay to avoid rate limiting
      if (i < posts.length - 1) {
        console.log(`   ⏳ Waiting 2 seconds before next request...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errorCount++;
      
      // Continue with next image after error
      if (i < posts.length - 1) {
        console.log(`   ⏳ Waiting 5 seconds before next request...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Generation Summary:');
  console.log(`   ✅ Successfully generated: ${successCount} images`);
  console.log(`   ⏭️  Skipped (already exist): ${skippedCount} images`);
  console.log(`   ❌ Failed: ${errorCount} images`);
  console.log(`   📁 Images saved to: ${OUTPUT_DIR}`);
  console.log('='.repeat(60));
  
  if (errorCount > 0) {
    console.log('\n⚠️  Some images failed to generate. You may want to retry those posts.');
  }
  
  if (successCount > 0) {
    console.log('\n✨ Image generation complete! Your blog posts now have custom images.');
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
