"use client";

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/xl-ai/style.css";
import "../styles.css";
import {
  useCreateBlockNote,
  FormattingToolbarController,
  FormattingToolbar,
  BlockTypeSelect,
  BasicTextStyleButton,
  TextAlignButton,
  ColorStyleButton,
  NestBlockButton,
  CreateLinkButton,
  useSelectedBlocks,
  FileCaptionButton,
  FileReplaceButton,
  FileRenameButton,
  FileDeleteButton,
  FileDownloadButton,
  FilePreviewButton,
  blockTypeSelectItems,
  BlockTypeSelectItem,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  createReactStyleSpec,
} from "@blocknote/react";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { en as bnEn } from "@blocknote/core/locales";
import {
  Block,
  defaultStyleSpecs,
  BlockNoteSchema,
  defaultBlockSpecs,
  createCodeBlockSpec,
} from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";
import {
  AIExtension,
  AIToolbarButton,
  AIMenuController,
  getAISlashMenuItems,
  ClientSideTransport,
  fetchViaProxy,
} from "@blocknote/xl-ai";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { Baseline, Check, ChevronDown, Minus, Plus, AlertTriangle } from "lucide-react";
import { Menu, ActionIcon, Tooltip, Text, Group, Divider, TextInput } from "@mantine/core";
import { Alert } from "./Alert";
import { ArrowConversionExtension } from "./ArrowConversionExtension";

export interface EditorProps {
  onChange: (value: string) => void;
  initialContent?: string;
  editable?: boolean;
  showSlug?: boolean;
  onSlugChange?: (slug: string) => void;
  cloudinaryConfig?: {
    apiKey: string;
    apiSecret: string;
    cloudName: string;
    folderName: string;
  };
  aiConfig?: {
    apiKey?: string;
    proxyUrl?: string;
    modelName?: string;
    apiBaseUrl?: string;
  };
}

const createLongCatFetch = (): typeof fetch => {
  return async (input, init) => {
    if (!init || !init.body) return fetch(input, init);
    const body = JSON.parse(init.body as string);
    const tools = body.tools || [];
    delete body.tools;
    delete body.tool_choice;

    body.messages = (body.messages || []).filter((m: any) => m.role !== "tool").map((m: any) => {
      let content = "";
      if (typeof m.content === "string") content = m.content;
      else if (Array.isArray(m.content)) content = m.content.map((p: any) => typeof p === "string" ? p : p?.text ?? JSON.stringify(p)).join("\n");
      else if (m.content != null) content = String(m.content);
      return { role: m.role, content };
    });

    if (tools.length > 0) {
      const toolSchemas = tools.map((t: any) => ({
        name: t.function?.name ?? t.name,
        description: t.function?.description ?? t.description ?? "",
        parameters: t.function?.parameters ?? t.parameters ?? {},
      }));
      const toolPrompt = `\n\n## TOOL CALLING FORMAT (MANDATORY)\nYou MUST respond with ONLY a raw JSON tool call. No text, no explanation, no markdown.\n\nEXACT format:\n[{"name":"TOOL_NAME","parameters":ARGS_OBJECT}]\n\nAvailable tools:\n${JSON.stringify(toolSchemas, null, 2)}\n\nRULES:\n1. Output ONLY raw JSON\n2. Always use one of the tool names listed\n3. Arguments must match exactly\n4. Your response must start with [ and end with ]`;
      const sysIdx = body.messages.findIndex((m: any) => m.role === "system");
      if (sysIdx >= 0) body.messages[sysIdx].content += toolPrompt;
      else body.messages.unshift({ role: "system", content: toolPrompt });
      body.messages.push({ role: "system", content: "Respond with ONLY the JSON tool call array. No other text." });
    }

    const toolName = tools[0]?.function?.name || "applyDocumentOperations";
    body.stream = true;

    const upstream = await fetch(input, { ...init, body: JSON.stringify(body) });

    if (!upstream.ok || !tools.length) return upstream;

    const chatId = `chatcmpl-${Date.now().toString(36)}`;
    const callId = `call_${Math.random().toString(36).slice(2, 10)}`;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const makeSSE = (d: unknown) => encoder.encode(`data: ${JSON.stringify(d)}\n\n`);
    const makeArgChunk = (args: string) => makeSSE({ id: chatId, object: "chat.completion.chunk", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: args } }] }, finish_reason: null }] });

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = upstream.body!.getReader();

    (async () => {
      try {
        await writer.write(makeSSE({ id: chatId, object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content: null, tool_calls: [{ index: 0, id: callId, type: "function", function: { name: toolName, arguments: "" } }] }, finish_reason: null }] }));

        let prefixBuffer = "";
        let prefixStripped = false;
        let trailing = "";
        let lineFragment = "";

        async function emitWithTrailing(text: string) {
          const combined = trailing + text;
          if (combined.length <= 2) { trailing = combined; return; }
          const toSend = combined.slice(0, -2);
          trailing = combined.slice(-2);
          await writer.write(makeArgChunk(toSend));
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const rawText = decoder.decode(value, { stream: true });
          const text = lineFragment + rawText;
          const lines = text.split("\n");
          lineFragment = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed.slice(5);
            if (dataStr === "[DONE]") continue;

            let contentDelta = "";
            try {
              const chunk = JSON.parse(dataStr);
              const d = chunk.choices?.[0]?.delta?.content;
              if (typeof d !== "string" || d.length === 0) continue;
              contentDelta = d;
            } catch { continue; }

            if (!prefixStripped) {
              prefixBuffer += contentDelta;
              const paramIdx = prefixBuffer.indexOf('"parameters":');
              if (paramIdx >= 0) {
                prefixStripped = true;
                const afterParam = prefixBuffer.slice(paramIdx + 13);
                prefixBuffer = "";
                if (afterParam.length > 0) await emitWithTrailing(afterParam);
              } else if (prefixBuffer.length > 500) {
                prefixStripped = true;
                const all = prefixBuffer;
                prefixBuffer = "";
                await emitWithTrailing(all);
              }
            } else {
              await emitWithTrailing(contentDelta);
            }
          }
        }

        if (lineFragment.trim().startsWith("data:")) {
          const dataStr = lineFragment.trim().replace(/^data:\s*/, "");
          if (dataStr !== "[DONE]") {
            try {
              const chunk = JSON.parse(dataStr);
              const d = chunk.choices?.[0]?.delta?.content;
              if (typeof d === "string" && d.length > 0) {
                if (prefixStripped) await emitWithTrailing(d);
                else prefixBuffer += d;
              }
            } catch {}
          }
        }

        let remaining = trailing;
        if (remaining.endsWith("}]")) remaining = "";
        else if (remaining.endsWith("]")) remaining = remaining.slice(0, -1);
        else if (remaining.endsWith("}")) remaining = remaining.slice(0, -1);

        if (remaining.length > 0) await writer.write(makeArgChunk(remaining));
        if (!prefixStripped && prefixBuffer.length > 0) await writer.write(makeArgChunk(prefixBuffer));

        await writer.write(makeSSE({ id: chatId, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }));
        await writer.write(encoder.encode("data: [DONE]\n\n"));
        await writer.close();
      } catch (e) {
        console.error("Stream error:", e);
        try { await writer.abort(e); } catch {}
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: { "content-type": "text/event-stream; charset=utf-8" },
    });
  };
};

export function Editor({
  onChange,
  initialContent,
  editable = true,
  showSlug = false,
  onSlugChange,
  cloudinaryConfig,
  aiConfig,
}: EditorProps) {
  const prevBlocksRef = useRef<Block[]>([]);
  const [slug, setSlug] = useState("");

  const extractMediaUrls = (blocks: Block[]): string[] => {
    const urls: string[] = [];
    const traverse = (items: Block[]) => {
      items.forEach((block) => {
        if (
          (block.type === "image" ||
            block.type === "video" ||
            block.type === "audio" ||
            block.type === "file") &&
          block.props.url
        ) {
          urls.push(block.props.url);
        }
        if (block.children) {
          traverse(block.children);
        }
      });
    };
    traverse(blocks);
    return urls;
  };

  const generateSignature = async (timestamp: number, publicId: string | null = null) => {
    if (!cloudinaryConfig) return "";
    let str = "";
    if (cloudinaryConfig.folderName) str += `folder=${cloudinaryConfig.folderName}&`;
    if (publicId) str += `public_id=${publicId}&`;
    str += `timestamp=${timestamp}${cloudinaryConfig.apiSecret}`;

    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-1", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const uploadFile = async (file: File) => {
    if (!cloudinaryConfig) {
      throw new Error("Cloudinary configuration missing");
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await generateSignature(timestamp);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", cloudinaryConfig.apiKey);
    formData.append("timestamp", timestamp.toString());
    formData.append("signature", signature);
    if (cloudinaryConfig.folderName) {
      formData.append("folder", cloudinaryConfig.folderName);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Failed to upload file");
    }

    const data = await response.json();
    return data.secure_url;
  };

  const schema = useMemo(() => {
    const base = BlockNoteSchema.create({
      styleSpecs: {
        ...defaultStyleSpecs,
        fontSize: createReactStyleSpec(
          {
            type: "fontSize",
            propSchema: "string",
          },
          {
            render: (props) => (
              <span
                data-font-size={props.value}
                style={{ "--bn-font-size": props.value } as React.CSSProperties}
                ref={props.contentRef}
              />
            ),
          }
        ),
        fontFamily: createReactStyleSpec(
          {
            type: "fontFamily",
            propSchema: "string",
          },
          {
            render: (props) => (
              <span
                data-font-family={props.value}
                style={{ "--bn-font-family": props.value } as React.CSSProperties}
                ref={props.contentRef}
              />
            ),
          }
        ),
      },
    });
    return base.extend({
      blockSpecs: {
        ...defaultBlockSpecs,
        alert: Alert(),
        codeBlock: createCodeBlockSpec(codeBlockOptions),
      },
    });
  }, []);

  const safeInitialBlocks = useMemo(() => {
    if (!initialContent) return undefined;
    try {
      return JSON.parse(initialContent) as Block[];
    } catch {
      return undefined;
    }
  }, [initialContent]);

  const extensions = [];
  if (aiConfig && (aiConfig.apiKey || aiConfig.proxyUrl)) {
    const defaultUrl = "https://api.longcat.chat/openai/v1";
    const isLongCat = (aiConfig.apiBaseUrl || defaultUrl).includes("longcat");
    let customFetch: typeof fetch | undefined = undefined;
    
    if (aiConfig.proxyUrl) {
      customFetch = fetchViaProxy((url) => `${aiConfig.proxyUrl}?url=${encodeURIComponent(url as string)}`);
    } else if (isLongCat) {
      customFetch = createLongCatFetch();
    }

    extensions.push(
      AIExtension({
        transport: new ClientSideTransport({
          model: createOpenAICompatible({
            name: "custom-ai",
            baseURL: aiConfig.apiBaseUrl || defaultUrl,
            apiKey: aiConfig.apiKey || "proxy-key",
            fetch: customFetch,
          })(aiConfig.modelName || "LongCat-Flash-Chat"),
        }),
      })
    );
  }

  const editor = useCreateBlockNote({
    dictionary: {
      ...bnEn,
      ai: aiEn,
    },
    extensions,
    _tiptapOptions: {
      extensions: [ArrowConversionExtension],
    },
    initialContent: safeInitialBlocks,
    uploadFile: cloudinaryConfig ? uploadFile : undefined,
    schema,
  });

  useEffect(() => {
    if (editor.document) {
      prevBlocksRef.current = editor.document as any as Block[];
    }
  }, [editor.document]);

  useEffect(() => {
    const fonts = [
      // Sans Serif
      "Roboto:wght@400;700", "Open+Sans:wght@400;700", "Lato:wght@400;700", "Poppins:wght@400;700", "Raleway:wght@400;700",
      "Nunito:wght@400;700", "Ubuntu:wght@400;700", "Quicksand:wght@400;700", "Rubik:wght@400;700", "Work+Sans:wght@400;700",
      "Kanit:wght@400;700", "Barlow:wght@400;700", "Mulish:wght@400;700", "DM+Sans:wght@400;700", "PT+Sans:wght@400;700",
      "IBM+Plex+Sans:wght@400;700", "Josefin+Sans:wght@400;700", "Titillium+Web:wght@400;700", "Manrope:wght@400;700", "Dosis:wght@400;700",
      "Mukta:wght@400;700", "Chakra+Petch:wght@400;700", "Source+Sans+3:wght@400;700", "Inter:wght@400;700", "Montserrat:wght@400;700",
      "Outfit:wght@400;700", "Comfortaa:wght@400;700",

      // Serif
      "Roboto+Slab:wght@400;700", "Merriweather:wght@400;700", "PT+Serif:wght@400;700", "Noto+Serif:wght@400;700", "Libre+Baskerville:wght@400;700",
      "Crimson+Text:wght@400;700", "Bitter:wght@400;700", "EB+Garamond:wght@400;700", "Cormorant+Garamond:wght@400;700", "Vollkorn:wght@400;700",
      "Arvo:wght@400;700", "Domine:wght@400;700", "Bree+Serif:wght@400;700", "Slabo+27px", "Sorts+Mill+Goudy", "Frank+Ruhl+Libre:wght@400;700",
      "Tinos:wght@400;700", "Old+Standard+TT:wght@400;700", "Suez+One:wght@400", "Lora:wght@400;700", "Playfair+Display:wght@400;700",
      "Zilla+Slab:wght@400;700", "Cinzel:wght@400;700", "Abril+Fatface:wght@400",

      // Display / Modern
      "Oswald:wght@400;700", "Bebas+Neue:wght@400", "Anton:wght@400", "Righteous:wght@400", "Lobster:wght@400", "Bangers:wght@400",
      "Fredoka:wght@400;700", "Paytone+One:wght@400", "Passion+One:wght@400;700", "Alfa+Slab+One:wght@400", "Russo+One:wght@400",
      "Luckiest+Guy:wght@400", "Creepster:wght@400", "Monoton:wght@400", "Press+Start+2P:wght@400", "Rubik+Mono+One:wght@400",
      "Bungee:wght@400", "Sigmar:wght@400", "Ultra:wght@400", "Unbounded:wght@400;700", "Syne:wght@400;700", "Space+Grotesk:wght@400;700",
      "Syncopate:wght@400;700", "Audiowide:wght@400", "Orbitron:wght@400;700", "Exo+2:wght@400;700", "Rajdhani:wght@400;700",
      "Silkscreen:wght@400;700", "Jersey+15:wght@400",

      // Handwriting
      "Pacifico:wght@400", "Dancing+Script:wght@400;700", "Caveat:wght@400;700", "Shadows+Into+Light:wght@400", "Indie+Flower:wght@400",
      "Amatic+SC:wght@400;700", "Covered+By+Your+Grace:wght@400", "Sacramento:wght@400", "Great+Vibes:wght@400", "Yellowtail:wght@400",
      "Satisfy:wght@400", "Courgette:wght@400", "Kaushan+Script:wght@400", "Cookie:wght@400", "Parisienne:wght@400", "Gloria+Hallelujah:wght@400",
      "Permanent+Marker:wght@400", "Rock+Salt:wght@400", "Patrick+Hand:wght@400", "Kalam:wght@400;700", "Handlee:wght@400",
      "Marck+Script:wght@400", "Tangerine:wght@400;700", "Allura:wght@400", "Mr+Dafoe:wght@400",

      // Monospace
      "Roboto+Mono:wght@400;700", "Source+Code+Pro:wght@400;700", "IBM+Plex+Mono:wght@400;700", "Fira+Code:wght@400;700",
      "Inconsolata:wght@400;700", "Space+Mono:wght@400;700", "JetBrains+Mono:wght@400;700", "Ubuntu+Mono:wght@400;700",
      "Anonymous+Pro:wght@400;700", "VT323:wght@400", "Cutive+Mono:wght@400", "DM+Mono:wght@400;500", "Share+Tech+Mono:wght@400",
      "Overpass+Mono:wght@400;700",

      // Unique & Cool
      "Major+Mono+Display:wght@400", "Megrim:wght@400", "Gruppo:wght@400", "Electrolize:wght@400", "Michroma:wght@400",
      "Oxanium:wght@400;700", "Teko:wght@400;700", "Staatliches:wght@400", "Italiana:wght@400", "Cinzel+Decorative:wght@400;700",
      "Limelight:wght@400", "Rye:wght@400", "Shojumaru:wght@400", "Wallpoet:wght@400", "Xanh+Mono:wght@400", "Julius+Sans+One:wght@400",
      "Unica+One:wght@400", "Six+Caps:wght@400", "Faster+One:wght@400", "Ewert:wght@400", "Geo:wght@400",
      "Kelly+Slab:wght@400", "Share+Tech:wght@400", "Zen+Dots:wght@400", "Codystar:wght@400", "Kumar+One:wght@400",
      "Nova+Mono:wght@400", "Underdog:wght@400", "Wire+One:wght@400", "Yatra+One:wght@400",

      // Gen Z
      "Lobster+Two:wght@400;700", "Barlow+Condensed:wght@400;700", "Gravitas+One", "Asap:wght@400;700", "Lilita+One",
      "Fira+Sans+Condensed:wght@400;700", "Delius", "Berkshire+Swash", "Sofia+Sans+Condensed:wght@400;700",
      "Rubik+Marker+Hatch", "Architects+Daughter", "Chewy", "Proza+Libre:wght@400;700", "Cabin+Sketch:wght@400;700",
      "SUSE:wght@400;700", "Coming+Soon"
    ];
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fonts.join('&family=')}&display=swap`;
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.innerHTML = `
      .bn-inline-content { transition: font-size 0.2s ease, font-family 0.2s ease; }
      span[data-font-size] { font-size: var(--bn-font-size) !important; }
      span[data-font-family] { font-family: var(--bn-font-family) !important; }
      .mantine-Menu-item { padding: 10px 14px; border-radius: 8px; margin: 2px 4px; }
      .mantine-Menu-item:hover { background-color: #f1f5f9; }
      .mantine-Menu-dropdown {
        padding: 4px; border-radius: 12px; border: 1px solid #e2e8f0;
        background-color: white !important; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
        z-index: 1000000 !important;
      }
      .bn-container { padding: 0 !important; margin: 0 !important; }
      .bn-editor { padding-inline: 0 !important; padding-block: 0 !important; margin: 0 !important; }
      .bn-editor > *:first-child { margin-top: 0 !important; }
      .bn-editor > *:last-child { margin-bottom: 0 !important; }
      .bn-editor { padding-top: 0 !important; padding-bottom: 0 !important; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, []);

  const handleDocChange = async () => {
    const currentBlocks = editor.document as any as Block[];
    prevBlocksRef.current = currentBlocks;
    onChange(JSON.stringify(currentBlocks, null, 2));
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSlug(val);
    if (onSlugChange) {
      onSlugChange(val);
    }
  };

  // Selectors for font size and font family omitted here for brevity, but I need to include them
  const FontSizeSelect = useCallback(() => {
    const sizes = [
      { label: "Small", value: "13px" },
      { label: "Normal", value: "16px" },
      { label: "Large", value: "24px" },
      { label: "Huge", value: "42px" },
    ];
    const activeSize = (editor as any).getActiveStyles()?.fontSize || "16px";
    const displaySize = activeSize.replace("px", "");
    const [inputValue, setInputValue] = useState(displaySize);

    useEffect(() => {
      setInputValue(displaySize);
    }, [displaySize]);

    const updateSize = (newSize: string) => {
      const sizeWithUnit = newSize.endsWith("px") ? newSize : `${newSize}px`;
      (editor as any).addStyles({ fontSize: sizeWithUnit });
    };

    return (
      <Group gap={0} className="mx-1 items-center bg-white border border-slate-200/60 shadow-sm rounded-lg overflow-visible transition-all duration-200 hover:shadow-md hover:border-slate-300">
        <Tooltip label="Decrease Size" withArrow>
          <ActionIcon 
            size="sm" 
            variant="subtle" 
            color="gray" 
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const current = parseInt(inputValue) || 16;
              const newSize = Math.max(8, current - 1);
              setInputValue(newSize.toString());
              updateSize(`${newSize}px`);
              // Let the editor regain focus if we want, but since onMouseDown preventDefault is there, it should keep it.
            }} 
            className="rounded-none hover:bg-slate-100 px-1.5 h-[26px] border-r border-slate-200/50 text-slate-600 active:scale-95"
          >
            <Minus size={12} strokeWidth={2.5} />
          </ActionIcon>
        </Tooltip>
        
        <Tooltip label="Type exact size" withArrow>
          <div>
            <TextInput
              variant="unstyled"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.currentTarget.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = e.currentTarget.value;
                  if (/^\d*$/.test(val) && val) {
                    setInputValue(val);
                    updateSize(`${val}px`);
                  }
                }
              }}
              onBlur={(e) => {
                const val = e.currentTarget.value;
                if (/^\d*$/.test(val) && val) {
                  updateSize(`${val}px`);
                } else {
                  setInputValue(displaySize);
                }
              }}
              styles={{
                input: { 
                  width: '32px', 
                  height: '26px', 
                  minHeight: 'unset', 
                  textAlign: 'center', 
                  fontWeight: 600, 
                  fontSize: '13px', 
                  padding: 0,
                  color: '#334155'
                }
              }}
              className="bg-transparent focus-within:bg-slate-50 transition-colors"
            />
          </div>
        </Tooltip>
        
        <Tooltip label="Increase Size" withArrow>
          <ActionIcon 
            size="sm" 
            variant="subtle" 
            color="gray" 
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const current = parseInt(inputValue) || 16;
              const newSize = Math.min(200, current + 1);
              setInputValue(newSize.toString());
              updateSize(`${newSize}px`);
            }} 
            className="rounded-none hover:bg-slate-100 px-1.5 h-[26px] border-l border-slate-200/50 text-slate-600 active:scale-95"
          >
            <Plus size={12} strokeWidth={2.5} />
          </ActionIcon>
        </Tooltip>
        
        <Menu shadow="xl" width={180} position="bottom-start" withArrow transitionProps={{ transition: 'pop-top-left' }}>
          <Menu.Target>
            <ActionIcon 
              size="sm" 
              variant="subtle" 
              color="gray" 
              onMouseDown={(e) => e.preventDefault()}
              className="rounded-l-none hover:bg-slate-100 px-1.5 h-[26px] border-l border-slate-200/50 bg-slate-50/50"
            >
              <ChevronDown size={12} strokeWidth={2.5} className="opacity-60" />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown className="bg-white/95 backdrop-blur-md border-slate-200/60 p-1.5 rounded-xl shadow-xl shadow-slate-200/40">
            {sizes.map((size) => (
              <Menu.Item
                key={size.value}
                onClick={() => updateSize(size.value)}
                className={`rounded-md mb-0.5 transition-colors ${activeSize === size.value ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50'}`}
                rightSection={activeSize === size.value && <Check size={12} className="text-emerald-600" />}
              >
                <Group justify="space-between" gap="xs">
                  <Text size="xs" fw={activeSize === size.value ? 700 : 500}>{size.label}</Text>
                  <Text size="xs" color="dimmed" fw={400}>{size.value}</Text>
                </Group>
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
    );
  }, [editor]);

  const FontFamilySelect = useCallback(() => {
    const families = [
     // Sans-Serif
      { label: "Inter", value: "'Inter', sans-serif", group: "Sans Serif" },
      { label: "Roboto", value: "'Roboto', sans-serif", group: "Sans Serif" },
      { label: "Open Sans", value: "'Open Sans', sans-serif", group: "Sans Serif" },
      { label: "Lato", value: "'Lato', sans-serif", group: "Sans Serif" },
      { label: "Poppins", value: "'Poppins', sans-serif", group: "Sans Serif" },
      { label: "Montserrat", value: "'Montserrat', sans-serif", group: "Sans Serif" },
      { label: "Nunito", value: "'Nunito', sans-serif", group: "Sans Serif" },
      { label: "Raleway", value: "'Raleway', sans-serif", group: "Sans Serif" },
      { label: "Outfit", value: "'Outfit', sans-serif", group: "Sans Serif" },
      { label: "Ubuntu", value: "'Ubuntu', sans-serif", group: "Sans Serif" },
      { label: "Quicksand", value: "'Quicksand', sans-serif", group: "Sans Serif" },
      { label: "Rubik", value: "'Rubik', sans-serif", group: "Sans Serif" },
      { label: "Work Sans", value: "'Work Sans', sans-serif", group: "Sans Serif" },
      { label: "Kanit", value: "'Kanit', sans-serif", group: "Sans Serif" },
      { label: "Barlow", value: "'Barlow', sans-serif", group: "Sans Serif" },
      { label: "Comfortaa", value: "'Comfortaa', sans-serif", group: "Sans Serif" },
      { label: "Mulish", value: "'Mulish', sans-serif", group: "Sans Serif" },
      { label: "DM Sans", value: "'DM Sans', sans-serif", group: "Sans Serif" },
      { label: "PT Sans", value: "'PT Sans', sans-serif", group: "Sans Serif" },
      { label: "IBM Plex Sans", value: "'IBM Plex Sans', sans-serif", group: "Sans Serif" },
      { label: "Josefin Sans", value: "'Josefin Sans', sans-serif", group: "Sans Serif" },
      { label: "Titillium Web", value: "'Titillium Web', sans-serif", group: "Sans Serif" },
      { label: "Manrope", value: "'Manrope', sans-serif", group: "Sans Serif" },
      { label: "Dosis", value: "'Dosis', sans-serif", group: "Sans Serif" },
      { label: "Mukta", value: "'Mukta', sans-serif", group: "Sans Serif" },
      { label: "Chakra Petch", value: "'Chakra Petch', sans-serif", group: "Sans Serif" },
      { label: "Source Sans 3", value: "'Source Sans 3', sans-serif", group: "Sans Serif" },

      // Serif
      { label: "Roboto Slab", value: "'Roboto Slab', serif", group: "Serif" },
      { label: "Merriweather", value: "'Merriweather', serif", group: "Serif" },
      { label: "Lora", value: "'Lora', serif", group: "Serif" },
      { label: "Playfair Display", value: "'Playfair Display', serif", group: "Serif" },
      { label: "PT Serif", value: "'PT Serif', serif", group: "Serif" },
      { label: "Noto Serif", value: "'Noto Serif', serif", group: "Serif" },
      { label: "Libre Baskerville", value: "'Libre Baskerville', serif", group: "Serif" },
      { label: "Crimson Text", value: "'Crimson Text', serif", group: "Serif" },
      { label: "Bitter", value: "'Bitter', serif", group: "Serif" },
      { label: "EB Garamond", value: "'EB Garamond', serif", group: "Serif" },
      { label: "Cormorant Garamond", value: "'Cormorant Garamond', serif", group: "Serif" },
      { label: "Vollkorn", value: "'Vollkorn', serif", group: "Serif" },
      { label: "Arvo", value: "'Arvo', serif", group: "Serif" },
      { label: "Suez One", value: "'Suez One', serif", group: "Serif" },
      { label: "Zilla Slab", value: "'Zilla Slab', serif", group: "Serif" },
      { label: "Domine", value: "'Domine', serif", group: "Serif" },
      { label: "Bree Serif", value: "'Bree Serif', serif", group: "Serif" },
      { label: "Slabo 27px", value: "'Slabo 27px', serif", group: "Serif" },
      { label: "Sorts Mill Goudy", value: "'Sorts Mill Goudy', serif", group: "Serif" },
      { label: "Frank Ruhl Libre", value: "'Frank Ruhl Libre', serif", group: "Serif" },
      { label: "Tinos", value: "'Tinos', serif", group: "Serif" },
      { label: "Old Standard TT", value: "'Old Standard TT', serif", group: "Serif" },
      { label: "Cinzel", value: "'Cinzel', serif", group: "Serif" },
      { label: "Abril Fatface", value: "'Abril Fatface', serif", group: "Serif" },

      // Display / Modern
      { label: "Oswald", value: "'Oswald', sans-serif", group: "Modern" },
      { label: "Bebas Neue", value: "'Bebas Neue', sans-serif", group: "Modern" },
      { label: "Anton", value: "'Anton', sans-serif", group: "Modern" },
      { label: "Righteous", value: "'Righteous', sans-serif", group: "Modern" },
      { label: "Lobster", value: "'Lobster', cursive", group: "Modern" },
      { label: "Syne", value: "'Syne', sans-serif", group: "Modern" },
      { label: "Unbounded", value: "'Unbounded', sans-serif", group: "Modern" },
      { label: "Bangers", value: "'Bangers', system-ui", group: "Modern" },
      { label: "Fredoka", value: "'Fredoka', sans-serif", group: "Modern" },
      { label: "Paytone One", value: "'Paytone One', sans-serif", group: "Modern" },
      { label: "Passion One", value: "'Passion One', sans-serif", group: "Modern" },
      { label: "Alfa Slab One", value: "'Alfa Slab One', cursive", group: "Modern" },
      { label: "Russo One", value: "'Russo One', sans-serif", group: "Modern" },
      { label: "Luckiest Guy", value: "'Luckiest Guy', cursive", group: "Modern" },
      { label: "Creepster", value: "'Creepster', cursive", group: "Modern" },
      { label: "Rubik Mono One", value: "'Rubik Mono One', monospace", group: "Modern" },
      { label: "Bungee", value: "'Bungee', cursive", group: "Modern" },
      { label: "Sigmar", value: "'Sigmar', cursive", group: "Modern" },
      { label: "Ultra", value: "'Ultra', serif", group: "Modern" },
      { label: "Syncopate", value: "'Syncopate', sans-serif", group: "Modern" },
      { label: "Audiowide", value: "'Audiowide', cursive", group: "Modern" },
      { label: "Orbitron", value: "'Orbitron', sans-serif", group: "Modern" },
      { label: "Rajdhani", value: "'Rajdhani', sans-serif", group: "Modern" },

      // Handwriting
      { label: "Dancing Script", value: "'Dancing Script', cursive", group: "Handwritten" },
      { label: "Covered By Your Grace", value: "'Covered By Your Grace', cursive", group: "Handwritten" },
      { label: "Sacramento", value: "'Sacramento', cursive", group: "Handwritten" },
      { label: "Great Vibes", value: "'Great Vibes', cursive", group: "Handwritten" },
      { label: "Yellowtail", value: "'Yellowtail', cursive", group: "Handwritten" },
      { label: "Satisfy", value: "'Satisfy', cursive", group: "Handwritten" },
      { label: "Courgette", value: "'Courgette', cursive", group: "Handwritten" },
      { label: "Cookie", value: "'Cookie', cursive", group: "Handwritten" },
      { label: "Parisienne", value: "'Parisienne', cursive", group: "Handwritten" },
      { label: "Gloria Hallelujah", value: "'Gloria Hallelujah', cursive", group: "Handwritten" },
      { label: "Kalam", value: "'Kalam', cursive", group: "Handwritten" },
      { label: "Handlee", value: "'Handlee', cursive", group: "Handwritten" },
      { label: "Marck Script", value: "'Marck Script', cursive", group: "Handwritten" },
      { label: "Tangerine", value: "'Tangerine', cursive", group: "Handwritten" },
      { label: "Allura", value: "'Allura', cursive", group: "Handwritten" },
      { label: "Mr Dafoe", value: "'Mr Dafoe', cursive", group: "Handwritten" },

      // Retro/Gaming
      { label: "Silkscreen", value: "'Silkscreen', sans-serif", group: "Retro" },
      { label: "Jersey 15", value: "'Jersey 15', sans-serif", group: "Retro" },

      // Monospace
      { label: "Fira Code", value: "'Fira Code', monospace", group: "Monospace" },
      { label: "Roboto Mono", value: "'Roboto Mono', monospace", group: "Monospace" },
      { label: "Source Code Pro", value: "'Source Code Pro', monospace", group: "Monospace" },
      { label: "IBM Plex Mono", value: "'IBM Plex Mono', monospace", group: "Monospace" },
      { label: "Inconsolata", value: "'Inconsolata', monospace", group: "Monospace" },
      { label: "Space Mono", value: "'Space Mono', monospace", group: "Monospace" },
      { label: "JetBrains Mono", value: "'JetBrains Mono', monospace", group: "Monospace" },
      { label: "Ubuntu Mono", value: "'Ubuntu Mono', monospace", group: "Monospace" },
      { label: "Anonymous Pro", value: "'Anonymous Pro', monospace", group: "Monospace" },
      { label: "Cutive Mono", value: "'Cutive Mono', monospace", group: "Monospace" },
      { label: "DM Mono", value: "'DM Mono', monospace", group: "Monospace" },
      { label: "Share Tech Mono", value: "'Share Tech Mono', monospace", group: "Monospace" },
      { label: "Overpass Mono", value: "'Overpass Mono', monospace", group: "Monospace" },

      // Unique & Cool
      { label: "Major Mono", value: "'Major Mono Display', monospace", group: "Unique" },
      { label: "Megrim", value: "'Megrim', system-ui", group: "Unique" },
      { label: "Gruppo", value: "'Gruppo', sans-serif", group: "Unique" },
      { label: "Electrolize", value: "'Electrolize', sans-serif", group: "Unique" },
      { label: "Michroma", value: "'Michroma', sans-serif", group: "Unique" },
      { label: "Oxanium", value: "'Oxanium', system-ui", group: "Unique" },
      { label: "Teko", value: "'Teko', sans-serif", group: "Unique" },
      { label: "Staatliches", value: "'Staatliches', system-ui", group: "Unique" },
      { label: "Cinzel Decorative", value: "'Cinzel Decorative', cursive", group: "Unique" },
      { label: "Limelight", value: "'Limelight', cursive", group: "Unique" },
      { label: "Shojumaru", value: "'Shojumaru', system-ui", group: "Unique" },
      { label: "Wallpoet", value: "'Wallpoet', system-ui", group: "Unique" },
      { label: "Xanh Mono", value: "'Xanh Mono', monospace", group: "Unique" },
      { label: "Julius Sans One", value: "'Julius Sans One', sans-serif", group: "Unique" },
      { label: "Unica One", value: "'Unica One', system-ui", group: "Unique" },
      { label: "Six Caps", value: "'Six Caps', sans-serif", group: "Unique" },
      { label: "Faster One", value: "'Faster One', system-ui", group: "Unique" },
      { label: "Ewert", value: "'Ewert', cursive", group: "Unique" },
      { label: "Geo", value: "'Geo', sans-serif", group: "Unique" },
      { label: "Kelly Slab", value: "'Kelly Slab', cursive", group: "Unique" },
      { label: "Share Tech", value: "'Share Tech', sans-serif", group: "Unique" },
      { label: "Zen Dots", value: "'Zen Dots', system-ui", group: "Unique" },
      { label: "Codystar", value: "'Codystar', system-ui", group: "Unique" },
      { label: "Kumar One", value: "'Kumar One', system-ui", group: "Unique" },
      { label: "Nova Mono", value: "'Nova Mono', monospace", group: "Unique" },
      { label: "Underdog", value: "'Underdog', system-ui", group: "Unique" },
      { label: "Wire One", value: "'Wire One', sans-serif", group: "Unique" },
      { label: "Yatra One", value: "'Yatra One', system-ui", group: "Unique" },

      // Gen Z
      { label: "Lobster Two", value: "'Lobster Two', cursive", group: "Gen Z" },
      { label: "Barlow Condensed", value: "'Barlow Condensed', sans-serif", group: "Gen Z" },
      { label: "Gravitas One", value: "'Gravitas One', cursive", group: "Gen Z" },
      { label: "Space Grotesk", value: "'Space Grotesk', sans-serif", group: "Gen Z" },
      { label: "Pacifico", value: "'Pacifico', cursive", group: "Gen Z" },
      { label: "Exo 2", value: "'Exo 2', sans-serif", group: "Gen Z" },
      { label: "Caveat", value: "'Caveat', cursive", group: "Gen Z" },
      { label: "Shadows Into Light", value: "'Shadows Into Light', cursive", group: "Gen Z" },
      { label: "Asap", value: "'Asap', sans-serif", group: "Gen Z" },
      { label: "Lilita One", value: "'Lilita One', cursive", group: "Gen Z" },
      { label: "Indie Flower", value: "'Indie Flower', cursive", group: "Gen Z" },
      { label: "Fira Sans Condensed", value: "'Fira Sans Condensed', sans-serif", group: "Gen Z" },
      { label: "Permanent Marker", value: "'Permanent Marker', cursive", group: "Gen Z" },
      { label: "Amatic SC", value: "'Amatic SC', cursive", group: "Gen Z" },
      { label: "Delius", value: "'Delius', cursive", group: "Gen Z" },
      { label: "Press Start 2P", value: "'Press Start 2P', system-ui", group: "Gen Z" },
      { label: "Kaushan Script", value: "'Kaushan Script', cursive", group: "Gen Z" },
      { label: "Patrick Hand", value: "'Patrick Hand', cursive", group: "Gen Z" },
      { label: "Rock Salt", value: "'Rock Salt', cursive", group: "Gen Z" },
      { label: "Berkshire Swash", value: "'Berkshire Swash', cursive", group: "Gen Z" },
      { label: "Sofia Sans Condensed", value: "'Sofia Sans Condensed', sans-serif", group: "Gen Z" },
      { label: "Monoton", value: "'Monoton', cursive", group: "Gen Z" },
      { label: "Rubik Marker Hatch", value: "'Rubik Marker Hatch', cursive", group: "Gen Z" },
      { label: "VT323", value: "'VT323', monospace", group: "Gen Z" },
      { label: "Architects Daughter", value: "'Architects Daughter', cursive", group: "Gen Z" },
      { label: "Rye", value: "'Rye', serif", group: "Gen Z" },
      { label: "Chewy", value: "'Chewy', cursive", group: "Gen Z" },
      { label: "Italiana", value: "'Italiana', serif", group: "Gen Z" },
      { label: "Proza Libre", value: "'Proza Libre', sans-serif", group: "Gen Z" },
      { label: "Cabin Sketch", value: "'Cabin Sketch', cursive", group: "Gen Z" },
      { label: "SUSE", value: "'SUSE', sans-serif", group: "Gen Z" },
      { label: "Coming Soon", value: "'Coming Soon', cursive", group: "Gen Z" },
    ];
    const activeFamily = (editor as any).getActiveStyles()?.fontFamily || "'Inter', sans-serif";
    const updateFamily = (family: string) => {
      (editor as any).addStyles({ fontFamily: family });
    };

    // Group families
    const groups = Array.from(new Set(families.map(f => f.group)));

    return (
      <Menu shadow="xl" width={240} position="bottom-start" withArrow transitionProps={{ transition: 'pop-top-left' }}>
        <Menu.Target>
          <Tooltip label="Font Family" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              className="hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 ease-in-out active:scale-95 flex items-center gap-1 w-auto px-2 mx-0.5 border border-slate-200/60 shadow-sm bg-white hover:shadow-md hover:-translate-y-0.5 rounded-lg"
            >
              <Baseline size={18} className={activeFamily !== "'Inter', sans-serif" ? "text-emerald-600" : "text-slate-600"} />
              <ChevronDown size={10} className="opacity-40" />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown className="bg-white/95 backdrop-blur-md border-slate-200/60 max-h-[400px] overflow-y-auto p-1.5 rounded-xl shadow-xl shadow-slate-200/40">
          {groups.map((group) => (
            <div key={group}>
              <Text size="xs" fw={700} color="dimmed" px="sm" py={6} className="uppercase tracking-widest text-[10px] bg-slate-50/50 rounded mt-1 first:mt-0 sticky top-0 z-10">{group}</Text>
              {families.filter(f => f.group === group).map((family) => (
                <Menu.Item
                  key={family.value}
                  onClick={() => updateFamily(family.value)}
                  className={`rounded-md mb-0.5 transition-colors ${activeFamily === family.value ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50'}`}
                  rightSection={activeFamily === family.value && <Check size={12} className="text-emerald-600" />}
                >
                  <Text size="sm" style={{ fontFamily: family.value }}>{family.label}</Text>
                </Menu.Item>
              ))}
              <Divider size="xs" color="slate.1" my={4} className="last:hidden" />
            </div>
          ))}
        </Menu.Dropdown>
      </Menu>
    );
  }, [editor]);

  const aiConfigStr = JSON.stringify(aiConfig);
  const CustomFormattingToolbar = useCallback(() => {
    const config = aiConfigStr ? JSON.parse(aiConfigStr) : undefined;
    const selectedBlocks = useSelectedBlocks(editor);
    const isMedia =
      selectedBlocks.length === 1 &&
      (selectedBlocks[0].type === "image" ||
        selectedBlocks[0].type === "video" ||
        selectedBlocks[0].type === "audio" ||
        selectedBlocks[0].type === "file");

    return (
      <FormattingToolbar>
        {isMedia ? (
          <>
            <FileCaptionButton key={"fileCaptionButton"} />
            <FileReplaceButton key={"fileReplaceButton"} />
            <FileRenameButton key={"fileRenameButton"} />
            <FileDownloadButton key={"fileDownloadButton"} />
            <FileDeleteButton key={"fileDeleteButton"} />
            <FilePreviewButton key={"filePreviewButton"} />
            <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
            <TextAlignButton textAlignment={"left"} key={"textAlignLeftButton"} />
            <TextAlignButton textAlignment={"center"} key={"textAlignCenterButton"} />
            <TextAlignButton textAlignment={"right"} key={"textAlignRightButton"} />
          </>
        ) : (
          <>
            {config?.apiKey && <AIToolbarButton />}
            <BlockTypeSelect
              key={"blockTypeSelect"}
              items={[
                ...blockTypeSelectItems(editor.dictionary),
                {
                  name: "Alert",
                  type: "alert",
                  icon: AlertTriangle,
                } satisfies BlockTypeSelectItem,
              ]}
            />
            <BasicTextStyleButton basicTextStyle={"bold"} key={"boldStyleButton"} />
            <BasicTextStyleButton basicTextStyle={"italic"} key={"italicStyleButton"} />
            <BasicTextStyleButton basicTextStyle={"underline"} key={"underlineStyleButton"} />
            <BasicTextStyleButton basicTextStyle={"strike"} key={"strikeStyleButton"} />
            <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
            <FontSizeSelect />
            <FontFamilySelect />
            <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
            <ColorStyleButton key={"colorStyleButton"} />
            <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
            <TextAlignButton textAlignment={"left"} key={"textAlignLeftButton"} />
            <TextAlignButton textAlignment={"center"} key={"textAlignCenterButton"} />
            <TextAlignButton textAlignment={"right"} key={"textAlignRightButton"} />
            <NestBlockButton key={"nestBlockButton"} />
            <CreateLinkButton key={"createLinkButton"} />
          </>
        )}
      </FormattingToolbar>
    );
  }, [editor, aiConfigStr, FontSizeSelect, FontFamilySelect]);

  return (
    <div className={`bn-wrapper w-full max-w-4xl mx-auto transition-all duration-300 ease-in-out ${editable ? "min-h-[400px] pb-32" : "min-h-0 pb-0"}`}>
      {showSlug && editable && (
        <div className="mt-8 mb-6 ml-[54px] mr-6">
          <input
            type="text"
            className="w-full text-5xl font-extrabold tracking-tight bg-transparent outline-none border-none placeholder-slate-200 text-slate-900 focus:ring-0"
            placeholder="Document title..."
            value={slug}
            onChange={handleSlugChange}
          />
        </div>
      )}
      <BlockNoteView
        editor={editor}
        editable={editable}
        onChange={handleDocChange}
        theme="light"
        formattingToolbar={false}
        slashMenu={false}
      >
        {aiConfig?.apiKey && <AIMenuController />}
        {editable && (
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(
                [
                  ...getDefaultReactSlashMenuItems(editor),
                  ...(aiConfig?.apiKey ? getAISlashMenuItems(editor) : []),
                ],
                query
              )
            }
          />
        )}
        {editable && (
          <FormattingToolbarController formattingToolbar={CustomFormattingToolbar} />
        )}
      </BlockNoteView>
    </div>
  );
}
