"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b border-gray-800 bg-gray-900/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="text-xl font-bold text-blue-500 hover:text-blue-400 transition-colors"
          >
            DevPulse
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-300 hover:text-white text-sm font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/demo"
              className="text-green-400 hover:text-green-300 text-sm font-medium transition-colors"
            >
              Live Demo
            </Link>
            <Link
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </nav>

          <button
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-800 px-4 py-4 space-y-3 bg-gray-900">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block text-gray-300 hover:text-white font-medium"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/demo"
            className="block text-green-400 font-medium"
            onClick={() => setMobileOpen(false)}
          >
            Live Demo
          </Link>
          <Link
            href="/login"
            className="block bg-blue-600 text-white text-center font-medium px-4 py-2 rounded-lg"
            onClick={() => setMobileOpen(false)}
          >
            Sign In
          </Link>
        </div>
      )}
    </header>
  );
}
