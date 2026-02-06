'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/time-log', label: 'Time Log' },
  { href: '/reports', label: 'Reports' },
  { href: '/clients', label: 'Clients' },
  { href: '/projects', label: 'Projects' },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-background border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo + Brand Name */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/DO_CODE_LAB_LOGO_NO_TEXT.png"
              alt="DO Code Lab Logo"
              width={40}
              height={40}
              className="h-10 w-auto"
              priority
            />
            <span className="font-heading text-lg sm:text-xl font-semibold text-primary">
              In DO Time
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-button px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-light text-primary-dark'
                      : 'text-text-muted hover:bg-primary-light hover:text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-button p-2 text-text-muted hover:bg-primary-light hover:text-primary"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-border py-2 pb-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block rounded-button px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-light text-primary-dark'
                      : 'text-text-muted hover:bg-primary-light hover:text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
