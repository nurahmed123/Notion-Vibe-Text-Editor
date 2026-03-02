# notion-vibe-text-editor

A premium, cross-framework rich text editor powered by [BlockNote](https://www.blocknotejs.org/) and Mantine. It provides a Notion-like editing experience with custom fonts, colors, slashing menus, and built-in AI streaming support.

## Features

- Notion-style block editor.
- Built-in UI for AI Text Generation interactions.
- Direct Cloudinary integration for Image/Video/Audio uploads.
- Extensible styling (Font size, font family).
- Works with React / Next.js, and directly in HTML using Vanilla JS (ideal for Laravel, WordPress, etc).

## Installation

```bash
npm install notion-vibe-text-editor
```
or
```bash
yarn add notion-vibe-text-editor
```

## Usage

### 1. React / Next.js

Import the `Editor` component and the CSS.

```tsx
import { useState } from 'react';
import { Editor } from 'notion-vibe-text-editor';
import 'notion-vibe-text-editor/dist/style.css';

export default function MyEditor() {
  const [content, setContent] = useState("");

  return (
    <Editor 
      initialContent={content}
      onChange={(value) => setContent(value)}
      
      // Easily upload media directly to Cloudinary
      cloudinary={{
        cloudName: "your-cloud-name",
        uploadPreset: "your-unsigned-preset",
        folder: "editor-uploads" // Optional
      }}
      
      // Option A: Connect to your backend AI provider (Recommended for production)
      ai={{
        streamUrl: "/api/ai/stream" // Path to your Vercel AI SDK or custom text streaming endpoint
      }}
      
      /* Option B: Direct Client-Side Configuration (For internal apps or local LLMs)
      ai={{
        clientSide: {
          apiKey: "your-provider-api-key",
          baseURL: "https://api.openai.com/v1", // Optional: defaults to OpenAI, can be changed to OpenRouter/Anthropic etc
          model: "gpt-4o-mini"
        }
      }}
      */

      // Set to true if you are not already using MantineProvider globally
      withMantineProvider={true} 
    />
  );
}
```

### 2. Vanilla JS / Laravel / HTML

If you are not using React, you can render the editor into any DOM element using our Vanilla JS wrapper. It bundles and mounts the React roots natively.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Editor App</title>
  <!-- Load styles -->
  <link rel="stylesheet" href="/path/to/node_modules/notion-vibe-text-editor/dist/style.css">
</head>
<body>
  
  <!-- Container where the editor will mount -->
  <div id="editor-root"></div>

  <!-- Load the script -->
  <script type="module">
    import { createNotionEditor } from '/path/to/node_modules/notion-vibe-text-editor/dist/notion-vibe-text-editor.es.js';

    const editorInstance = createNotionEditor('editor-root', {
      initialContent: "",
      onChange: (content) => {
        console.log("Content changed:", content);
      },
      cloudinary: {
        cloudName: "your-cloud-name",
        uploadPreset: "your-unsigned-preset",
      },
      // Option A: Connect to your backend
      ai: {
        streamUrl: "/api/ai/stream"
      }
      
      /* Option B: Direct Client-Side Configuration
      ai: {
        clientSide: {
          apiKey: "sk-...",
          model: "gpt-4o"
        }
      }
      */
    });

    // To destroy later:
    // editorInstance.destroy();
  </script>
</body>
</html>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onChange` | `(value: string) => void` | **Required** | Callback when the document content updates. Value is a JSON string of blocks. |
| `initialContent` | `string` | `undefined` | The initial JSON string to parse and render. |
| `editable` | `boolean` | `true` | Determine if the editor content can be edited. |
| `cloudinary` | `{ cloudName: string, uploadPreset: string, folder?: string }` | `undefined` | Configuration to upload files directly to Cloudinary. Make sure to use an **unsigned** upload preset. |
| `customUploadFile` | `(file: File) => Promise<string>` | `undefined` | Complete override for custom upload logic if not using Cloudinary. Must return the final absolute URL of the file explicitly. |
| `ai` | `{ streamUrl?: string, customFetch?: typeof fetch, clientSide?: { apiKey: string, baseURL?: string, model: string } }` | `{ streamUrl: "/api/ai/regular/streamText" }` | Configuration for the AI assistant block. Provide a backend endpoint using Vercel AI SDK compatible stream format (`streamUrl`), OR directly configure an OpenAI-compatible provider using the `clientSide` object (WARNING: exposes API keys on the frontend). |
| `withMantineProvider` | `boolean` | `false` | In React environments, if you do not have `<MantineProvider>` set up in your app root, set this to `true` to wrap the editor in one correctly. Automatically `true` when initialized in vanilla JS. |

## License

MIT
