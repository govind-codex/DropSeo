"use client";

import { useEffect, useRef } from "react";

// The browser lays out the real heading. Its glyph positions become the dot mask,
// so the effect inherits the existing typeface, sizing, tracking and line breaks.
export function HalftoneHeadline({ lines }: { lines: string[] }) {
  const rootRef = useRef<HTMLHeadingElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let alive = true;
    let visible = true;
    let frame = 0;
    let width = 0;
    let height = 0;
    let scale = 1;
    let ink = "";
    let pointer = { x: -10000, y: -10000 };
    let ring = { x: 0, y: 0, at: -10000 };
    let dots: number[][] = [];
    let lastFrame = 0;
    const paint = (now: number) => {
      frame = 0;
      if (!alive || !visible || media.matches) return;
      // Keep spring speed consistent on high refresh rate displays.
      if (now - lastFrame < 15) { frame = requestAnimationFrame(paint); return; }
      lastFrame = now;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = ink;
      let moving = false;
      const age = now - ring.at;
      for (const dot of dots) {
        const [hx, hy, radius] = dot;
        const dx = dot[3] - pointer.x;
        const dy = dot[4] - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 65) {
          const force = (1 - distance / 65) * 2.6;
          dot[5] += dx / (distance || 1) * force;
          dot[6] += dy / (distance || 1) * force;
        }
        if (age < 700) {
          const rx = hx - ring.x;
          const ry = hy - ring.y;
          const rd = Math.hypot(rx, ry);
          const band = Math.max(0, 1 - Math.abs(rd - age * .8) / 24);
          const force = band * 3.2 * (1 - age / 700);
          dot[5] += rx / (rd || 1) * force;
          dot[6] += ry / (rd || 1) * force;
        }
        dot[5] = (dot[5] + (hx - dot[3]) * .05) * .84;
        dot[6] = (dot[6] + (hy - dot[4]) * .05) * .84;
        dot[3] += dot[5]; dot[4] += dot[6];
        if (Math.abs(dot[5]) + Math.abs(dot[6]) > .02 || Math.abs(dot[3] - hx) + Math.abs(dot[4] - hy) > .05) moving = true;
        else { dot[3] = hx; dot[4] = hy; dot[5] = dot[6] = 0; }
        context.beginPath(); context.arc(dot[3], dot[4], radius, 0, Math.PI * 2); context.fill();
      }
      if (moving || age < 700) frame = requestAnimationFrame(paint);
    };
    const wake = () => { if (!frame && !media.matches && visible) frame = requestAnimationFrame(paint); };
    const layout = () => {
      root.removeAttribute("data-halftone-ready");
      if (!alive || media.matches) { context.clearRect(0, 0, canvas.width, canvas.height); return; }
      const bounds = root.getBoundingClientRect();
      width = Math.ceil(bounds.width); height = Math.ceil(bounds.height);
      if (!width || !height) return;
      scale = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      const mask = document.createElement("canvas"); mask.width = width; mask.height = height;
      const maskContext = mask.getContext("2d", { willReadFrequently: true });
      if (!maskContext) return;
      const style = getComputedStyle(root);
      ink = style.color;
      maskContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      maskContext.letterSpacing = style.letterSpacing;
      maskContext.fillStyle = ink;
      maskContext.textBaseline = "alphabetic";
      for (const span of root.querySelectorAll<HTMLElement>(".hero-title-line")) {
        const node = span.firstChild;
        if (!node || node.nodeType !== Node.TEXT_NODE) return;
        const text = node.textContent || "";
        const rows: { text: string; left: number; top: number; height: number }[] = [];
        for (let i = 0; i < text.length; i++) {
          const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
          const rect = range.getBoundingClientRect();
          let row = rows.find((item) => Math.abs(item.top - rect.top) < 1);
          if (!row) { row = { text: "", left: rect.left, top: rect.top, height: rect.height }; rows.push(row); }
          row.text += text[i];
        }
        for (const row of rows) {
          const metrics = maskContext.measureText(row.text);
          const ascent = metrics.fontBoundingBoxAscent;
          const descent = metrics.fontBoundingBoxDescent;
          maskContext.fillText(row.text, row.left - bounds.left, row.top - bounds.top + (row.height - ascent - descent) / 2 + ascent);
        }
      }
      const pixels = maskContext.getImageData(0, 0, width, height).data;
      const gap = Math.max(2, Math.min(3, parseFloat(style.fontSize) / 26));
      dots = [];
      for (let y = 0; y < height; y += gap) for (let x = 0; x < width; x += gap) {
        let coverage = 0;
        for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
          const ix = Math.min(width - 1, Math.floor(x + (sx + .5) * gap / 3));
          const iy = Math.min(height - 1, Math.floor(y + (sy + .5) * gap / 3));
          coverage += pixels[(iy * width + ix) * 4 + 3] / (9 * 255);
        }
        if (coverage < .06) continue;
        const hx = x + gap / 2; const hy = y + gap / 2;
        dots.push([hx, hy, Math.sqrt(coverage) * gap * .56, hx, hy, 0, 0]);
      }
      if (!dots.length) return;
      pointer = { x: -10000, y: -10000 }; ring.at = -10000;
      lastFrame = 0; paint(performance.now());
      root.setAttribute("data-halftone-ready", "true");
    };
    const position = (event: PointerEvent) => { const rect = root.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
    const move = (event: PointerEvent) => { if (event.pointerType === "touch") return; pointer = position(event); wake(); };
    const leave = () => { pointer = { x: -10000, y: -10000 }; wake(); };
    const down = (event: PointerEvent) => { ring = { ...position(event), at: performance.now() }; wake(); };
    const observer = new ResizeObserver(layout); observer.observe(root);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }); intersection.observe(root);
    root.addEventListener("pointermove", move, { passive: true }); root.addEventListener("pointerleave", leave); root.addEventListener("pointerdown", down, { passive: true });
    media.addEventListener("change", layout);
    document.fonts.ready.then(() => { if (alive) layout(); });
    layout();
    return () => { alive = false; cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); media.removeEventListener("change", layout); root.removeEventListener("pointermove", move); root.removeEventListener("pointerleave", leave); root.removeEventListener("pointerdown", down); root.removeAttribute("data-halftone-ready"); };
  }, [lines]);
  return <h1 ref={rootRef} className="halftone-headline">{lines.map((line) => <span className="hero-title-line" key={line}>{line}</span>)}<canvas ref={canvasRef} aria-hidden="true" /></h1>;
}
