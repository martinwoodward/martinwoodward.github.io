# Note About Agentic Workflow Compilation

This repository contains **source** agentic workflow files (`.md` format) but **not yet** the compiled GitHub Actions files (`.lock.yml` format).

## Why?

The agentic workflow files define AI-powered automation but require compilation using the `gh aw compile` command from the [gh-aw](https://github.com/githubnext/gh-aw) CLI tool to generate the actual GitHub Actions workflows.

## To Enable These Workflows

You need to:

1. **Install the gh-aw CLI extension**:
   ```bash
   # Install GitHub CLI if you haven't already
   brew install gh  # macOS
   # or: winget install --id GitHub.cli  # Windows
   # or: sudo apt install gh  # Linux
   
   # Authenticate
   gh auth login
   
   # Install the gh-aw extension
   gh extension install githubnext/gh-aw
   ```

2. **Compile the workflows**:
   ```bash
   cd /path/to/martinwoodward.github.io
   gh aw compile
   ```
   
   This will generate `.lock.yml` files for each `.md` workflow file:
   - `dependabot-auto-merge.lock.yml`
   - `issue-triage.lock.yml`
   - `ci-doctor.lock.yml`
   - `pr-description-enhancer.lock.yml`

3. **Configure AI model** (required):
   - Choose an AI engine (GitHub Models, OpenAI, Anthropic, etc.)
   - Add required API key secrets to your repository
   - See https://githubnext.github.io/gh-aw/reference/engines/ for details

4. **Commit the compiled files**:
   ```bash
   git add .github/workflows/*.lock.yml
   git commit -m "Add compiled agentic workflows"
   git push
   ```

## Why Not Include Compiled Files?

The `.lock.yml` files are:
- **Auto-generated** and should not be manually edited
- **Repository-specific** and may need different configuration per repo
- **Dependent on** AI model configuration which is environment-specific
- **Large files** that would bloat the repository unnecessarily

## Current Status

✅ Source workflow definitions (`.md` files) - INCLUDED  
✅ Documentation - INCLUDED  
⏸️ Compiled workflows (`.lock.yml` files) - NOT INCLUDED  
⏸️ AI model configuration - NOT INCLUDED

You can choose to enable these workflows or not, depending on whether you want to use the experimental agentic workflow feature.

## Alternative: Traditional GitHub Actions

If you prefer not to use agentic workflows, you can:
1. Implement similar functionality using traditional GitHub Actions YAML
2. Use existing actions from the marketplace
3. Keep the `.md` files as documentation/reference only

## More Information

See [AGENTIC_WORKFLOWS.md](./AGENTIC_WORKFLOWS.md) for complete documentation on:
- How agentic workflows work
- Detailed setup instructions
- Customization options
- Safety considerations
- Troubleshooting tips
