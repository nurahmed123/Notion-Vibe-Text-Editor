# notion-vibe-text-editor

A beautifully styled, Notion-like rich text editor for React applications. Built on top of [BlockNote](https://www.blocknotejs.org/), this package adds gorgeous custom fonts (Google Fonts integration), an advanced resizable font-size controller, drag-and-drop media uploads to Cloudinary, and AI integration for generative text editing out-of-the-box.

## Features

- **Notion-style Slash Menu & Blocks**: Write smoothly with `/` commands.
- **AI Integration built-in**: Use OpenAI-compatible APIs (like LongCat-Flash-Chat) for auto-completion and generative tools. 
- **Cloudinary Integration**: Direct client-side uploads dragging and dropping media elements into the editor.
- **Extended Typography**: Dropdown to select dozens of Google Fonts across different visual styles (Serif, Sans, Retro, GenZ, Monospace, etc.).
- **Font Size Select**: Select specific pixel sizes via dropdown or type exact custom sizes.
- **Slug / Document Title**: Optionally enable a large elegant document title input.

## Installation

You can install the editor via npm or yarn. The package comes pre-packaged with all its layout and icon dependencies.

```bash
npm install notion-vibe-text-editor
```

## Setup

1. **MantineProvider**: The editor requires a `<MantineProvider>` wrapping your application (or wrapping the editor).
2. **CSS Imports**: You must import the Mantine base styles and standard CSS in your application's entry point.

## Usage

```tsx
import { useState } from 'react';
import { Editor } from 'notion-vibe-text-editor';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
// Note: Ensure your project handles tailwindcss appropriately

function App() {
  const [content, setContent] = useState("");
  const [slug, setSlug] = useState("");

  return (
    <MantineProvider>
      <div style={{ maxWidth: 900, margin: '40px auto' }}>
        <Editor 
          // 1. Core Props
          initialContent={""} // Pass a stringified JSON of previous BlockNote blocks
          onChange={(jsonValue) => setContent(jsonValue)}
          editable={true}
          
          // 2. Headings
          showSlug={true}
          onSlugChange={(newSlug) => setSlug(newSlug)}
          
          // 3. Media Uploads
          cloudinaryConfig={{
            apiKey: 'YOUR_CLOUDINARY_API_KEY',
            apiSecret: 'YOUR_CLOUDINARY_API_SECRET',
            cloudName: 'YOUR_CLOUD_NAME',
            folderName: 'YOUR_FOLDER',
          }}
          
          // 4. AI Generator
          aiConfig={{ 
            apiKey: 'YOUR_AI_API_KEY',
            // modelName: 'LongCat-Flash-Chat', (optional)
            // apiBaseUrl: 'https://api.longcat.chat/openai/v1', (optional)
            // proxyUrl: '...', (optional proxy for CORS)
          }}
        />
      </div>
    </MantineProvider>
  );
}

export default App;
```

## API Reference

### `<Editor />` Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onChange` | `(value: string) => void` | **Required** | Called on every block or text change. Parameter is stringified JSON block array. |
| `initialContent` | `string` | `undefined` | The starting content of the editor, as stringified JSON. |
| `editable` | `boolean` | `true` | When false, locks the editor into a read-only viewer. |
| `showSlug` | `boolean` | `false` | Displays a massive primary Title / Header input above the editor. |
| `onSlugChange` | `(slug: string) => void` | `undefined` | Callback for when the Title/Slug changes. |
| `cloudinaryConfig` | `object` | `undefined` | Object containing `apiKey`, `apiSecret`, `cloudName`, and `folderName`. Needed for image/file uploads. |
| `aiConfig` | `object` | `undefined` | Config to power the Slash menu AI functions. Contains `apiKey`, `modelName`, `apiBaseUrl`, and `proxyUrl`. |

## License

[MIT](https://github.com/nurahmed123/notion-vibe-text-editor/blob/main/LICENSE) © [Md Nur Ahmad](https://github.com/nurahmed123)

---
*Built tightly with `@blocknote/react` under the hood for a true unopinionated block-based editing experience.*
