"use client";

import React, { useEffect, useRef, useState } from "react";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number; // Optional delay in ms
  staggerIndex?: number; // Optional index for staggered grid items
  staggerStep?: number; // Step per item in ms (default 90ms)
  as?: React.ElementType;
}

/**
 * Performant, non-scroll-jank viewport entrance animation using native IntersectionObserver.
 * Fades in with a 20px upward slide over ~500ms ease-out.
 * Respects `prefers-reduced-motion`.
 */
export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  staggerIndex,
  staggerStep = 90,
  as: Component = "div",
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check if user prefers reduced motion
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  const calculatedDelay = staggerIndex !== undefined ? staggerIndex * staggerStep : delay;

  return (
    <Component
      ref={ref}
      style={{
        transitionDelay: `${calculatedDelay}ms`,
      }}
      className={`scroll-reveal-item ${isVisible ? "is-visible" : ""} ${className}`}
    >
      {children}
    </Component>
  );
}
