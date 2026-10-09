"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronRight, CreditCard, History, Home, Loader2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

type UserProfileMenuProps = {
  user: { name: string; email: string };
  className?: string;
};

const menuItems = [
  { label: "Home", href: "/", icon: Home, accent: "bg-[#e3f5ee] text-[#087c68]" },
  { label: "My Investigations", href: "/investigations", icon: History, accent: "bg-[#e9efff] text-[#4b63c7]" },
  { label: "Billing", href: "/checkout", icon: CreditCard, accent: "bg-[#fff2dc] text-[#a46513]" },
];

export function UserProfileMenu({ user, className }: UserProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const initial = user.name.trim().charAt(0).toUpperCase() || "U";

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        ref={triggerRef}
        className="group flex items-center gap-1.5 rounded-full border border-[#a9d4c5] bg-linear-to-br from-white via-[#f4fbf8] to-[#e5f5ef] p-1 pr-2 text-[#236454] shadow-[0_5px_18px_rgba(8,124,104,0.16)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#66b9a3] hover:shadow-[0_9px_25px_rgba(8,124,104,0.24)]"
        type="button"
        aria-label="Open profile menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="grid size-8 place-items-center rounded-full bg-linear-to-br from-[#bfe8d9] to-[#dff5ed] text-xs font-bold text-[#08705d] ring-1 ring-[#99cfbd] transition-transform duration-300 group-hover:scale-105" aria-hidden="true">{initial}</span>
        <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            id={menuId}
            className="absolute right-0 top-[calc(100%+10px)] z-60 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#badbce] bg-linear-to-b from-[#f5fcf9] via-white to-white p-2 text-[#294742] shadow-[0_24px_70px_rgba(8,87,73,0.24)]"
            role="menu"
            aria-label="User profile menu"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scaleY: 0.94 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scaleY: 0.97 }}
            transition={{ duration: reduceMotion ? 0.1 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top right" }}
          >
            <motion.div
              className="absolute inset-x-6 top-0 h-0.5 origin-center rounded-full bg-linear-to-r from-transparent via-[#20b58e] to-transparent"
              aria-hidden="true"
              initial={reduceMotion ? undefined : { scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: reduceMotion ? 0 : 0.08, duration: 0.45 }}
            />
            <motion.span
              className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-[#8fe1c5]/25 blur-2xl"
              aria-hidden="true"
              animate={reduceMotion ? undefined : { x: [0, -9, 0], y: [0, 7, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-[#cce7dc] bg-linear-to-br from-[#def4eb] via-[#edf9f4] to-[#f7fbf9] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
              initial={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.05 }}
            >
              <motion.span
                className="grid size-11 shrink-0 place-items-center rounded-full bg-linear-to-br from-[#b9e5d5] to-[#e2f7ef] text-sm font-bold text-[#08705d] ring-1 ring-[#91cdb9]"
                aria-hidden="true"
                animate={reduceMotion ? undefined : { boxShadow: ["0 0 0 0 rgba(16,162,130,0)", "0 0 0 6px rgba(16,162,130,0.10)", "0 0 0 0 rgba(16,162,130,0)"] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              >{initial}</motion.span>
              <span className="min-w-0">
                <strong className="block truncate text-sm font-semibold">{user.name}</strong>
                <span className="block truncate text-xs text-[#71857f]">{user.email}</span>
              </span>
            </motion.div>

            <nav className="mt-2 grid gap-1" aria-label="Account navigation">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.href}
                    initial={reduceMotion ? undefined : { opacity: 0, y: -7 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduceMotion ? 0 : 0.08 + index * 0.045 }}
                  >
                    <Link
                      className="group flex items-center rounded-xl px-2.5 py-2 text-sm font-medium text-[#49655d] transition-[color,background-color,transform] hover:translate-x-0.5 hover:bg-[#edf8f4] hover:text-[#087c68] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6bd0bb]"
                      href={item.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                    >
                      <span className={cn("mr-3 grid size-8 shrink-0 place-items-center rounded-lg transition-transform duration-200 group-hover:scale-105", item.accent)} aria-hidden="true"><Icon className="size-4" /></span>
                      {item.label}
                      <ChevronRight className="ml-auto size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <motion.form
              className="mt-2 border-t border-[#e4ece9] pt-2"
              action="/api/auth/logout"
              method="post"
              onSubmit={() => setSigningOut(true)}
              initial={reduceMotion ? undefined : { opacity: 0, y: -7 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.17 }}
            >
              <button
                className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-[#a3423d] transition-colors hover:bg-[#fff1ef] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#db8b83] disabled:cursor-progress disabled:opacity-65"
                type="submit"
                role="menuitem"
                disabled={signingOut}
              >
                {signingOut ? <Loader2 className="mr-3 size-4.5 animate-spin" aria-hidden="true" /> : <LogOut className="mr-3 size-4.5" aria-hidden="true" />}
                {signingOut ? "Signing out…" : "Log out"}
              </button>
            </motion.form>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
