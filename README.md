# Runa - Markdown Note-Taking App

<img src="docs/app-icon.png" alt="Runa markdown note-taking app screenshot" width="200" height="200">

Runa is an open-source markdown note-taking application built with Tauri for macOS, Windows, Linux, iOS, and Android. Your notes are stored as plain `.md` files on your computer—no cloud, no lock-in.

Unlike Obsidian or Notion, Runa is lightweight (~20MB) and works completely offline. It combines a WYSIWYG editor with markdown editing, full-text search, wikilinks, and Git integration.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/brenogonzaga/runa)](https://github.com/brenogonzaga/runa/issues)
[![GitHub stars](https://img.shields.io/github/stars/brenogonzaga/runa)](https://github.com/brenogonzaga/runa)

[Website](https://www.brenogonzaga.com/runa) · [Download](https://github.com/brenogonzaga/runa/releases)

---

**Quick links:** [Features](#features) · [Installation](#installation) · [Keyboard Shortcuts](#keyboard-shortcuts) · [FAQ](#faq) · [Contributing](#contributing)

---

## Features

### Core Editing

- **WYSIWYG editor** - Rich text editing with TipTap that saves to markdown
- **Markdown source mode** - Toggle between visual and raw markdown editing (`Cmd+Shift+M`)
- **Wikilinks** - Type `[[` to link between notes with autocomplete suggestions
- **Slash commands** - Type `/` for quick access to headings, lists, code blocks, tables
- **Focus mode** - Hide sidebar and toolbar for distraction-free writing (`Cmd+Shift+Enter`)

### Search & Organization

- **Full-text search** - Powered by Tantivy (Rust's fastest search engine)
- **Command palette** - Quick access to notes and commands (`Cmd+P`)
- **File change detection** - Auto-reloads when external tools modify notes

### Sync & Integration

- **Offline-first** - No cloud, no account, no internet required
- **Git integration** - Version control with commit/push/pull for multi-device sync
- **AI-friendly** - Works with Claude Code CLI, Cursor, Windsurf, and other AI coding tools
- **Plain markdown files** - Notes stored as `.md` files you can edit anywhere

### Platform & Customization

- **Cross-platform** - macOS, Windows, Linux, iOS, Android
- **Lightweight** - ~20MB install (vs 200MB+ for Obsidian/Electron apps)
- **Multi-language** - English, Portuguese, Spanish, French, German, Japanese, Chinese
- **Customizable** - Themes (light/dark), typography, page width, text direction, zoom

## Screenshot

![Runa app interface showing markdown editor with sidebar](docs/screenshot.png)

## Use Cases

Runa works well for:

- Personal knowledge bases and digital gardens
- Technical documentation and developer notes
- Academic research and literature notes
- Blog post drafts and creative writing
- Code snippets and learning notes
- Any workflow involving markdown files and version control

## Installation

### macOS

**Homebrew:**

```bash
brew tap brenogonzaga/tap
brew install --cask brenogonzaga/tap/runa
```

**Manual:**

Download the `.dmg` from [Releases](https://github.com/brenogonzaga/runa/releases), open it, and drag Runa to Applications.

### Windows

Download the `.exe` installer from [Releases](https://github.com/brenogonzaga/runa/releases) and run it. WebView2 will be downloaded automatically if needed.

### Linux

**AppImage:**

```bash
wget https://github.com/brenogonzaga/runa/releases/latest/download/Runa.AppImage
chmod +x Runa.AppImage
./Runa.AppImage
```

**Debian/Ubuntu:**

```bash
wget https://github.com/brenogonzaga/runa/releases/latest/download/runa_amd64.deb
sudo dpkg -i runa_amd64.deb
```

### Mobile

- **iOS**: Coming soon
- **Android**: Coming soon

## Building from Source

**Prerequisites:** Node.js 18+, Rust 1.70+, and platform-specific tools:

- macOS: Xcode Command Line Tools
- Windows: WebView2 Runtime
- Linux: `webkit2gtk`, `libayatana-appindicator3`

```bash
git clone https://github.com/brenogonzaga/runa.git
cd runa
npm install
npm run tauri dev      # Development
npm run tauri build    # Production build
```

For mobile builds, see [Tauri Mobile Docs](https://v2.tauri.app/develop/mobile/).

## Keyboard Shortcuts

| Shortcut          | Action                 |
| ----------------- | ---------------------- |
| `Cmd+N`           | New note               |
| `Cmd+P`           | Command palette        |
| `Cmd+K`           | Add/edit link          |
| `Cmd+F`           | Find in note           |
| `Cmd+Shift+F`     | Search notes           |
| `Cmd+Shift+M`     | Toggle Markdown source |
| `Cmd+Shift+Enter` | Toggle Focus mode      |
| `Cmd+Shift+C`     | Copy & Export menu     |
| `Cmd+R`           | Reload current note    |
| `Cmd+,`           | Open settings          |
| `Cmd+\`           | Toggle sidebar         |
| `Cmd+B/I`         | Bold/Italic            |
| `Cmd+=/-/0`       | Zoom in/out/reset      |
| `↑/↓`             | Navigate notes         |

On Windows/Linux, use `Ctrl` instead of `Cmd`.

## FAQ

**How is this different from Obsidian?**  
Both use local markdown files, but Runa is 5-10x smaller (Tauri vs Electron) and simpler. Obsidian has a plugin ecosystem; Runa focuses on core features done well.

**Can I sync my notes across devices?**  
Yes. Use Git (built-in), iCloud Drive, Dropbox, or any file sync service. Your notes are just files in a folder. You can sync them.

**Will my notes work in other apps?**  
Completely. Notes are standard `.md` files with no proprietary formatting. Use them in VS Code, Vim, Obsidian, or any text editor.

**Does this work with AI coding assistants?**  
Yes. Runa detects external file changes automatically, so it works great with Cursor, Windsurf, Claude Code CLI, and similar tools.

## Technology Stack (Tauri, React, Rust)

- [Tauri v2](https://v2.tauri.app/) - Cross-platform framework (Rust + WebView)
- [React 19](https://react.dev/) - UI library
- [TipTap](https://tiptap.dev/) - WYSIWYG markdown editor
- [Tailwind CSS v4](https://tailwindcss.com/) - Styling
- [Tantivy](https://github.com/quickwit-oss/tantivy) - Full-text search engine
- [i18next](https://www.i18next.com/) - Internationalization

## Contributing

Contributions are welcome. Runa focuses on a minimal feature set, so not every feature will be a fit.

**Small fixes** (typos, bugs, performance) - go ahead and open a PR.

**New features** - open an issue or discussion first.

**Code quality**:

- Follow existing code style
- Write meaningful commit messages
- Test your changes
- Address CI feedback

For development setup, see [Building from Source](#building-from-source). Architecture details are in [CLAUDE.md](CLAUDE.md).

**Translations**: Add a new language by copying `i18n/en.json` and submitting a PR.

## About the Project

Runa is designed for people who want a fast, private note-taking app without vendor lock-in. Your notes are just markdown files—you can move them anywhere, version control them with Git, or edit them with any text editor.

The project is open-source (MIT license) and built with modern web technologies for native-like performance on all platforms.

## Acknowledgments

Runa is a fork of [Scratch](https://github.com/erictli/scratch) by [Eric Li](https://github.com/erictli). Thank you for creating such a great foundation!

## License

MIT - See [LICENSE](LICENSE) for details.

## Links

- Website: [https://www.brenogonzaga.com/runa](https://www.brenogonzaga.com/runa)
- Download Runa: [https://github.com/brenogonzaga/runa/releases](https://github.com/brenogonzaga/runa/releases)
- Report issues: [https://github.com/brenogonzaga/runa/issues](https://github.com/brenogonzaga/runa/issues)
- Community discussions: [https://github.com/brenogonzaga/runa/discussions](https://github.com/brenogonzaga/runa/discussions)
- Source code: [https://github.com/brenogonzaga/runa](https://github.com/brenogonzaga/runa)

---

**Topics:** markdown editor, note-taking app, tauri, rust, react, wikilinks, obsidian alternative, offline-first, open-source, cross-platform, knowledge base, personal wiki, git integration
