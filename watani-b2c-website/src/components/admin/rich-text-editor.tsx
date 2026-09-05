"use client";

import {useCallback, useEffect, useId, useRef, useState} from "react";
import {Bold, Code2, Italic, List, ListOrdered, Quote, Redo2, RemoveFormatting, Undo2,} from "lucide-react";

/**
 * WYSIWYG editor for admin product copy. Tag set matches `sanitizeRichText`'s allowlist exactly.
 * Built on contentEditable + execCommand (not a library); output is normalised on every change.
 */

/** Mirrors ALLOWED_TAGS in lib/rich-text.ts - keep the two in step. */
const ALLOWED_TAGS = new Set([
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "UL",
    "OL",
    "LI",
    "H2",
    "H3",
    "H4",
    "BLOCKQUOTE",
]);

/** Tags execCommand emits that map cleanly onto an allowed equivalent. */
const TAG_REPLACEMENTS: Record<string, string> = {
    DIV: "P",
    H1: "H2",
    H5: "H4",
    H6: "H4",
};

/** Blocks that may not sit inside a <p> - such a <div> wrapper is unwrapped instead of rewritten. */
const BLOCK_LEVEL = new Set(["UL", "OL", "H2", "H3", "H4", "BLOCKQUOTE", "P"]);

/** Blocks the format dropdown can switch between. */
const BLOCK_FORMATS = [
    {value: "p", label: "Paragraph"},
    {value: "h2", label: "Heading"},
    {value: "h3", label: "Subheading"},
    {value: "h4", label: "Small heading"},
] as const;

/** Rewrites the editor's DOM into the sanitiser's tag set, on a detached clone so the caret is never disturbed. */
function normalizeHtml(source: string, dropEmptyBlocks = true): string {
    if (typeof document === "undefined") return source;

    const holder = document.createElement("div");
    holder.innerHTML = source;

    // Unsupported elements are unwrapped (children promoted) rather than dropped,
    // so pasting from Word loses the styling but never the words.
    const walk = (node: Element) => {
        for (const child of Array.from(node.children)) walk(child);

        const replacement = TAG_REPLACEMENTS[node.tagName];
        if (replacement) {
            // Promoting the children keeps the list/heading at the top level rather
            // than burying it in a paragraph it is not allowed to occupy.
            if (
                replacement === "P" &&
                Array.from(node.children).some((child) => BLOCK_LEVEL.has(child.tagName))
            ) {
                node.replaceWith(...Array.from(node.childNodes));
                return;
            }
            const swapped = document.createElement(replacement);
            swapped.innerHTML = node.innerHTML;
            node.replaceWith(swapped);
            return;
        }

        if (!ALLOWED_TAGS.has(node.tagName)) {
            node.replaceWith(...Array.from(node.childNodes));
            return;
        }

        // The sanitiser drops every attribute, so drop them here too - otherwise
        // the admin would see styling that vanishes on the storefront.
        for (const attribute of Array.from(node.attributes)) {
            node.removeAttribute(attribute.name);
        }
    };

    for (const child of Array.from(holder.children)) walk(child);

    // Bare text at the top level (typical after a paste) needs a block wrapper,
    // or the storefront's `.rich-text p` typography never applies to it.
    for (const child of Array.from(holder.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
            const paragraph = document.createElement("p");
            child.replaceWith(paragraph);
            paragraph.appendChild(child);
        }
    }

    const html = holder.innerHTML;

    // An empty block may be mid-edit (Enter was just pressed), so only strip on blur,
    // not every keystroke, or the caret's block would vanish under it.
    return (
        dropEmptyBlocks
            ? html.replace(/<(p|h2|h3|h4|li|blockquote)>(\s|<br>|&nbsp;)*<\/\1>/gi, "")
            : html
    ).trim();
}

/** True when the markup carries visible text, mirroring hasRichTextContent. */
function isBlank(html: string): boolean {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;
}

type RichTextEditorProps = {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
};

export function RichTextEditor({value, onChange, placeholder}: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [showSource, setShowSource] = useState(false);
    const [blockFormat, setBlockFormat] = useState<string>("p");
    const [activeMarks, setActiveMarks] = useState<Record<string, boolean>>({});
    const editorId = useId();

    // Last value this editor itself emitted - skip writing `value` back when it matches,
    // since reassigning innerHTML mid-edit destroys the caret.
    const emittedRef = useRef<string | null>(null);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || showSource) return;
        if (value === emittedRef.current) return;
        if (editor.innerHTML !== value) editor.innerHTML = value;
    }, [value, showSource]);

    const syncFromEditor = useCallback(
        (dropEmptyBlocks = false) => {
            const editor = editorRef.current;
            if (!editor) return;
            const normalized = normalizeHtml(editor.innerHTML, dropEmptyBlocks);
            const next = isBlank(normalized) ? "" : normalized;
            emittedRef.current = next;
            onChange(next);
        },
        [onChange],
    );

    /** On blur the content is settled, so empty blocks can be tidied away. */
    const handleBlur = useCallback(() => syncFromEditor(true), [syncFromEditor]);

    /** Reflects the caret's context back into the toolbar's pressed states. */
    const refreshToolbarState = useCallback(() => {
        if (typeof document === "undefined" || showSource) return;
        const editor = editorRef.current;
        if (!editor) return;

        const selection = document.getSelection();
        const anchor = selection?.anchorNode;
        if (!anchor || !editor.contains(anchor)) return;

        let node: HTMLElement | null =
            anchor.nodeType === Node.ELEMENT_NODE
                ? (anchor as HTMLElement)
                : anchor.parentElement;

        let block = "p";
        while (node && node !== editor) {
            const tag = node.tagName;
            if (tag === "H2" || tag === "H3" || tag === "H4" || tag === "P" || tag === "BLOCKQUOTE") {
                block = tag.toLowerCase();
                break;
            }
            node = node.parentElement;
        }
        setBlockFormat(block);

        // Headings are already bold-weight, so queryCommandState would falsely light up
        // the Bold button there - check ancestry instead.
        const inHeading = block === "h2" || block === "h3" || block === "h4";
        const hasBoldAncestor = (() => {
            let n: HTMLElement | null =
                anchor.nodeType === Node.ELEMENT_NODE
                    ? (anchor as HTMLElement)
                    : anchor.parentElement;
            while (n && n !== editor) {
                if (n.tagName === "STRONG" || n.tagName === "B") return true;
                n = n.parentElement;
            }
            return false;
        })();

        setActiveMarks({
            bold: inHeading ? hasBoldAncestor : document.queryCommandState("bold"),
            italic: document.queryCommandState("italic"),
            insertUnorderedList: document.queryCommandState("insertUnorderedList"),
            insertOrderedList: document.queryCommandState("insertOrderedList"),
            blockquote: block === "blockquote",
        });
    }, [showSource]);

    useEffect(() => {
        document.addEventListener("selectionchange", refreshToolbarState);
        return () => document.removeEventListener("selectionchange", refreshToolbarState);
    }, [refreshToolbarState]);

    /** Runs a command with the caret restored, then writes the result upward. */
    function exec(command: string, argument?: string) {
        editorRef.current?.focus();
        document.execCommand(command, false, argument);
        syncFromEditor();
        refreshToolbarState();
    }

    function applyBlock(tag: string) {
        // formatBlock wants the angle-bracket form in every engine that ships it.
        exec("formatBlock", `<${tag}>`);
    }

    function toggleQuote() {
        applyBlock(blockFormat === "blockquote" ? "p" : "blockquote");
    }

    /** Paste as plain text - rich paste content would be stripped by normalizeHtml anyway. */
    function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
        event.preventDefault();
        const text = event.clipboardData.getData("text/plain");
        if (!text) return;
        document.execCommand("insertText", false, text);
        syncFromEditor();
    }

    if (showSource) {
        return (
            <div className="rounded-xl border border-black/10">
                <Toolbar>
                    <div className="flex-1"/>
                    <ToolbarButton
                        label="Back to editor"
                        active
                        // Clearing the marker forces the effect to adopt the hand-edited
                        // HTML, which the WYSIWYG DOM knows nothing about.
                        onClick={() => {
                            emittedRef.current = null;
                            setShowSource(false);
                        }}
                    >
                        <Code2 className="size-4"/>
                    </ToolbarButton>
                </Toolbar>
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={14}
                    spellCheck={false}
                    className="w-full rounded-b-xl px-3 py-2 font-mono text-[13px] outline-none"
                />
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-black/10 focus-within:border-teal-800">
            <Toolbar>
                <select
                    value={blockFormat === "blockquote" ? "p" : blockFormat}
                    onChange={(e) => applyBlock(e.target.value)}
                    aria-label="Text style"
                    className="h-8 rounded-lg border border-black/10 bg-white px-2 text-[12px] font-semibold text-teal-950"
                >
                    {BLOCK_FORMATS.map((format) => (
                        <option key={format.value} value={format.value}>
                            {format.label}
                        </option>
                    ))}
                </select>

                <ToolbarDivider/>

                <ToolbarButton label="Bold" active={activeMarks.bold} onClick={() => exec("bold")}>
                    <Bold className="size-4"/>
                </ToolbarButton>
                <ToolbarButton label="Italic" active={activeMarks.italic} onClick={() => exec("italic")}>
                    <Italic className="size-4"/>
                </ToolbarButton>

                <ToolbarDivider/>

                <ToolbarButton
                    label="Bulleted list"
                    active={activeMarks.insertUnorderedList}
                    onClick={() => exec("insertUnorderedList")}
                >
                    <List className="size-4"/>
                </ToolbarButton>
                <ToolbarButton
                    label="Numbered list"
                    active={activeMarks.insertOrderedList}
                    onClick={() => exec("insertOrderedList")}
                >
                    <ListOrdered className="size-4"/>
                </ToolbarButton>
                <ToolbarButton label="Quote" active={activeMarks.blockquote} onClick={toggleQuote}>
                    <Quote className="size-4"/>
                </ToolbarButton>

                <ToolbarDivider/>

                <ToolbarButton label="Clear formatting" onClick={() => exec("removeFormat")}>
                    <RemoveFormatting className="size-4"/>
                </ToolbarButton>
                <ToolbarButton label="Undo" onClick={() => exec("undo")}>
                    <Undo2 className="size-4"/>
                </ToolbarButton>
                <ToolbarButton label="Redo" onClick={() => exec("redo")}>
                    <Redo2 className="size-4"/>
                </ToolbarButton>

                <div className="flex-1"/>

                <ToolbarButton label="Edit HTML source" onClick={() => setShowSource(true)}>
                    <Code2 className="size-4"/>
                </ToolbarButton>
            </Toolbar>

            <div className="relative">
                {isBlank(value) && placeholder && (
                    <p
                        aria-hidden
                        className="pointer-events-none absolute left-3 top-3 text-[15px] text-muted"
                    >
                        {placeholder}
                    </p>
                )}
                <div
                    id={editorId}
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Long description"
                    // Called with no argument, so the event object never lands in the
                    // dropEmptyBlocks slot.
                    onInput={() => syncFromEditor()}
                    onBlur={handleBlur}
                    onPaste={handlePaste}
                    onKeyUp={refreshToolbarState}
                    onMouseUp={refreshToolbarState}
                    className="rich-text admin-editor min-h-56 px-3 py-3 outline-none"
                />
            </div>
        </div>
    );
}

function Toolbar({children}: { children: React.ReactNode }) {
    return (
        <div
            className="flex flex-wrap items-center gap-1 rounded-t-xl border-b border-black/10 bg-soft-control px-2 py-1.5">
            {children}
        </div>
    );
}

function ToolbarDivider() {
    return <span aria-hidden className="mx-0.5 h-5 w-px bg-black/10"/>;
}

function ToolbarButton({
                           label,
                           active = false,
                           onClick,
                           children,
                       }: {
    label: string;
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            // Suppress mousedown so the toolbar button doesn't steal focus/selection from the editor.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                active ? "bg-teal-950 text-white" : "text-teal-950 hover:bg-black/5"
            }`}
        >
            {children}
        </button>
    );
}
