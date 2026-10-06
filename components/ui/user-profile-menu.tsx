"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronRight, CreditCard, History, Loader2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

type UserProfileMenuProps = {
  user: { name: string; email: string };
  className?: string;
};

const menuItems = [
  { label: "My Investigations", href: "/investigations", icon: History },
  { label: "Billing", href: "/checkout", icon: CreditCard },
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
        className="group flex items-center gap-1.5 rounded-full border border-[#cee1da] bg-white/90 p-1 pr-2 text-[#385b54] shadow-[0_3px_12px_rgba(23,60,50,0.08)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#9fcbbc] hover:shadow-[0_7px_18px_rgba(23,60,50,0.12)]"
        type="button"
        aria-label="Open profile menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="grid size-8 place-items-center rounded-full bg-linear-to-br from-[#dff3eb] to-[#cde9de] text-xs font-bold text-[#176854] ring-1 ring-[#c5e0d6]" aria-hidden="true">{initial}</span>
        <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            id={menuId}
            className="absolute right-0 top-[calc(100%+10px)] z-60 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#d8e6e1] bg-white p-2 text-[#294742] shadow-[0_22px_60px_rgba(16,42,45,0.18)]"
            role="menu"
            aria-label="User profile menu"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scaleY: 0.94 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scaleY: 0.97 }}
            transition={{ duration: reduceMotion ? 0.1 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top right" }}
          >
            <motion.div
              className="flex items-center gap-3 rounded-xl bg-linear-to-br from-[#edf8f4] to-[#f7fbf9] p-3"
              initial={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.05 }}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#d9f0e7] text-sm font-bold text-[#176854] ring-1 ring-[#c4e0d5]" aria-hidden="true">{initial}</span>
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
                      className="group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium text-[#536c65] transition-colors hover:bg-[#edf7f3] hover:text-[#087c68] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6bd0bb]"
                      href={item.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                    >
                      <Icon className="mr-3 size-4.5" aria-hidden="true" />
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
