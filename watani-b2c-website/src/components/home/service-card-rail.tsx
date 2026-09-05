/** Services strip (design.md §7.9) - lime backdrop, image-backed cards, scrolls on mobile. */

const services = [
  {
    title: "Pre-season olive oil orders",
    copy: "Reserve from the coming harvest before pressing begins.",
    backgroundImage: "/images/services/preseason-orders.webp",
  },
  {
    title: "Pickup across Canada",
    copy: "Collect your order from our partner pickup points.",
    backgroundImage: "/images/services/pickup-canada.webp",
  },
  {
    title: "Wholesale enquiries",
    copy: "Case and pallet pricing for grocers and restaurants.",
    backgroundImage: "/images/services/wholesale.webp",
  },
  {
    title: "Direct from Palestinian farmers",
    copy: "Sourced through trusted growers and family presses.",
    backgroundImage: "/images/services/palestinian-farmers.webp",
  },
];

export function ServiceCardRail() {
  return (
    <section aria-labelledby="services-heading" className="mt-12 sm:mt-20 bg-lime-500 py-14">
      <div className="shell">
        <h2
          id="services-heading"
          className="text-[26px] font-extrabold text-teal-950 sm:text-[32px] lg:text-[38px]"
        >
          How Watani &amp; Sons serves you
        </h2>

        <ul className="rail-scroll mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {services.map((service) => (
            <li
              key={service.title}
              className="w-[250px] shrink-0 snap-start lg:w-auto"
            >
              <div
                className="relative flex h-[260px] flex-col overflow-hidden rounded-[22px] bg-cover bg-right bg-no-repeat p-6 text-white"
                style={{ backgroundImage: `url(${service.backgroundImage})` }}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-b from-teal-950/90 via-teal-950/45 to-teal-950/20"
                />
                <h3 className="relative text-[18px] font-bold leading-snug">
                  {service.title}
                </h3>
                <p className="relative mt-2 text-[13px] leading-relaxed text-white/85">
                  {service.copy}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
