import Image from "next/image";
import Link from "next/link";
import {ArrowRight} from "lucide-react";

/** Category shortcut rail (design.md §7.2) - five cards plus a "See all" card, snap-scrolls on narrow screens. */

const railCategories = [
    {
        slug: "olive-oil",
        name: "Olive Oil",
        tagline: "Palestinian harvest",
        image: "/art/olive_oil.jpeg",
        imageClassName: "scale-[1.12]",
    },
    {
        slug: "olives",
        name: "Olives",
        tagline: "Jenin & regional varieties",
        image: "/art/olives.jpeg",
        imageClassName: "scale-[1.08]",
    },
    {
        slug: "zaatar",
        name: "Zaatar",
        tagline: "Herbs and blends",
        image: "/art/zaatar.jpeg",
        imageClassName: "scale-[1.08]",
    },
    {
        slug: "cheese",
        name: "Cheese",
        tagline: "Nabulsi selection",
        image: "/art/cheese.jpeg",
        imageClassName: "scale-[1.08]",
    },
    {
        slug: "ceramics",
        name: "Ceramics",
        tagline: "Palestinian craft",
        image: "/art/ceramics.jpeg",
        imageClassName: "scale-[1.08]",
    },
];

export function CategoryRail() {
    return (
        <section aria-label="Shop by category" className="mt-12">
            {/* Grid only once there is room for all six cards; below that it scrolls. */}
            <ul className="rail-scroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:gap-4 sm:px-6 min-[1200px]:mx-0 min-[1200px]:grid min-[1200px]:grid-cols-[repeat(5,minmax(0,1fr))_0.6fr] min-[1200px]:px-0 min-[1200px]:pb-0 min-[1200px]:overflow-visible">
                {railCategories.map((category) => (
                    <li
                        key={category.slug}
                        className="category-rail-item shrink-0 snap-start first:scroll-ml-4 sm:first:scroll-ml-6 min-[1200px]:first:scroll-ml-0"
                    >
                        <Link
                            href={`/categories?category=${category.slug}`}
                            className="group relative flex h-[120px] items-center overflow-hidden rounded-[14px] bg-surface pl-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                        >
              <span className="relative z-10 min-w-0 flex-1 py-4">
                <span className="block text-[16px] font-bold text-teal-950">
                  {category.name}
                </span>
                <span className="mt-1 block max-w-[108px] text-[12px] leading-[1.45] text-muted">
                  {category.tagline}
                </span>
              </span>
                            <span
                                className="relative mr-3 size-20 shrink-0"
                                aria-hidden
                            >
                <Image
                    src={category.image}
                    alt=""
                    fill
                    sizes="80px"
                    className={`category-photo object-cover transition-transform duration-300 group-hover:scale-[1.14] ${category.imageClassName}`}
                />
              </span>
                        </Link>
                    </li>
                ))}

                <li className="category-rail-item category-rail-see-all shrink-0 snap-start">
                    <Link
                        href="/categories"
                        className="group flex h-[120px] flex-col items-center justify-center gap-2.5 rounded-[14px] bg-lime-500 px-3 text-center transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-1 hover:bg-lime-400 hover:shadow-card-hover"
                    >
            <span
                className="grid size-10 place-items-center rounded-full bg-white transition-transform duration-200 group-hover:translate-x-1">
              <ArrowRight className="size-5 text-teal-950" strokeWidth={2} aria-hidden/>
            </span>
                        <span className="text-[14px] font-bold text-teal-950">See all</span>
                    </Link>
                </li>
            </ul>
        </section>
    );
}
