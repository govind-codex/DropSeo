"use client";

import { useEffect, useRef, type ReactNode } from "react";

type LandingRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  onLoad?: boolean;
  variant?: "rise" | "hero" | "scale";
};

export function LandingReveal({ children, className, delay = 0, onLoad = false, variant = "rise" }: LandingRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !root.animate) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const animations: Animation[] = [];
    let played = false;
    let observer: IntersectionObserver | undefined;
    const finish = () => animations.forEach((animation) => animation.cancel());
    const reveal = () => {
      if (played) return;
      played = true;
      root.dataset.motionPlayed = "true";
      observer?.disconnect();
      if (reduced.matches || root.contains(document.activeElement)) return;
      const targets = variant === "hero" ? Array.from(root.children) : [root];
      targets.forEach((target, index) => {
        const headline = variant === "hero" && target.tagName === "H1";
        const from: Keyframe = {
          opacity: 0,
          transform: variant === "scale" ? "translateY(24px) scale(.975)" : `translateY(${headline ? 20 : 24}px)`,
          ...(headline ? { clipPath: "inset(100% 0 0 0)", filter: "blur(3px)" } : {}),
        };
        const to: Keyframe = { opacity: 1, transform: "none", ...(headline ? { clipPath: "inset(0 0 0 0)", filter: "blur(0px)" } : {}) };
        animations.push(target.animate([from, to], {
          duration: headline ? 950 : variant === "scale" ? 800 : 650,
          delay: delay * 1000 + (variant === "hero" ? index * 95 : 0),
          easing: "cubic-bezier(.22,1,.36,1)",
          // Canceling or finishing always restores the visible HTML underneath.
          fill: "backwards",
        }));
      });
    };
    if (onLoad) reveal();
    else {
      observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) reveal(); }, { threshold: .12 });
      observer.observe(root);
    }
    const preference = () => { if (reduced.matches) { finish(); reveal(); } };
    root.addEventListener("focusin", finish);
    reduced.addEventListener("change", preference);
    return () => { observer?.disconnect(); finish(); root.removeEventListener("focusin", finish); reduced.removeEventListener("change", preference); };
  }, [delay, onLoad, variant]);

  return <div ref={ref} className={className} data-landing-motion={variant}>{children}</div>;
}
