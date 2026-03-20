import * as react_jsx_runtime from 'react/jsx-runtime';

interface EditorProps {
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
declare function Editor({ onChange, initialContent, editable, showSlug, onSlugChange, cloudinaryConfig, aiConfig, }: EditorProps): react_jsx_runtime.JSX.Element;

export { Editor, type EditorProps };
