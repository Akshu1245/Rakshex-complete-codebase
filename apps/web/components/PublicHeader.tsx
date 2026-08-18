/* Design reminder: Trust Ledger — quiet, high-confidence navigation that lets the overview page explain the product before signup. */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { RaksHexLogo } from "@/components/common/RaksHexLogo";

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="rx-public-header">
      <div className="rx-public-header-inner">
        <Link href="/" className="rx-public-brand" onClick={close} aria-label="RaksHex overview">
          <RaksHexLogo size={28} />
          <span>
            Raks<span>Hex</span>
          </span>
          <small>Action control</small>
        </Link>
        <nav
          className={open ? "rx-public-nav rx-public-nav-open" : "rx-public-nav"}
          aria-label="Public navigation"
        >
          <a href="/#how-it-works" onClick={close}>
            How it works
          </a>
          <a href="/#boundaries" onClick={close}>
            Trust boundary
          </a>
          <a href="/#before-you-sign" onClick={close}>
            Before you sign up
          </a>
          <Link href="/docs" onClick={close}>
            Documentation
          </Link>
          <div className="rx-mobile-actions">
            <Link href="/login" className="rx-nav-signin" onClick={close}>
              Sign in
            </Link>
            <Link href="/register" className="rx-nav-start" onClick={close}>
              Create workspace
            </Link>
          </div>
        </nav>
        <div className="rx-public-actions">
          <Link href="/login" className="rx-nav-signin">
            Sign in
          </Link>
          <Link href="/register" className="rx-nav-start">
            Create workspace
          </Link>
        </div>
        <button
          className="rx-mobile-menu"
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}
