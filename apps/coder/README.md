# Sushi Coder - AI-Powered VS Code Extension

Your AI-powered coding assistant with multimodal support, model selection, and cost optimization.

## Features

- 🤖 **Multiple AI Models**: Choose from GPT-4, Claude, Deepseek, Qwen, Janus, and local Ollama
- 💰 **Cost Tracking**: Monitor API costs and savings in real-time
- 👁️ **Multimodal Support**: Screenshot to code, image analysis
- 📝 **Code Actions**: Explain, refactor, fix, and generate tests
- 🔄 **Diff Preview**: Review changes before applying
- 📁 **File System Access**: Full workspace context and file operations
- 🎯 **Smart Context**: Automatic workspace and file context

## Installation

### From Source

1. Clone the repository
2. Navigate to `apps/coder`
3. Run `npm install`
4. Run `npm run compile`
5. Press F5 to launch extension in development mode

### From VSIX

1. Download the latest `.vsix` file
2. Run `code --install-extension sushi-coder-0.0.1.vsix`

## Setup

1. Open VS Code settings (Cmd/Ctrl + ,)
2. Search for "Sushi"
3. Set your API key: `sushi.apiKey`
4. Choose default model: `sushi.defaultModel`

## Usage

### Chat Interface

1. Click the Sushi icon in the activity bar
2. Select your preferred AI model
3. Type your question or request
4. View cost tracking in real-time

### Context Menu Actions

Right-click on selected code:

- **Explain Code**: Get detailed explanation
- **Refactor Code**: Improve code quality
- **Fix Code**: Auto-fix errors and issues

### Commands

- `Sushi: Open Chat` - Open chat interface
- `Sushi: Explain Selected Code` - Explain selection
- `Sushi: Refactor Code` - Refactor selection
- `Sushi: Generate Tests` - Create unit tests
- `Sushi: Fix Code` - Fix errors
- `Sushi: Screenshot to Code` - Convert UI to code

### Keyboard Shortcuts

- `Cmd/Ctrl + Enter` in chat - Send message
- Right-click selection - Quick actions

## Model Selection

### Premium ($$$)

- **GPT-4 Turbo**: Best quality, vision support - $0.01/1K tokens
- **Claude 3 Opus**: Excellent for code review - $0.015/1K tokens

### Balanced ($$) - Recommended

- **GPT-4o Mini**: Great balance, vision - $0.00015/1K tokens ⭐
- **Claude 3 Haiku**: Fast responses - $0.00025/1K tokens
- **Deepseek Coder**: Specialized for code - $0.00014/1K tokens 🔥

### Budget ($)

- **Qwen VL**: Cheap multimodal - $0.0001/1K tokens
- **Janus Pro**: Your multimodal - $0.0002/1K tokens
- **Ollama Local**: FREE, offline 🎉

## Cost Savings

Using smart model selection can save up to **79%** compared to GPT-4 only:

- Simple completions → Deepseek Coder
- Screenshot analysis → Janus Pro
- Complex refactoring → GPT-4 Turbo

## Configuration

```json
{
  "sushi.apiKey": "your-api-key",
  "sushi.defaultModel": "gpt-4o-mini",
  "sushi.autoSave": true,
  "sushi.showDiff": true
}
```

## Development

### Build

```bash
npm run compile
```

### Watch Mode

```bash
npm run watch
```

### Package

```bash
npm run package
```

### Publish

```bash
npm run publish
```

## Architecture

- **Extension Host**: `src/extension.ts` - Main entry point
- **Chat Provider**: `src/providers/chatProvider.ts` - Webview and API
- **Modified Files**: `src/providers/modifiedFilesProvider.ts` - Track changes
- **Webview**: Embedded Chrry UI with VS Code integration

## Roadmap

- [ ] Inline code completion (like Copilot)
- [ ] Multi-file refactoring
- [ ] Code review mode
- [ ] Terminal integration
- [ ] Git integration
- [ ] Custom model providers
- [ ] Offline mode improvements

## License

MIT

## Support

- GitHub: https://github.com/your-org/sushi
- Discord: https://discord.gg/sushi
- Docs: https://docs.sushi.dev
