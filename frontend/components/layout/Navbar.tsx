"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function Navbar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <nav className="border-b border-border bg-surface-nav text-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center">
            <Link
              href="/"
              className="text-xl font-semibold text-white hover:opacity-90"
            >
              GUI Container Manager
            </Link>
            <div className="ml-10 hidden gap-6 sm:flex">
              <Link
                href="/dashboard/containers"
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${pathname === "/dashboard/containers" ? "bg-primary text-white" : "text-slate-200 hover:bg-slate-600 hover:text-white"}`}
              >
                Containers
              </Link>
              <Link
                href="/dashboard/images"
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${pathname === "/dashboard/images" ? "bg-primary text-white" : "text-slate-200 hover:bg-slate-600 hover:text-white"}`}
              >
                Images
              </Link>
            </div>
          </div>
          <div className="hidden sm:block">
            <button
              type="button"
              onClick={logout}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600 hover:text-white"
            >
              Logout
            </button>
          </div>
          <button
            type="button"
            className="rounded-xl p-2 sm:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
        {open && (
          <div className="border-t border-slate-600 py-2 sm:hidden">
            <Link
              href="/dashboard/containers"
              className="block rounded-xl px-3 py-2 text-sm text-white transition-colors hover:bg-slate-600"
              onClick={() => setOpen(false)}
            >
              Containers
            </Link>
            <Link
              href="/dashboard/images"
              className="block rounded-xl px-3 py-2 text-sm text-white transition-colors hover:bg-slate-600"
              onClick={() => setOpen(false)}
            >
              Images
            </Link>
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white transition-colors hover:bg-slate-600"
              onClick={() => {
                setOpen(false);
                logout();
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
