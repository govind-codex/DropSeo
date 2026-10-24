"use client";

// Adapted from Variable Proximity by 000h / Cojeev (MIT).
// https://cojeev.com/ui/docs/variable-proximity/
import { useCallback, useEffect, useRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import styles from "./variable-proximity.module.css";

type VariableProximityProps = Omit<ComponentProps<"p">, "children"> & {
  text: string;
  radius?: number;
  fromWeight?: number;
  toWeight?: number;
  paused?: boolean;
};

export function VariableProximity({
  text, radius = 150, fromWeight = 400, toWeight = 700, paused = false,
  className, onPointerMove, onPointerLeave, ...props
}: VariableProximityProps) {
  const host = useRef<HTMLParagraphElement>(null);
  const frame = useRef(0);
  const enabled = useRef(false);
  const point = useRef<{ x: number; y: number } | null>(null);
  const from = Math.max(200, Math.min(800, fromWeight));
  const to = Math.max(200, Math.min(800, toWeight));

  const paint = useCallback(() => {
    frame.current = 0;
    const letters = Array.from(host.current?.querySelectorAll<HTMLElement>("[data-proximity-letter]") ?? []);
    // Read positions together before writing styles to avoid repeated layout work.
    const weights = letters.map((letter) => {
      if (!enabled.current || !point.current) return from;
      const rect = letter.getBoundingClientRect();
      const distance = Math.hypot(point.current.x - rect.x - rect.width / 2, point.current.y - rect.y - rect.height / 2);
      const proximity = 1 - Math.min(1, distance / Math.max(1, radius));
      return from + (to - from) * proximity * proximity * (3 - 2 * proximity);
    });
    letters.forEach((letter, index) => {
      letter.style.fontVariationSettings = `"wght" ${weights[index]}, "wdth" 100`;
    });
  }, [from, to, radius]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = matchMedia("(any-pointer: fine)");
    let visible = false;
    const update = () => {
      enabled.current = visible && !paused && !reducedMotion.matches && finePointer.matches && !document.hidden;
      element.dataset.running = String(enabled.current);
      if (!enabled.current) point.current = null;
      paint();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    reducedMotion.addEventListener("change", update);
    finePointer.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      cancelAnimationFrame(frame.current);
      enabled.current = false;
      observer.disconnect();
      reducedMotion.removeEventListener("change", update);
      finePointer.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [paint, paused, text]);

  return (
    <p {...props} ref={host} className={cn(styles.text, className)} data-slot="variable-proximity"
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (event.defaultPrevented || event.pointerType === "touch" || !enabled.current) return;
        point.current = { x: event.clientX, y: event.clientY };
        if (!frame.current) frame.current = requestAnimationFrame(paint);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        point.current = null;
        cancelAnimationFrame(frame.current);
        paint();
      }}>
      <span className={styles.accessible}>{text}</span>
      <span aria-hidden="true">{text.split(/(\s+)/).map((word, index) => /^\s+$/.test(word) ? word : (
        <span className={styles.word} key={index}>{Array.from(word).map((letter, letterIndex) => (
          <span key={letterIndex} data-proximity-letter="" style={{ fontVariationSettings: `"wght" ${from}, "wdth" 100` }}>{letter}</span>
        ))}</span>
      ))}</span>
    </p>
  );
}
