'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { bouncy, useMotionPreference } from './motion-presets';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  children?: Array<{ href: string; label: string }>;
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Sales Insights', icon: 'dashboard' },
  { href: '/analytics', label: 'Operations Insights', icon: 'analytics' },
  { href: '/forecast', label: 'Forecast', icon: 'schedule' },
  { href: '/products', label: 'Products', icon: 'category' },
  { href: '/shipments', label: 'Shipments', icon: 'local_shipping' },
  {
    href: '/orders',
    label: 'Orders',
    icon: 'inventory_2',
    children: [
      { href: '/orders', label: 'Add Order' },
      { href: '/orders/search', label: 'Search Order' },
    ],
  },
  { href: '/dev', label: 'Dev', icon: 'terminal' },
];

const utilityItems: NavItem[] = [
  { href: '/help', label: 'Help Center', icon: 'help' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export function SideNav({ logoutAction }: { logoutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hoverScale, tapScale, reducedMotion } = useMotionPreference();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    '/orders': true,
  });
  const sharedFilterKeys = ['region', 'state', 'year', 'month'];
  const withSharedFilters = (href: string): string => {
    if (href !== '/dashboard' && href !== '/analytics') return href;
    const next = new URLSearchParams();
    for (const key of sharedFilterKeys) {
      for (const value of searchParams.getAll(key)) {
        if (value) next.append(key, value);
      }
    }
    const query = next.toString();
    return query ? `${href}?${query}` : href;
  };

  return (
    <nav className="text-[#0D1B2A] dark:text-[#f7f9fb] font-['Inter'] text-sm font-medium w-64 fixed left-0 top-0 bg-[#f2f4f6] dark:bg-[#191c1e] flex-col h-full p-4 space-y-2 border-r border-transparent z-40 hidden md:flex">
      <div className="mb-8 px-2 flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-headline font-bold">
          N
        </div>
        <div>
          <div className="text-lg font-extrabold text-[#0D1B2A] dark:text-white font-headline">
            Nexus Logistics
          </div>
          <div className="text-xs text-on-surface-variant">Enterprise BI</div>
        </div>
      </div>

      <div className="flex-1 space-y-1">
        {navItems.map((item) => {
          const hasChildren = Boolean(item.children?.length);
          const active = hasChildren
            ? pathname === item.href || pathname.startsWith(`${item.href}/`)
            : pathname === item.href;
          return (
            <motion.div key={item.href} className="relative space-y-1">
              {active && (
                <motion.div
                  layoutId="navPill"
                  className="pointer-events-none absolute inset-x-0 top-0 h-[46px] rounded-lg bg-white dark:bg-[#1c2a40] shadow-sm"
                  transition={bouncy}
                />
              )}
              <motion.div whileHover={{ x: 4, scale: hoverScale }} whileTap={{ scale: tapScale }} className="relative">
                {hasChildren ? (
                  <div
                    className={`flex items-center justify-between space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                      active
                        ? 'text-[#0D1B2A] dark:text-white font-bold'
                        : 'text-[#47607e] dark:text-[#c4c6cc] hover:bg-[#f2f4f6] dark:hover:bg-[#1c2a40]'
                    }`}
                  >
                    <Link href={withSharedFilters(item.href)} className="flex items-center space-x-3 min-w-0">
                      <motion.span
                        className={`material-symbols-outlined ${active ? "[font-variation-settings:'FILL'_1]" : ''}`}
                        animate={active && !reducedMotion ? { rotate: [0, -8, 8, 0] } : { rotate: 0 }}
                        transition={{ duration: 0.35 }}
                      >
                        {item.icon}
                      </motion.span>
                      <span>{item.label}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [item.href]: !prev[item.href],
                        }))
                      }
                      className="rounded p-0.5 hover:bg-surface-container-high"
                      aria-label={`Toggle ${item.label} submenu`}
                    >
                      <span className="material-symbols-outlined text-base text-on-surface-variant">
                        {active || expandedGroups[item.href] ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                  </div>
                ) : (
                  <Link
                    href={withSharedFilters(item.href)}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                      active
                        ? 'text-[#0D1B2A] dark:text-white font-bold'
                        : 'text-[#47607e] dark:text-[#c4c6cc] hover:bg-[#f2f4f6] dark:hover:bg-[#1c2a40]'
                    }`}
                  >
                    <motion.span
                      className={`material-symbols-outlined ${active ? "[font-variation-settings:'FILL'_1]" : ''}`}
                      animate={active && !reducedMotion ? { rotate: [0, -8, 8, 0] } : { rotate: 0 }}
                      transition={{ duration: 0.35 }}
                    >
                      {item.icon}
                    </motion.span>
                    <span>{item.label}</span>
                  </Link>
                )}
              </motion.div>
              {hasChildren && (active || expandedGroups[item.href]) && (
                <div className="ml-6 mr-2 space-y-0.5 border-l border-[rgba(196,198,204,0.25)] pl-3">
                  {item.children!.map((child) => {
                    const childActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`block rounded-md px-2 py-1.5 text-xs transition-colors ${
                          childActive
                            ? 'bg-white dark:bg-[#1c2a40] text-[#0D1B2A] dark:text-white font-semibold'
                            : 'text-[#47607e] dark:text-[#c4c6cc] hover:bg-[#f2f4f6] dark:hover:bg-[#1c2a40]'
                        }`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-auto space-y-1">
        {utilityItems.map((item) => (
          <motion.div key={item.href} whileHover={{ x: 4, scale: hoverScale }} whileTap={{ scale: tapScale }}>
            <Link
              href={item.href}
              className="flex items-center space-x-3 px-3 py-2.5 text-[#47607e] dark:text-[#c4c6cc] hover:bg-[#f2f4f6] dark:hover:bg-[#1c2a40] transition-all rounded-lg"
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          </motion.div>
        ))}
        <form action={logoutAction}>
          <motion.button
            type="submit"
            whileHover={{ x: 4, scale: hoverScale }}
            whileTap={{ scale: tapScale }}
            className="w-full flex items-center space-x-3 px-3 py-2.5 text-[#47607e] dark:text-[#c4c6cc] hover:bg-[#f2f4f6] dark:hover:bg-[#1c2a40] transition-all rounded-lg"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </motion.button>
        </form>
      </div>
    </nav>
  );
}
