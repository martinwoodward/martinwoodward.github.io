# Ideogram.ai API Setup Guide

This guide explains how to set up your Ideogram.ai API key as a GitHub repository secret and use it to generate images for your blog posts.

## Table of Contents

- [Getting an Ideogram.ai API Key](#getting-an-ideogramai-api-key)
- [Setting up GitHub Repository Secret](#setting-up-github-repository-secret)
- [Using the Image Generation Script](#using-the-image-generation-script)
- [Integration with GitHub Actions](#integration-with-github-actions)
- [Troubleshooting](#troubleshooting)

## Getting an Ideogram.ai API Key

### Step 1: Create an Ideogram Account

1. Go to [https://ideogram.ai](https://ideogram.ai)
2. Sign up for an account or log in if you already have one

### Step 2: Access API Settings

1. Once logged in, navigate to your **Settings** or **Profile** page
2. Look for the **API Beta** or **Developer API** section
3. Accept the Developer API Agreement if prompted
4. Set up payment information (the API key is funded only when you first generate it)

### Step 3: Generate Your API Key

1. Click **"Create API key"** button
2. Copy the API key immediately - **it will only be shown once**
3. Store it securely (you'll need it in the next steps)

> ⚠️ **Important**: Keep your API key secure and never commit it to your repository!

## Setting up GitHub Repository Secret

To use your Ideogram API key in GitHub Actions workflows, you need to store it as a repository secret.

### Step-by-Step Instructions

1. **Navigate to Your Repository**
   - Go to your repository on GitHub: `https://github.com/martinwoodward/martinwoodward.github.io`

2. **Access Repository Settings**
   - Click on the **Settings** tab (at the top of the repository page)
   - If you don't see the Settings tab, you may not have admin permissions

3. **Go to Secrets and Variables**
   - In the left sidebar, scroll down to the **Security** section
   - Click on **Secrets and variables**
   - Select **Actions** from the submenu

4. **Create a New Repository Secret**
   - Click the **"New repository secret"** button
   - Fill in the details:
     - **Name**: `IDEOGRAM_API_KEY`
     - **Value**: Paste your Ideogram.ai API key (the one you copied earlier)
   - Click **"Add secret"**

5. **Verify the Secret**
   - You should now see `IDEOGRAM_API_KEY` listed in your repository secrets
   - The value will be hidden for security purposes

### Screenshot Guide

```
Repository Page → Settings → Secrets and variables → Actions → New repository secret
```

## Using the Image Generation Script

Once your API key is set up, you can generate images for your blog posts.

### Local Development

For local testing, you can run the script directly:

```bash
# Set your API key as an environment variable
export IDEOGRAM_API_KEY="your_api_key_here"

# Run the script
node scripts/generate-images-with-ideogram.js
```

### Script Options

The script supports several command-line options:

```bash
# Generate only 5 images (for testing)
node scripts/generate-images-with-ideogram.js --limit 5

# Generate images only for posts from 2024
node scripts/generate-images-with-ideogram.js --year 2024

# Skip posts that already have images
node scripts/generate-images-with-ideogram.js --skip-existing

# Combine options
node scripts/generate-images-with-ideogram.js --year 2024 --limit 10 --skip-existing
```

### What the Script Does

1. Reads `scripts/image-prompts.json` to get the list of blog posts and their prompts
2. For each post without an image:
   - Calls the Ideogram.ai API with the pre-generated prompt
   - Downloads the generated image
   - Saves it to `public/images/post/` with the correct filename
3. Displays progress and a summary of results

### Expected Output

```
🎨 Ideogram.ai Image Generator for Blog Posts

📊 Processing 10 posts

[1/10] Processing: My Blog Post Title
   Date: 2024-01-15
   Output: 2024-my-blog-post-title.jpg
   🎨 Generating image...
   Prompt: Professional technology blog illustration...
   ✓ Image generated: https://ideogram.ai/api/images/...
   ⬇️  Downloading image...
   ✅ Image saved to: public/images/post/2024-my-blog-post-title.jpg
   ⏳ Waiting 2 seconds before next request...

[2/10] Processing: Another Post
...

============================================================
📊 Generation Summary:
   ✅ Successfully generated: 8 images
   ⏭️  Skipped (already exist): 1 images
   ❌ Failed: 1 images
   📁 Images saved to: public/images/post
============================================================
```

## Integration with GitHub Actions

You can integrate the image generation script into your CI/CD workflow.

### Option 1: Manual Workflow Dispatch

Create a workflow that can be manually triggered to generate images:

```yaml
name: Generate Blog Images

on:
  workflow_dispatch:
    inputs:
      year:
        description: 'Year to generate images for (optional)'
        required: false
        type: string
      limit:
        description: 'Number of images to generate (optional)'
        required: false
        type: number

jobs:
  generate-images:
    name: Generate Images with Ideogram.ai
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Setup Yarn
        run: corepack enable
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Generate images
        env:
          IDEOGRAM_API_KEY: ${{ secrets.IDEOGRAM_API_KEY }}
        run: |
          ARGS=""
          if [ -n "${{ inputs.year }}" ]; then
            ARGS="$ARGS --year ${{ inputs.year }}"
          fi
          if [ -n "${{ inputs.limit }}" ]; then
            ARGS="$ARGS --limit ${{ inputs.limit }}"
          fi
          node scripts/generate-images-with-ideogram.js --skip-existing $ARGS
      
      - name: Commit generated images
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add public/images/post/
          git diff --staged --quiet || git commit -m "Add generated blog post images"
          git push
```

### Option 2: Automatic Generation on New Posts

Add a step to your existing CI workflow to generate images for new posts:

```yaml
# In your .github/workflows/ci.yml, add this step before building:

- name: Generate images for new posts
  env:
    IDEOGRAM_API_KEY: ${{ secrets.IDEOGRAM_API_KEY }}
  run: |
    # Only generate images for new posts (skip existing)
    node scripts/generate-images-with-ideogram.js --skip-existing --limit 5
```

### Option 3: Separate Image Generation Workflow

You can create a dedicated workflow that runs periodically:

```yaml
name: Generate Missing Images

on:
  schedule:
    - cron: '0 2 * * 0' # Run every Sunday at 2 AM UTC
  workflow_dispatch:

jobs:
  generate-missing-images:
    name: Generate Missing Blog Images
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          npm install
      
      - name: Generate missing images
        env:
          IDEOGRAM_API_KEY: ${{ secrets.IDEOGRAM_API_KEY }}
        run: |
          node scripts/generate-images-with-ideogram.js --skip-existing --limit 10
      
      - name: Commit and push if images were generated
        run: |
          if [ -n "$(git status --porcelain public/images/post/)" ]; then
            git config --local user.email "action@github.com"
            git config --local user.name "GitHub Action"
            git add public/images/post/
            git commit -m "Auto-generate missing blog post images [skip ci]"
            git push
          else
            echo "No new images were generated"
          fi
```

## Troubleshooting

### Error: IDEOGRAM_API_KEY environment variable is not set

**Problem**: The script cannot find your API key.

**Solutions**:
- **Local**: Make sure you've exported the environment variable: `export IDEOGRAM_API_KEY="your_key"`
- **GitHub Actions**: Verify the secret is set correctly in your repository settings
- Check that the secret name matches exactly: `IDEOGRAM_API_KEY`

### Error: API request failed with status 401

**Problem**: Authentication failed.

**Solutions**:
- Verify your API key is correct
- Make sure your API key hasn't expired
- Check that you have sufficient API credits on your Ideogram account

### Error: API request failed with status 429

**Problem**: Rate limit exceeded.

**Solutions**:
- The script includes automatic delays between requests
- Try running with `--limit 10` to generate fewer images at once
- Wait a few minutes before trying again

### Error: image-prompts.json not found

**Problem**: The prompt file doesn't exist.

**Solution**: Generate it first:
```bash
node scripts/generate-image-prompts.js
```

### Images not appearing on the blog

**Problem**: Generated images exist but don't show on the blog.

**Solutions**:
- Verify images are in the correct location: `public/images/post/`
- Check that frontmatter in your blog posts references the correct image path
- Rebuild your site: `npm run build`
- Clear your browser cache

### Script stops after a few images

**Problem**: Script crashes or stops unexpectedly.

**Solutions**:
- Check your internet connection
- Verify you have sufficient disk space
- Run with `--limit 5` to test with fewer images
- Check the error message for specific issues

### Permission denied when creating directories

**Problem**: Script can't create output directories.

**Solution**: Ensure you have write permissions:
```bash
chmod -R u+w public/images/
```

## API Costs and Limits

- Each API call to Ideogram.ai has a cost (check current pricing on their website)
- The script uses `TURBO` rendering speed for faster generation
- There's a 2-second delay between requests to avoid rate limiting
- Use `--limit` option when testing to control costs

## Best Practices

1. **Test First**: Always test with `--limit 5` before generating all images
2. **Use Skip Existing**: Always include `--skip-existing` to avoid regenerating images
3. **Batch Processing**: Generate images by year to process manageable batches
4. **Monitor Costs**: Keep track of your API usage on the Ideogram dashboard
5. **Backup Images**: Consider backing up generated images separately
6. **Review Generated Images**: Check a few generated images before generating all 500+

## Need Help?

If you encounter issues not covered here:

1. Check the [Ideogram API Documentation](https://developer.ideogram.ai/)
2. Review the script output for specific error messages
3. Check GitHub Actions logs for workflow-related issues
4. Ensure your API key has sufficient credits

## Related Documentation

- [Image Generation README](scripts/IMAGE-GENERATION-README.md) - Overview of the image generation strategy
- [Ideogram API Docs](https://developer.ideogram.ai/) - Official API documentation
- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets) - More about repository secrets
