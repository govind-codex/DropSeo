"use client";

import { ArrowRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/components/ui/navbar-02-utils/logo";

const links = [
  { label: "Home", href: "#main" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Pricing", href: "#pricing" },
];

export function NavigationSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="border-[#cfe0da] bg-white text-[#294742] hover:bg-[#edf7f3]" size="icon" variant="outline" aria-label="Open navigation menu">
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent className="border-[#dce8e3] bg-[#f9fcfa] p-0" side="right">
        <SheetHeader className="border-b border-[#e2ebe7] px-6 py-5 text-left">
          <SheetTitle><Logo /></SheetTitle>
          <SheetDescription>Website intelligence, backed by evidence.</SheetDescription>
        </SheetHeader>
        <nav className="grid gap-1 px-4 py-5" aria-label="Mobile navigation">
          {links.map((link, index) => (
            <SheetClose asChild key={link.href}>
              <a
                className="group flex items-center justify-between rounded-xl px-4 py-3 text-[15px] font-medium text-[#405d57] transition-colors hover:bg-[#eaf6f1] hover:text-[#087c68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6bd0bb]"
                href={link.href}
              >
                <span><span className="mr-3 text-xs text-[#91a39d]">0{index + 1}</span>{link.label}</span>
                <ArrowRight className="size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
              </a>
            </SheetClose>
          ))}
        </nav>
        <div className="mt-auto grid gap-2 border-t border-[#e2ebe7] p-5">
          <Button className="border-[#c9ddd5] bg-white text-[#1f5147] hover:bg-[#edf7f3]" variant="outline" asChild>
            <a href="/api/auth/google" target="_top">Sign in</a>
          </Button>
          <Button className="bg-[#087c68] text-white shadow-sm hover:bg-[#066d5b]" asChild>
            <a href="/api/auth/google" target="_top">Get started <ArrowRight aria-hidden="true" /></a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
