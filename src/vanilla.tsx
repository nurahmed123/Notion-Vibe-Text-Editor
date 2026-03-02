import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Editor, EditorProps } from './components/Editor';

// Keep track of roots to allow unmounting
const roots = new Map<string | HTMLElement, Root>();

export function createNotionEditor(
    elementOrId: string | HTMLElement,
    props: EditorProps
) {
    let element: HTMLElement | null = null;

    if (typeof elementOrId === 'string') {
        element = document.getElementById(elementOrId);
    } else {
        element = elementOrId;
    }

    if (!element) {
        console.error(`NotionVibeTextEditor: Could not find element.`, elementOrId);
        return null;
    }

    // If there's an existing root for this element, use it or unmount it if needed.
    // We'll create a new root for simplicity.
    if (roots.has(elementOrId)) {
        roots.get(elementOrId)?.unmount();
    }

    const root = createRoot(element);
    roots.set(elementOrId, root);

    // When used in vanilla environments, we assume MantineProvider isn't present globally, so we add it.
    root.render(
        <Editor {...props} withMantineProvider={true} />
    );

    return {
        destroy: () => {
            root.unmount();
            roots.delete(elementOrId);
        },
        update: (newProps: Partial<EditorProps>) => {
            root.render(
                <Editor {...{ ...props, ...newProps }} withMantineProvider={true} />
            );
        }
    };
}
