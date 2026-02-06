'use client';

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
            <span className="font-heading text-xl font-semibold text-primary">
              In DO Time
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
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
        </div>
      </div>
    </header>
  );
}
