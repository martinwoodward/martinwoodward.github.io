# Agentic Workflows for Blog Repository

This directory contains **Agentic Workflows** - AI-powered automation workflows defined in natural language using GitHub's experimental [gh-aw](https://github.com/githubnext/gh-aw) tool.

⚠️ **Important**: GitHub Agentic Workflows are a research demonstrator. Use them experimentally and monitor their behavior carefully.

## What Are Agentic Workflows?

Agentic Workflows let you describe repository automation in plain English (Markdown files with YAML frontmatter) instead of writing complex GitHub Actions YAML. An AI agent executes these workflows with access to GitHub APIs and other tools.

**How it works**:
1. Write a workflow description in a `.md` file (e.g., `issue-triage.md`)
2. Compile it to GitHub Actions YAML using `gh aw compile`
3. The compiled `.lock.yml` file runs on GitHub Actions
4. An AI agent executes the natural language instructions

## Available Workflows

### 🔄 Dependabot Auto-Merge
**File**: `dependabot-auto-merge.md`  
**Trigger**: When Dependabot opens a pull request  
**Purpose**: Automatically evaluates and merges safe dependency updates

- ✅ Auto-merges **patch** and **minor** version updates
- ✅ Waits for PR verification to pass
- ⚠️ Requires manual review for **major** version updates
- 📝 Adds explanatory comments to PRs

**Why this is useful**: Reduces maintenance burden by safely automating low-risk dependency updates while ensuring critical updates get human review.

---

### 🏷️ Issue Triage
**File**: `issue-triage.md`  
**Trigger**: When issues are opened or reopened  
**Purpose**: Automatically categorizes, labels, and analyzes new issues

- 🔍 Analyzes issue content and context
- 🏷️ Applies appropriate labels (bug, enhancement, etc.)
- 🔎 Checks for duplicate issues
- 💡 Provides debugging tips and related resources
- 📚 Links to relevant documentation

**Why this is useful**: Helps maintainers quickly understand and prioritize issues, especially useful for blogs with open issues enabled.

---

### 🏥 CI Doctor
**File**: `ci-doctor.md`  
**Trigger**: When "Deploy Blog" or "PR Verification" workflows fail  
**Purpose**: Automatically investigates CI/CD failures and provides diagnosis

- 🔍 Analyzes failed workflow logs
- 🎯 Identifies root causes (dependencies, Astro build, deployment issues)
- 📝 Creates detailed investigation reports
- 🔧 Provides actionable remediation steps
- 🧠 Remembers patterns for future analysis

**Why this is useful**: Saves time debugging build failures by automatically analyzing logs and suggesting fixes, particularly helpful for Astro/TypeScript/Tailwind issues.

---

### ✍️ PR Description Enhancer  
**File**: `pr-description-enhancer.md`  
**Trigger**: When pull requests are opened  
**Purpose**: Adds helpful context and checklists to PR descriptions

- 📦 Analyzes dependency updates and provides changelog links
- ✍️ Extracts blog post metadata for content PRs
- 🔧 Summarizes code changes and impact
- ✅ Generates relevant review checklists
- 🔗 Adds quick links to artifacts and previews

**Why this is useful**: Makes reviewing PRs faster by providing structured context, especially for automated PRs from Dependabot or content updates.

## Installation & Setup

### Prerequisites

1. **Install GitHub CLI**:
   ```bash
   # macOS
   brew install gh
   
   # Windows
   winget install --id GitHub.cli
   
   # Linux (Debian/Ubuntu)
   sudo apt install gh
   ```

2. **Authenticate GitHub CLI**:
   ```bash
   gh auth login
   ```

3. **Install gh-aw Extension**:
   ```bash
   gh extension install githubnext/gh-aw
   ```

4. **Verify Installation**:
   ```bash
   gh aw --help
   ```

### Compiling Workflows

To compile the Markdown workflows to GitHub Actions YAML:

```bash
# Compile all workflows in .github/workflows/
gh aw compile

# Compile with additional checks
gh aw compile --strict --actionlint
```

This creates `.lock.yml` files (e.g., `dependabot-auto-merge.lock.yml`) which are the actual GitHub Actions workflows that run.

**Important**: 
- ✅ **Always edit the `.md` files**, not the `.lock.yml` files
- ✅ **Commit both** `.md` and `.lock.yml` files to git
- ⚠️ `.lock.yml` files are auto-generated and will be overwritten

### Enabling Workflows

After compiling and committing:

1. Push the workflows to your repository
2. Enable GitHub Actions if not already enabled
3. Configure an AI model (see Configuration section)
4. The workflows will automatically trigger based on their defined events

## Configuration

### AI Model Setup

Agentic workflows require an AI model to execute. You need to:

1. **Choose a model provider** from:
   - GitHub Models (recommended for GitHub-hosted repos)
   - OpenAI (GPT-4, GPT-3.5)
   - Anthropic (Claude)
   - Azure OpenAI

2. **Add API keys as repository secrets**:
   - Go to repository Settings → Secrets and variables → Actions
   - Add the required secret (e.g., `GITHUB_TOKEN` for GitHub Models, `OPENAI_API_KEY` for OpenAI)

3. **Configure the engine** (if not using defaults):
   Edit `.github/workflows/.gh-aw.yml` to specify your preferred model

For details, see: https://githubnext.github.io/gh-aw/reference/engines/

### Repository Settings

For auto-merge workflows to work:

1. Enable **Allow auto-merge** in repository settings
2. Enable **Allow GitHub Actions to create and approve pull requests**
3. Configure branch protection rules if desired

## Customization

### Modifying Workflows

To customize a workflow:

1. **Edit the `.md` file**:
   ```bash
   vim .github/workflows/issue-triage.md
   ```

2. **Update the YAML frontmatter** (triggers, permissions, timeouts)
3. **Modify the natural language instructions** in the Markdown body
4. **Re-compile**:
   ```bash
   gh aw compile
   ```

5. **Test the changes**:
   ```bash
   gh aw run issue-triage --dry-run
   ```

6. **Commit both files**:
   ```bash
   git add .github/workflows/issue-triage.md .github/workflows/issue-triage.lock.yml
   git commit -m "Update issue triage workflow"
   git push
   ```

### Local Configuration

You can add workflow-specific configuration in `.github/workflows/agentics/[workflow-name].config.md` to customize behavior without editing the main workflow.

## Monitoring and Troubleshooting

### View Workflow Runs

```bash
# List recent workflow runs
gh run list --workflow=issue-triage.lock.yml

# View logs for a specific run
gh run view [run-id] --log

# View logs with the agentic workflow tool
gh aw logs [workflow-name]
```

### Debugging Tips

1. **Workflow not triggering?**
   - Check the `on:` trigger in the frontmatter
   - Verify the `.lock.yml` file is committed
   - Check Actions tab for any errors

2. **Agent making wrong decisions?**
   - Review the natural language instructions in the `.md` file
   - Add more specific guidelines or examples
   - Check the AI model being used (some are better than others)

3. **Permissions errors?**
   - Review `permissions:` in frontmatter
   - Check repository settings for Actions permissions
   - Verify required secrets are set

### Disabling Workflows

To temporarily disable a workflow:

```bash
# Disable via GitHub CLI
gh workflow disable issue-triage.lock.yml

# Or delete the .lock.yml file (keep the .md source)
rm .github/workflows/issue-triage.lock.yml
git commit -m "Disable issue triage workflow"
```

To permanently remove:
```bash
rm .github/workflows/issue-triage.md .github/workflows/issue-triage.lock.yml
git commit -m "Remove issue triage workflow"
```

## Workflow Lifecycle

Most workflows in this repository have a `stop-after:` setting (e.g., `+6mo` for 6 months). This means they'll automatically stop triggering after that period. This is a safety feature to ensure experimental workflows don't run indefinitely.

To extend or make a workflow run indefinitely:
1. Edit the `.md` file and remove the `stop-after:` line
2. Re-compile with `gh aw compile`
3. Commit and push the changes

## Safety Considerations

### What These Workflows Can Do

With current configuration, workflows can:
- ✅ Read repository contents, issues, PRs, workflow runs
- ✅ Add comments to issues and PRs
- ✅ Add labels to issues
- ✅ Approve PRs and enable auto-merge
- ✅ Search the web for information
- ✅ Create issues

### What They Cannot Do

Based on `permissions: read-all` and specific `safe-outputs`:
- ❌ Push code directly (no `contents: write`)
- ❌ Close or delete issues/PRs
- ❌ Modify repository settings
- ❌ Access repository secrets
- ❌ Merge PRs without checks passing

### Best Practices

1. **Start Conservatively**: Begin with read-only or low-risk workflows
2. **Monitor Behavior**: Regularly check what actions workflows are taking
3. **Use `stop-after:`**: Let workflows expire so you can evaluate them
4. **Review AI Actions**: Check comments and labels added by workflows
5. **Human in the Loop**: Keep final decisions (merges, closes) with humans when possible
6. **Be Specific**: Write clear, specific instructions in workflow descriptions
7. **Test First**: Use `--dry-run` mode when testing modifications

## Dependabot Compatibility

⚠️ **Important Note**: Dependabot doesn't directly understand agentic workflows. It will try to update action versions in `.lock.yml` files, but these changes will be overwritten on the next compilation.

To handle Dependabot updates for agentic workflows:
1. Let Dependabot create its PR for `.lock.yml` updates
2. Manually update action versions in the `.md` source files instead
3. Run `gh aw compile` to regenerate the `.lock.yml` files
4. Close the Dependabot PR and commit your manual changes

Better solution: Configure Dependabot to ignore `.lock.yml` files and focus on regular workflows.

## Resources

- **Official Documentation**: https://githubnext.github.io/gh-aw/
- **GitHub Repository**: https://github.com/githubnext/gh-aw
- **Example Workflows**: https://github.com/githubnext/agentics
- **Discord Community**: https://gh.io/next-discord (#continuous-ai channel)

## Contributing

Found a way to improve these workflows? 

1. Edit the `.md` source file
2. Re-compile with `gh aw compile`
3. Test locally if possible
4. Submit a PR with both `.md` and `.lock.yml` changes

## Feedback

These workflows are experimental. If you notice any issues:
- The workflows behaving unexpectedly
- Opportunities for improvement
- Security concerns
- Better ways to accomplish tasks

Please open an issue or reach out to the repository maintainer.

---

**Last Updated**: January 2026  
**gh-aw Version**: Latest (research preview)
