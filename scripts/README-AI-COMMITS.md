# 🤖 AI-Powered Commit Messages

Automatically generate meaningful commit messages using DeepSeek (or OpenAI).

## 🚀 Setup

1. **Add your DeepSeek API key to `.env`:**

   ```bash
   DEEPSEEK_API_KEY=sk-...
   ```

   Get your key at: https://platform.deepseek.com/

   **Why DeepSeek?**
   - 💰 **100x cheaper** than GPT-4 ($0.14 vs $15 per million tokens)
   - 🚀 **Just as good** for commit messages
   - ⚡️ **Fast** response times

   _Fallback: Also supports `OPENAI_API_KEY` if you prefer_

2. **Husky is already configured!** The hook runs automatically.

## 📝 Usage

### Option 1: Automatic (Recommended)

```bash
git add .
git commit
# AI generates message automatically! ✨
# Edit if needed, then save and close editor
```

### Option 2: Quick Commit Script

```bash
git add .
npm run c
# Commits with AI-generated message immediately
```

### Option 3: Quick Push

```bash
git add .
npm run p
# Lints, commits with AI message, and pushes
```

## 🎯 How It Works

1. **Stage your changes:** `git add .`
2. **Run commit:** `git commit` (no message needed!)
3. **AI analyzes** your git diff
4. **Generates** a meaningful commit message
5. **Opens editor** for you to review/edit
6. **Saves** and commits!

## 🎨 Commit Message Format

The AI follows these rules:

- ✨ **feat:** New features
- 🐛 **fix:** Bug fixes
- ♻️ **refactor:** Code refactoring
- 🎨 **style:** UI/styling changes
- 📝 **docs:** Documentation
- ⚡️ **perf:** Performance improvements
- 🔧 **chore:** Config/tooling
- 🚀 **misc:** Minor/experimental changes

## 📊 Examples

```bash
# Before: Your changes
+ Added multi-size image generation
+ Updated manifest with proper icons
+ Fixed favicon not updating

# After: AI generates
✨ Add multi-size image optimization for PWA icons
```

```bash
# Before: Your changes
- Fixed bug in app deletion
- Updated cleanup logic

# After: AI generates
🐛 Fix app deletion and cleanup logic
```

## ⚙️ Configuration

Edit `scripts/generate-commit-message.js` to customize:

- Model: Change `gpt-4o-mini` to `gpt-4` for better quality
- Temperature: Adjust creativity (0.0 = deterministic, 1.0 = creative)
- Rules: Modify the system prompt

## 🔒 Fallback

If neither `DEEPSEEK_API_KEY` nor `OPENAI_API_KEY` is set, it defaults to `🚀` as a fun placeholder.

## 🎉 Shortcuts

Add to your shell config (`~/.zshrc` or `~/.bashrc`):

```bash
alias gc="git add . && npm run c"
alias gp="git add . && npm run p"
```

Then just:

```bash
gc  # Commit with AI
gp  # Commit with AI and push
```

## 💡 Tips

- **Review before pushing:** AI is smart but not perfect!
- **Edit if needed:** The message opens in your editor
- **Use for large changes:** AI shines when analyzing complex diffs
- **Skip for tiny changes:** Just use `git commit -m "🚀"` for experiments
- **Test manually:** Run `npm run test-ai` to see what message would be generated

---

**Enjoy your AI-powered git workflow! 🚀✨**
