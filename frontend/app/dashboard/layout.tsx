"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { Toaster } from "sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { token, isReady, ensureAuth } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    const run = async () => {
      const ok = await ensureAuth();
      setChecked(true);
      if (!ok) router.replace("/login");
    };
    run();
  }, [isReady, ensureAuth, router]);

  if (!isReady || !checked || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="container mx-auto mt-5 max-w-7xl bg-surface px-4 py-6">
        <div id="toast-container" />
        {children}
      </main>
      <Toaster position="top-right" richColors />
    </>
  );
}
