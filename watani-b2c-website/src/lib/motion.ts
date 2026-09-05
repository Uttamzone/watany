/**
 * Shared motion language - design.md §11. Durations are ms; use `sec` to
 * convert for Framer Motion transitions.
 */
export const motionTokens = {
    fast: 160,
    base: 240,
    slow: 480,
    easeOut: [0.16, 1, 0.3, 1] as const,
    easeInOut: [0.65, 0, 0.35, 1] as const,
    spring: {type: "spring" as const, stiffness: 420, damping: 30},
};

/** Convert a millisecond token to the seconds Framer Motion expects. */
export const sec = (ms: number) => ms / 1000;

/** Standard section reveal: fade up over 12–20px. */
export const sectionReveal = {
    initial: {opacity: 0, y: 16},
    whileInView: {opacity: 1, y: 0},
    viewport: {once: true, amount: 0.15},
    transition: {duration: sec(motionTokens.slow), ease: motionTokens.easeOut},
};
