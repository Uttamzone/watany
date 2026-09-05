/**
 * Allowlist sanitiser for admin-authored HTML reaching `dangerouslySetInnerHTML`
 * - a stored-XSS guard. Strict: unlisted tags/attributes are dropped, not escaped.
 */

const ALLOWED_TAGS = new Set([
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "ul",
    "ol",
    "li",
    "h2",
    "h3",
    "h4",
    "blockquote",
]);

/** Elements whose entire contents must go, not just the tags. */
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript)\b[\s\S]*?<\/\1\s*>/gi;

/** Unclosed dangerous elements, e.g. a bare `<script src=…>`. */
const DROP_VOID_DANGEROUS = /<(script|style|iframe|object|embed|noscript)\b[^>]*>/gi;

export function sanitizeRichText(html: string | null | undefined): string {
    if (!html) return "";

    return html
        .replace(DROP_WITH_CONTENT, "")
        .replace(DROP_VOID_DANGEROUS, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        // Rebuild every remaining tag from its name alone, which drops all
        // attributes - and with them onerror/onclick/style/href injection.
        .replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_match, slash: string, tag: string) => {
            const name = tag.toLowerCase();
            if (!ALLOWED_TAGS.has(name)) return "";
            return slash ? `</${name}>` : `<${name}>`;
        })
        .trim();
}

/**
 * True when the sanitised markup still carries visible content, so a tab can
 * fall back rather than render an empty panel.
 */
export function hasRichTextContent(html: string | null | undefined): boolean {
    return sanitizeRichText(html).replace(/<[^>]*>/g, "").trim().length > 0;
}
