# Quick Start: Setting Up Your Ideogram.ai API Key

This is a quick reference guide for setting up your Ideogram.ai API key as a GitHub repository secret. For complete documentation, see [IDEOGRAM_API_SETUP.md](IDEOGRAM_API_SETUP.md).

## Step 1: Get Your Ideogram.ai API Key

1. Go to [https://ideogram.ai](https://ideogram.ai) and sign in
2. Navigate to your **Settings** or **Profile**
3. Find the **API Beta** or **Developer API** section
4. Accept the Developer API Agreement
5. Set up payment information (API key is funded when first generated)
6. Click **"Create API key"**
7. **Copy the API key immediately** (it's only shown once!)

## Step 2: Add API Key to GitHub Secrets

### Visual Guide:
```
GitHub.com → Your Repository → Settings → Secrets and variables → Actions → New repository secret
```

### Detailed Steps:

1. **Go to your repository on GitHub**
   ```
   https://github.com/martinwoodward/martinwoodward.github.io
   ```

2. **Click the "Settings" tab**
   - Located at the top of the repository page
   - If you don't see it, you need admin permissions

3. **Navigate to Secrets**
   - In the left sidebar, find the **Security** section
   - Click **"Secrets and variables"**
   - Select **"Actions"**

4. **Create the secret**
   - Click **"New repository secret"** button
   - **Name:** `IDEOGRAM_API_KEY` (exactly as shown)
   - **Value:** Paste your API key from Step 1
   - Click **"Add secret"**

5. **Verify**
   - You should see `IDEOGRAM_API_KEY` in your secrets list
   - The value will be hidden (•••••••)

## Step 3: Use the API Key

### Local Development:
```bash
export IDEOGRAM_API_KEY="your_api_key_here"
npm run generate-blog-images -- --limit 5
```

### GitHub Actions:
The API key is automatically available in workflows that reference it:
```yaml
env:
  IDEOGRAM_API_KEY: ${{ secrets.IDEOGRAM_API_KEY }}
```

## Step 4: Generate Your First Images

Test with a small batch:
```bash
# Set your API key
export IDEOGRAM_API_KEY="your_api_key_here"

# Generate 5 test images
npm run generate-blog-images -- --limit 5 --skip-existing
```

Expected output:
```
🎨 Ideogram.ai Image Generator for Blog Posts

📊 Processing 5 posts

[1/5] Processing: My Blog Post
   🎨 Generating image...
   ✓ Image generated
   ⬇️  Downloading image...
   ✅ Image saved to: public/images/post/...
```

## Common Commands

```bash
# Test with 5 images
npm run generate-blog-images -- --limit 5

# Generate all 2024 posts
npm run generate-blog-images -- --year 2024 --skip-existing

# Generate next 10 missing images
npm run generate-blog-images -- --limit 10 --skip-existing
```

## Using GitHub Actions

A workflow is available at `.github/workflows/generate-blog-images.yml` that you can:

1. Manually trigger from the **Actions** tab
2. Configure to run automatically
3. Use with inputs (year filter, limit, skip existing)

## Troubleshooting

### "IDEOGRAM_API_KEY environment variable is not set"
- **Local:** Run `export IDEOGRAM_API_KEY="your_key"`
- **GitHub:** Check that the secret is named exactly `IDEOGRAM_API_KEY`

### "API request failed with status 401"
- Your API key is incorrect or expired
- Verify the key in your Ideogram account

### "image-prompts.json not found"
- Run `node scripts/generate-image-prompts.js` first

## Need More Help?

See the complete documentation:
- [IDEOGRAM_API_SETUP.md](IDEOGRAM_API_SETUP.md) - Full setup guide
- [scripts/IMAGE-GENERATION-README.md](scripts/IMAGE-GENERATION-README.md) - Image generation strategy

## Security Notes

- ⚠️ **Never commit your API key to the repository**
- ⚠️ **Don't share your API key publicly**
- ✅ Always use environment variables or GitHub secrets
- ✅ Rotate your key if it's ever exposed

---

**Ready to generate images?** Your setup is complete! 🎨
