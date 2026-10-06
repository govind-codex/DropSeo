import type { ComponentProps } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Logo } from "@/components/ui/navbar-02-utils/logo";
import { NavigationSheet } from "@/components/ui/navbar-02-utils/navigation-sheet";

const links = [
  { label: "Home", href: "#main" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Pricing", href: "#pricing" },
];

export function NavMenu(props: ComponentProps<typeof NavigationMenu>) {
  return (
    <NavigationMenu {...props}>
      <NavigationMenuList>
        {links.map((link) => (
          <NavigationMenuItem key={link.href}>
            <NavigationMenuLink asChild className={navigationMenuTriggerStyle({ className: "bg-transparent text-[#526b68] hover:bg-[#eaf5f0] hover:text-[#087c68] focus:bg-[#eaf5f0] focus:text-[#087c68]" })}>
              <a href={link.href}>{link.label}</a>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export default function Navbar() {
  return (
    <nav className="landing-navbar-v2 sticky top-0 z-40 h-16 border-b border-[#dce8e3] bg-white/90 shadow-[0_8px_30px_rgba(22,61,53,0.05)] backdrop-blur-xl" aria-label="Main navigation">
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-10">
        <div className="flex items-center gap-8 lg:gap-12">
          <Logo />
          <NavMenu className="hidden md:flex" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button className="hidden border-[#c9ddd5] bg-white text-[#294742] hover:bg-[#edf7f3] sm:inline-flex" variant="outline" asChild>
            <a href="/api/auth/google" target="_top">Sign in</a>
          </Button>
          <Button className="hidden bg-[#087c68] text-white shadow-[0_7px_18px_rgba(8,124,104,0.2)] hover:-translate-y-0.5 hover:bg-[#066d5b] hover:shadow-[0_10px_24px_rgba(8,124,104,0.28)] sm:inline-flex" asChild>
            <a href="/api/auth/google" target="_top">Get started <ArrowRight aria-hidden="true" /></a>
          </Button>
          <div className="md:hidden">
            <NavigationSheet />
          </div>
        </div>
      </div>
    </nav>
  );
}
