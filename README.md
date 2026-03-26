
# notion-vibe-text-editor

[![npm version](https://badge.fury.io/js/notion-vibe-text-editor.svg)](https://www.npmjs.com/package/notion-vibe-text-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/notion-vibe-text-editor.svg)](https://www.npmjs.com/package/notion-vibe-text-editor)

A premium, Notion-style rich text editor for React — powered by [BlockNote](https://www.blocknotejs.org/). Drop it into any React app and get AI writing, Cloudinary media uploads, 150+ Google Fonts, voice typing, and more — all out of the box.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📝 **Block-Based Editing** | Notion-style `/` slash menu with headings, lists, tables, code blocks, quotes, toggles, and more |
| 🤖 **AI Writing Assistant** | Built-in AI text generation via any OpenAI-compatible API |
| 🎙️ **Voice Typing** | Speak to type with 30+ language support — just type `/voice` |
| ☁️ **Cloudinary Media** | Drag & drop images, videos, audio, and files — auto-uploaded to Cloudinary |
| 🗑️ **Auto Cleanup** | Media deleted from the editor is automatically removed from Cloudinary (with 5s grace period for undo) |
| 🔤 **150+ Google Fonts** | Categorized font picker: Sans, Serif, Display, Handwriting, Monospace, and Unique styles |
| 🔠 **Custom Font Sizes** | Dropdown presets + type any exact pixel size + increment/decrement buttons |
| 📰 **Title & Slug** | Beautiful title input with auto-generated URL slug (spaces → hyphens, lowercase, clean) |
| 🎨 **Rich Formatting** | Bold, italic, underline, strikethrough, text color, text alignment, nested blocks, links |
| 📖 **Read-Only Mode** | Set `editable={false}` to render content as a clean viewer |

---

## 📦 Installation

```bash
npm install notion-vibe-text-editor
```


---

## 🚀 Quick Start

```tsx
import { useState } from "react";
import { Editor } from "notion-vibe-text-editor";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";

function App() {
  const [content, setContent] = useState("");

  return (
    <MantineProvider>
      <Editor
        initialContent={""}
        onChange={(json) => setContent(json)}
      />
    </MantineProvider>
  );
}
```

That's it — you now have a full-featured Notion-like editor! 🎉

---

## 🔧 Full Example (All Features)

```tsx
import { useState } from "react";
import { Editor } from "notion-vibe-text-editor";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";

function App() {
  const [content, setContent] = useState("");

  return (
    <MantineProvider>
      <Editor
        // Core
        initialContent={""}
        onChange={(json) => setContent(json)}
        editable={true}

        // Title & Slug
        showSlug={true}
        onTitleChange={(title) => console.log("Title:", title)}
        onSlugChange={(slug) => console.log("Slug:", slug)}

        // Cloudinary Media Uploads
        cloudinaryConfig={{
          apiKey: "YOUR_CLOUDINARY_API_KEY",
          apiSecret: "YOUR_CLOUDINARY_API_SECRET",
          cloudName: "YOUR_CLOUD_NAME",
          folderName: "uploads",
        }}

        // AI Writing Assistant
        aiConfig={{
          apiKey: "YOUR_AI_API_KEY",
          modelName: "gpt-4o-mini",           // optional
          apiBaseUrl: "https://api.openai.com/v1", // optional
          proxyUrl: "https://your-proxy.com",      // optional, for CORS
        }}
      />
    </MantineProvider>
  );
}
```

---

## 📋 Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onChange` | `(value: string) => void` | **Required** | Called on every change. Returns stringified JSON of all blocks. |
| `initialContent` | `string` | `undefined` | Initial editor content as stringified JSON. |
| `editable` | `boolean` | `true` | Set to `false` for read-only viewer mode. |
| `showSlug` | `boolean` | `false` | Shows a title + slug input above the editor. |
| `onTitleChange` | `(title: string) => void` | `undefined` | Callback when the title changes. |
| `onSlugChange` | `(slug: string) => void` | `undefined` | Callback when the slug changes. Slug auto-formats: lowercase, spaces → hyphens, no special chars. |
| `cloudinaryConfig` | `object` | `undefined` | `{ apiKey, apiSecret, cloudName, folderName }` — enables drag & drop media uploads. |
| `aiConfig` | `object` | `undefined` | `{ apiKey, modelName?, apiBaseUrl?, proxyUrl? }` — enables AI writing features. |

---

## 🎙️ Voice Typing

Type `/voice` in the editor to start voice typing. A red pulsing bar appears with:

- **Language selector** — choose from 30+ languages including:
  - 🇺🇸 English, 🇧🇩 বাংলা, 🇮🇳 हिन्दी, 🇸🇦 العربية, 🇨🇳 中文, 🇯🇵 日本語, 🇰🇷 한국어, 🇪🇸 Español, 🇫🇷 Français, 🇩🇪 Deutsch, 🇷🇺 Русский, 🇵🇰 اردو, and many more
- **Stop button** — end recording at any time
- **Switch language mid-recording** — it restarts with the new language automatically

> Uses the browser's native Web Speech API — no external API calls needed.

---

## ☁️ Cloudinary Integration

When `cloudinaryConfig` is provided:

- **Upload**: Drag & drop or use `/image`, `/video`, `/audio`, `/file` commands
- **Auto-delete**: When you remove a media block from the editor, the file is automatically deleted from Cloudinary after a **5-second grace period** (so cut & paste doesn't lose your files)
- **Signed uploads**: All uploads use signed Cloudinary API requests

---

## 🤖 AI Integration

When `aiConfig` is provided, type `/AI` in the slash menu to access the AI assistant. Compatible with:

- OpenAI (`gpt-4o`, `gpt-4o-mini`, etc.)
- Any OpenAI-compatible API (Groq, Together, LongCat, etc.)
- Self-hosted models via custom `apiBaseUrl`

---

## 🎨 Typography

The editor includes **150+ Google Fonts** automatically loaded and organized into categories:

- **Sans Serif** — Inter, Roboto, Poppins, Montserrat, DM Sans, etc.
- **Serif** — Playfair Display, Lora, Merriweather, EB Garamond, etc.
- **Display** — Bebas Neue, Oswald, Anton, Orbitron, etc.
- **Handwriting** — Pacifico, Dancing Script, Caveat, etc.
- **Monospace** — JetBrains Mono, Fira Code, Source Code Pro, etc.
- **Unique** — Major Mono Display, Zen Dots, Codystar, etc.

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Add More Fonts

1. **Fork** this repository
2. Open `src/components/Editor.tsx` and find the fonts array in the `useEffect`
3. Add your Google Font name to the appropriate category
4. Test with `npm run dev` in the `test-app` directory
5. Submit a **Pull Request**

> The editor dynamically loads Google Fonts — just add the font name and it works!

### Other Contributions

- 🐛 **Bug reports** — Open an issue with reproduction steps
- 💡 **Feature requests** — Suggest new features via issues
- 📝 **Documentation** — Improve this README or add examples
- 🔧 **Code** — Fix bugs or implement features from the issues list

---

## 📄 License

[MIT](https://github.com/nurahmed123/Notion-Vibe-Text-Editor/blob/main/LICENSE) © [Md Nur Ahmad](https://github.com/nurahmed123)

---

**Built with ❤️ - Md Nur Ahmad**
