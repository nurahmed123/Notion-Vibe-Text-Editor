"use client";

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@mantine/core/styles.css";
import "@blocknote/mantine/style.css";
import "@blocknote/xl-ai/style.css";
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
    createReactStyleSpec,
} from "@blocknote/react";
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
} from "@blocknote/xl-ai";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import React, { useRef, useEffect, useMemo, useState } from "react";
import { Baseline, Check, ChevronDown, Minus, Plus, AlertTriangle } from "lucide-react";
import { Menu, ActionIcon, Tooltip, Text, Group, Divider, TextInput, MantineProvider } from "@mantine/core";
import { Alert } from "./Alert";
import { ArrowConversionExtension } from "./ArrowConversionExtension";

export interface EditorProps {
    onChange: (value: string) => void;
    initialContent?: string;
    editable?: boolean;
    withMantineProvider?: boolean;

    // Advanced Upload Options
    cloudinary?: {
        cloudName: string;
        uploadPreset: string;
        folder?: string;
    };
    customUploadFile?: (file: File) => Promise<string>;

    // Advanced AI Options
    ai?: {
        streamUrl?: string; // Standard AI streaming URL
        customFetch?: typeof fetch;
    };
}

function EditorInner({
    onChange,
    initialContent,
    editable = true,
    cloudinary,
    customUploadFile,
    ai,
}: Omit<EditorProps, 'withMantineProvider'>) {
    const prevBlocksRef = useRef<Block[]>([]);

    // Function to extract all media URLs from blocks
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

    // Function to handle file uploads
    const defaultUploadFile = async (file: File) => {
        if (cloudinary?.cloudName && cloudinary?.uploadPreset) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", cloudinary.uploadPreset);
            if (cloudinary.folder) {
                formData.append("folder", cloudinary.folder);
            }

            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/auto/upload`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Failed to upload file to Cloudinary");
            }

            const data = await response.json();
            return data.secure_url;
        }

        throw new Error("No upload configuration provided. Please pass `cloudinary` credentials or a `customUploadFile` function.");
    };

    const uploadFile = customUploadFile || defaultUploadFile;

    // Define custom schema with font size and font family
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
                        render: (props: any) => (
                            <span
                                data-font-size={props.value}
                                style={{ fontSize: `${props.value} !important` }}
                                ref={props.contentRef as any}
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
                        render: (props: any) => (
                            <span
                                data-font-family={props.value}
                                style={{ fontFamily: `${props.value} !important` }}
                                ref={props.contentRef as any}
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
            const parsed = JSON.parse(initialContent) as Block[];
            return parsed;
        } catch {
            return undefined;
        }
    }, [initialContent]);

    const editor = useCreateBlockNote({
        dictionary: {
            ...bnEn,
            ai: aiEn,
        },
        extensions: [
            AIExtension({
                transport: {
                    api: ai?.streamUrl || "/api/ai/regular/streamText",
                    fetch: ai?.customFetch,
                } as any,
            }),
        ],
        _tiptapOptions: {
            extensions: [ArrowConversionExtension as any],
        },
        initialContent: safeInitialBlocks,
        uploadFile,
        schema,
    });

    useEffect(() => {
        if (editor.document) {
            prevBlocksRef.current = editor.document as any as Block[];
        }
    }, [editor.document]);

    useEffect(() => {
        const fonts = [
            "Roboto:wght@400;700", "Inter:wght@400;700", "Playfair+Display:wght@400;700", "Fira+Code:wght@400;700"
            // Truncated list in the generic component for brevity/performance
            // You can expand this as needed.
        ];

        let link: HTMLLinkElement | null = null;
        let style: HTMLStyleElement | null = null;

        if (typeof document !== 'undefined') {
            link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${fonts.join('&family=')}&display=swap`;
            document.head.appendChild(link);

            style = document.createElement('style');
            style.innerHTML = `
        .bn-inline-content { transition: font-size 0.2s ease, font-family 0.2s ease; }
        span[data-font-size] { font-size: var(--bn-font-size) !important; }
        span[data-font-family] { font-family: var(--bn-font-family) !important; }
        .mantine-Menu-item { padding: 10px 14px; border-radius: 8px; margin: 2px 4px; }
        .mantine-Menu-item:hover { background-color: #f1f5f9; }
        .mantine-Menu-dropdown { padding: 4px; border-radius: 12px; border: 1px solid #e2e8f0; background-color: white !important; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important; z-index: 1000000 !important; }
        .bn-container { padding: 0 !important; margin: 0 !important; }
        .bn-editor { padding-inline: 0 !important; padding-block: 0 !important; margin: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
        .bn-editor > *:first-child { margin-top: 0 !important; }
        .bn-editor > *:last-child { margin-bottom: 0 !important; }
      `;
            document.head.appendChild(style);
        }

        return () => {
            if (document && link && style) {
                document.head.removeChild(link);
                document.head.removeChild(style);
            }
        };
    }, []);

    const handleDocChange = async () => {
        const currentBlocks = editor.document as any as Block[];
        const currentUrls = extractMediaUrls(currentBlocks);
        const prevUrls = extractMediaUrls(prevBlocksRef.current);

        const deletedUrls = prevUrls.filter(url => !currentUrls.includes(url));

        for (const url of deletedUrls) {
            if (url.includes("cloudinary.com")) {
                console.warn("Media removed from editor:", url, "- Note: Deleting from Cloudinary securely requires a backend route with your API Secret.");
            }
        }

        prevBlocksRef.current = currentBlocks;
        onChange(JSON.stringify(currentBlocks, null, 2));
    };

    const FontSizeSelect = () => {
        const [customValue, setCustomValue] = useState("");
        const sizes = [
            { label: "Small", value: "13px" },
            { label: "Normal", value: "16px" },
            { label: "Medium", value: "20px" },
            { label: "Large", value: "24px" },
        ];

        const activeSize = (editor as any).getActiveStyles()?.fontSize || "16px";
        const displaySize = activeSize.replace("px", "");

        const updateSize = (newSize: string) => {
            const sizeWithUnit = newSize.endsWith("px") ? newSize : `${newSize}px`;
            (editor as any).addStyles({ fontSize: sizeWithUnit });
        };

        const handleIncrement = () => {
            const current = parseInt(displaySize) || 16;
            updateSize(`${current + 1}px`);
        };

        const handleDecrement = () => {
            const current = parseInt(displaySize) || 16;
            if (current > 1) updateSize(`${current - 1}px`);
        };

        return (
            <Group gap={0} className="mx-1">
                <Tooltip label="Decrease font size">
                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleDecrement} className="hover:bg-slate-100"><Minus size={14} /></ActionIcon>
                </Tooltip>
                <Menu shadow="xl" width={180} position="bottom" withArrow>
                    <Menu.Target>
                        <Tooltip label="Font Size" withArrow>
                            <div className="flex items-center px-2 py-1 mx-1 rounded hover:bg-slate-100 cursor-pointer border border-slate-200 bg-white">
                                <TextInput
                                    variant="unstyled" size="xs" value={displaySize}
                                    onChange={(e) => {
                                        const val = e.currentTarget.value;
                                        if (/^\d*$/.test(val)) if (val) updateSize(`${val}px`);
                                    }}
                                    styles={{ input: { width: '24px', height: '20px', minHeight: 'unset', textAlign: 'center', fontWeight: 700, fontSize: '12px', padding: 0 } }}
                                />
                                <ChevronDown size={10} className="opacity-40 ml-1" />
                            </div>
                        </Tooltip>
                    </Menu.Target>
                    <Menu.Dropdown>
                        {sizes.map((size) => (
                            <Menu.Item key={size.value} onClick={() => updateSize(size.value)} rightSection={activeSize === size.value && <Check size={12} className="text-emerald-600" />}>
                                <Group justify="space-between" gap="xs">
                                    <Text size="xs" fw={activeSize === size.value ? 700 : 500}>{size.label}</Text>
                                    <Text size="xs" color="dimmed" fw={400}>{size.value}</Text>
                                </Group>
                            </Menu.Item>
                        ))}
                    </Menu.Dropdown>
                </Menu>
                <Tooltip label="Increase font size">
                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleIncrement} className="hover:bg-slate-100"><Plus size={14} /></ActionIcon>
                </Tooltip>
            </Group>
        );
    };

    const FontFamilySelect = () => {
        const families = [
            { label: "Inter", value: "'Inter', sans-serif" },
            { label: "Roboto", value: "'Roboto', sans-serif" },
            { label: "Playfair Display", value: "'Playfair Display', serif" },
            { label: "Fira Code", value: "'Fira Code', monospace" }
        ];

        const activeFamily = (editor as any).getActiveStyles()?.fontFamily || "'Inter', sans-serif";
        const updateFamily = (family: string) => (editor as any).addStyles({ fontFamily: family });

        return (
            <Menu shadow="xl" width={240} position="bottom-start" withArrow>
                <Menu.Target>
                    <Tooltip label="Font Family" withArrow>
                        <ActionIcon variant="subtle" color="gray" size="lg" className="hover:bg-slate-100 flex items-center gap-1 w-auto px-1.5 mx-0.5 border border-transparent hover:border-slate-200">
                            <Baseline size={18} className={activeFamily !== "'Inter', sans-serif" ? "text-emerald-600" : "text-slate-600"} />
                            <ChevronDown size={10} className="opacity-40" />
                        </ActionIcon>
                    </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                    {families.map((family) => (
                        <Menu.Item key={family.value} onClick={() => updateFamily(family.value)} rightSection={activeFamily === family.value && <Check size={12} className="text-emerald-600" />}>
                            <Text size="sm" style={{ fontFamily: family.value }}>{family.label}</Text>
                        </Menu.Item>
                    ))}
                </Menu.Dropdown>
            </Menu>
        );
    };

    const CustomFormattingToolbar = () => {
        const selectedBlocks = useSelectedBlocks(editor as any);
        const isMedia = selectedBlocks.length === 1 && (["image", "video", "audio", "file"].includes(selectedBlocks[0]?.type));

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
                        <AIToolbarButton />
                        <BlockTypeSelect
                            key={"blockTypeSelect"}
                            items={[
                                ...blockTypeSelectItems(editor.dictionary),
                                { name: "Alert", type: "alert", icon: AlertTriangle } as any,
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
    };

    return (
        <div className={editable ? "min-h-[400px] pb-20" : "min-h-0 pb-0"}>
            <BlockNoteView
                editor={editor}
                editable={editable}
                onChange={handleDocChange}
                theme="light"
                formattingToolbar={false}
                slashMenu={false}
            >
                <FormattingToolbarController formattingToolbar={() => <CustomFormattingToolbar />} />
            </BlockNoteView>
        </div>
    );
}

export function Editor(props: EditorProps) {
    if (props.withMantineProvider) {
        return (
            <MantineProvider>
                <EditorInner {...props} />
            </MantineProvider>
        );
    }
    return <EditorInner {...props} />;
}
