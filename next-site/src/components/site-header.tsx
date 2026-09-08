"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const navigationItems = [
  { href: "/risk-metric/", label: "BTC Risk" },
  { href: "/spy-risk-metric/", label: "SPY Risk" },
  { href: "/ema-scanner/", label: "EMA Scanner" },
  { href: "/dividend-tracker/", label: "Dividend Tracker" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
    };
    const onPointer = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);
  return (
    <header className="site-header" ref={header} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="site-header__inner">
        <Link href="/" className="brand-lockup" aria-label="DaveyBitcoins home">
          <Image src="/brand.jpg" alt="" width={48} height={48} className="brand-lockup__image" priority />
          <span className="brand-lockup__copy">
            <span className="brand-lockup__name">Davey<strong>Bitcoins</strong></span>
            <span className="brand-lockup__tagline">Always be building</span>
          </span>
        </Link>
        <button className="mobile-tools-toggle" ref={toggle} type="button" aria-expanded={open}
          aria-controls="site-navigation" onClick={() => setOpen(!open)}>
          Tools <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        <nav id="site-navigation" className={`site-nav${open ? " site-nav--open" : ""}`} aria-label="Main navigation">
          {navigationItems.map((item) => {
            const isActive = pathname.replace(/\/$/, "") === item.href.replace(/\/$/, "");
            return <a key={item.href} href={item.href} onClick={() => setOpen(false)}
              className={isActive ? "site-nav__link--active" : undefined} aria-current={isActive ? "page" : undefined}>
              {item.label}
            </a>;
          })}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
