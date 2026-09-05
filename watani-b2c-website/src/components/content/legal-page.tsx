import {PageHero} from "@/components/content/page-hero";
import {Reveal} from "@/components/content/reveal";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/**
 * Shared shell for Terms and Privacy: compact flat-teal hero, a sticky
 * table of contents on desktop, and numbered section cards.
 */
export function LegalPage({
                              eyebrow,
                              title,
                              intro,
                              updated,
                              sections,
                          }: {
    eyebrow: string;
    title: string;
    intro: string;
    updated: string;
    sections: LegalSection[];
}) {
    return (
        <div className="shell pt-6 pb-20">
            <PageHero eyebrow={eyebrow} title={title} intro={intro} compact/>

            <div className="mt-12 gap-12 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
                {/* Anchor nav - desktop only; on mobile the sections are short enough
            to scroll, and a stacked duplicate list would just add noise. */}
                <nav aria-label="On this page" className="hidden lg:block">
                    <div className="sticky top-28">
                        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
                            On this page
                        </p>
                        <ul className="mt-4 space-y-1">
                            {sections.map((section, index) => (
                                <li key={section.id}>
                                    <a
                                        href={`#${section.id}`}
                                        className="flex gap-2.5 py-1.5 text-[14px] leading-snug text-muted transition-colors hover:text-teal-950"
                                    >
                    <span className="font-bold text-teal-950/40">
                      {index + 1}
                    </span>
                                        {section.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-6 border-t border-black/[0.06] pt-4 text-[13px] text-muted">
                            Last updated
                            <br/>
                            <span className="font-semibold text-teal-950">{updated}</span>
                        </p>
                    </div>
                </nav>

                <div>
                    <p className="text-[13px] text-muted lg:hidden">
                        Last updated: <span className="font-semibold text-teal-950">{updated}</span>
                    </p>

                    <div className="mt-6 space-y-4 lg:mt-0">
                        {sections.map((section, index) => (
                            <Reveal key={section.id} delay={Math.min(index, 3) * 0.04}>
                                <section
                                    id={section.id}
                                    // Offsets the anchor jump clear of the sticky site header.
                                    className="scroll-mt-28 rounded-[22px] bg-surface p-6 shadow-card sm:p-8"
                                >
                                    <div className="flex items-start gap-4">
                    <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-500 text-[14px] font-extrabold text-teal-950"
                    >
                      {index + 1}
                    </span>
                                        <div className="min-w-0">
                                            <h2 className="text-[18px] font-extrabold leading-snug text-teal-950">
                                                {section.title}
                                            </h2>
                                            <div className="mt-2.5 space-y-3 text-[15px] leading-relaxed text-muted">
                                                {section.body}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
