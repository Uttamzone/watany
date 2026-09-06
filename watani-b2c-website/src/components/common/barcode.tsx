import React from "react";

// Standard Code 128 character patterns (107 patterns, each with 6 alternating bar/space widths summing to 11)
// The stop character has 7 elements summing to 13.
const CODE128_PATTERNS: number[][] = [
    [2, 1, 2, 2, 2, 2], // 0: ' '
    [2, 2, 2, 1, 2, 2], // 1: '!'
    [2, 2, 2, 2, 2, 1], // 2: '"'
    [1, 2, 1, 2, 2, 3], // 3: '#'
    [1, 2, 1, 3, 2, 2], // 4: '$'
    [1, 3, 1, 2, 2, 2], // 5: '%'
    [1, 2, 2, 2, 1, 3], // 6: '&'
    [1, 2, 2, 3, 1, 2], // 7: '\''
    [1, 3, 2, 2, 1, 2], // 8: '('
    [2, 2, 1, 2, 1, 3], // 9: ')'
    [2, 2, 1, 3, 1, 2], // 10: '*'
    [2, 3, 1, 2, 1, 2], // 11: '+'
    [1, 1, 2, 2, 3, 2], // 12: ','
    [1, 2, 2, 1, 3, 2], // 13: '-'
    [1, 2, 2, 2, 3, 1], // 14: '.'
    [1, 1, 3, 2, 2, 2], // 15: '/'
    [1, 2, 3, 1, 2, 2], // 16: '0'
    [1, 2, 3, 2, 2, 1], // 17: '1'
    [2, 2, 3, 2, 1, 1], // 18: '2'
    [2, 2, 1, 1, 3, 2], // 19: '3'
    [2, 2, 1, 2, 3, 1], // 20: '4'
    [2, 1, 3, 2, 1, 2], // 21: '5'
    [2, 2, 3, 1, 1, 2], // 22: '6'
    [3, 1, 2, 1, 3, 1], // 23: '7'
    [3, 1, 1, 2, 2, 2], // 24: '8'
    [3, 2, 1, 1, 2, 2], // 25: '9'
    [3, 2, 1, 2, 2, 1], // 26: ':'
    [3, 1, 2, 2, 1, 2], // 27: ';'
    [3, 2, 2, 1, 1, 2], // 28: '<'
    [3, 2, 2, 2, 1, 1], // 29: '='
    [2, 1, 2, 1, 2, 3], // 30: '>'
    [2, 1, 2, 3, 2, 1], // 31: '?'
    [2, 3, 2, 1, 2, 1], // 32: '@'
    [1, 1, 1, 3, 2, 3], // 33: 'A'
    [1, 3, 1, 1, 2, 3], // 34: 'B'
    [1, 3, 1, 3, 2, 1], // 35: 'C'
    [1, 1, 2, 3, 1, 3], // 36: 'D'
    [1, 3, 2, 1, 1, 3], // 37: 'E'
    [1, 3, 2, 3, 1, 1], // 38: 'F'
    [2, 1, 1, 3, 1, 3], // 39: 'G'
    [2, 3, 1, 1, 1, 3], // 40: 'H'
    [2, 3, 1, 3, 1, 1], // 41: 'I'
    [1, 1, 2, 1, 3, 3], // 42: 'J'
    [1, 1, 2, 3, 3, 1], // 43: 'K'
    [1, 3, 2, 1, 3, 1], // 44: 'L'
    [1, 1, 3, 1, 2, 3], // 45: 'M'
    [1, 1, 3, 3, 2, 1], // 46: 'N'
    [1, 3, 3, 1, 2, 1], // 47: 'O'
    [3, 1, 3, 1, 2, 1], // 48: 'P'
    [2, 1, 1, 3, 3, 1], // 49: 'Q'
    [2, 3, 1, 1, 3, 1], // 50: 'R'
    [2, 1, 3, 1, 1, 3], // 51: 'S'
    [2, 1, 3, 3, 1, 1], // 52: 'T'
    [2, 1, 3, 1, 3, 1], // 53: 'U'
    [3, 1, 1, 1, 2, 3], // 54: 'V'
    [3, 1, 1, 3, 2, 1], // 55: 'W'
    [3, 3, 1, 1, 2, 1], // 56: 'X'
    [3, 1, 2, 1, 1, 3], // 57: 'Y'
    [3, 1, 2, 3, 1, 1], // 58: 'Z'
    [3, 3, 2, 1, 1, 1], // 59: '['
    [3, 1, 4, 1, 1, 1], // 60: '\\'
    [2, 2, 1, 4, 1, 1], // 61: ']'
    [4, 3, 1, 1, 1, 1], // 62: '^'
    [1, 1, 1, 2, 2, 4], // 63: '_'
    [1, 1, 1, 4, 2, 2], // 64: '`'
    [1, 2, 1, 1, 2, 4], // 65: 'a'
    [1, 2, 1, 4, 2, 1], // 66: 'b'
    [1, 4, 1, 1, 2, 2], // 67: 'c'
    [1, 4, 1, 2, 2, 1], // 68: 'd'
    [1, 1, 2, 2, 1, 4], // 69: 'e'
    [1, 1, 2, 4, 1, 2], // 70: 'f'
    [1, 2, 2, 1, 1, 4], // 71: 'g'
    [1, 2, 2, 4, 1, 1], // 72: 'h'
    [1, 4, 2, 1, 1, 2], // 73: 'i'
    [1, 4, 2, 2, 1, 1], // 74: 'j'
    [2, 4, 1, 2, 1, 1], // 75: 'k'
    [2, 2, 1, 1, 1, 4], // 76: 'l'
    [4, 1, 3, 1, 1, 1], // 77: 'm'
    [2, 4, 1, 1, 1, 2], // 78: 'n'
    [1, 3, 4, 1, 1, 1], // 79: 'o'
    [1, 1, 1, 2, 4, 2], // 80: 'p'
    [1, 2, 1, 1, 4, 2], // 81: 'q'
    [1, 2, 1, 2, 4, 1], // 82: 'r'
    [1, 1, 4, 2, 1, 2], // 83: 's'
    [1, 2, 4, 1, 1, 2], // 84: 't'
    [1, 2, 4, 2, 1, 1], // 85: 'u'
    [4, 1, 1, 2, 1, 2], // 86: 'v'
    [4, 2, 1, 1, 1, 2], // 87: 'w'
    [4, 2, 1, 2, 1, 1], // 88: 'x'
    [2, 1, 2, 1, 4, 1], // 89: 'y'
    [2, 1, 4, 1, 2, 1], // 90: 'z'
    [4, 1, 2, 1, 2, 1], // 91: '{'
    [1, 1, 1, 1, 4, 3], // 92: '|'
    [1, 1, 1, 3, 4, 1], // 93: '}'
    [1, 3, 1, 1, 4, 1], // 94: '~'
    [1, 1, 4, 1, 1, 3], // 95: DEL
    [1, 1, 4, 3, 1, 1], // 96: FNC3
    [4, 1, 1, 1, 1, 3], // 97: FNC2
    [4, 1, 1, 3, 1, 1], // 98: SHIFT
    [1, 1, 3, 1, 4, 1], // 99: CODE_C
    [1, 1, 4, 1, 3, 1], // 100: CODE_B
    [3, 1, 1, 1, 4, 1], // 101: FNC4
    [4, 1, 1, 1, 3, 1], // 102: FNC1
    [2, 1, 1, 4, 1, 2], // 103: START_A
    [2, 1, 1, 2, 1, 4], // 104: START_B
    [2, 1, 1, 2, 3, 2], // 105: START_C
    [2, 3, 3, 1, 1, 1, 2], // 106: STOP (13 modules)
];

/**
 * Encodes string to Code 128 (Subset B) modules.
 * Returns array of widths (bar, space, bar, space, ...)
 */
function encodeCode128B(text: string): number[] {
    const cleanText = (text || "").replace(/[^\x20-\x7E]/g, ""); // ASCII 32 to 126
    const START_B = 104;
    const STOP = 106;

    const values: number[] = [START_B];
    let checksum = START_B;

    for (let i = 0; i < cleanText.length; i++) {
        const code = cleanText.charCodeAt(i) - 32;
        values.push(code);
        checksum += code * (i + 1);
    }

    const checkCode = checksum % 103;
    values.push(checkCode);
    values.push(STOP);

    const widths: number[] = [];
    for (const val of values) {
        const pattern = CODE128_PATTERNS[val];
        if (pattern) {
            widths.push(...pattern);
        }
    }
    return widths;
}

interface BarcodeSvgProps {
    value: string;
    height?: number;
    barWidth?: number;
    showText?: boolean;
    className?: string;
    label?: string;
}

export function BarcodeSvg({
    value,
    height = 55,
    barWidth = 2,
    showText = true,
    className = "",
    label,
}: BarcodeSvgProps) {
    if (!value || !value.trim()) return null;

    const textToEncode = value.trim();
    const widths = encodeCode128B(textToEncode);

    // Calculate total module width
    const totalModules = widths.reduce((sum, w) => sum + w, 0);
    const quietZone = 10 * barWidth; // 10 modules on each side
    const totalSvgWidth = totalModules * barWidth + quietZone * 2;
    const textHeight = showText ? 16 : 0;
    const totalSvgHeight = height + textHeight;

    // Render bars
    const rects: React.ReactNode[] = [];
    let currentX = quietZone;

    for (let i = 0; i < widths.length; i++) {
        const w = widths[i] * barWidth;
        const isBar = i % 2 === 0; // even indices are bars, odd are spaces

        if (isBar) {
            rects.push(
                <rect
                    key={i}
                    x={currentX}
                    y={0}
                    width={w}
                    height={height}
                    fill="#000000"
                />
            );
        }
        currentX += w;
    }

    return (
        <div className={`inline-flex flex-col items-center select-none ${className}`}>
            <svg
                width={totalSvgWidth}
                height={totalSvgHeight}
                viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`}
                xmlns="http://www.w3.org/2000/svg"
                className="max-w-full h-auto"
                style={{ imageRendering: "pixelated" }}
            >
                <rect width={totalSvgWidth} height={totalSvgHeight} fill="#ffffff" />
                {rects}
                {showText && (
                    <text
                        x={totalSvgWidth / 2}
                        y={height + 13}
                        textAnchor="middle"
                        fontFamily="monospace, Courier, sans-serif"
                        fontSize="12"
                        fontWeight="700"
                        letterSpacing="2"
                        fill="#000000"
                    >
                        {label || textToEncode}
                    </text>
                )}
            </svg>
        </div>
    );
}
