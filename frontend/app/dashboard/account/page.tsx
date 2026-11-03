"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, errorMessage } from "@/lib/api";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20";

/** Every user can change their own password here, no admin needed. */
export default function AccountPage() {
  const { token, me } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("The new passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/dashboard/api/me/password", {
        method: "POST",
        token,
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, "Could not change the password."));
        return;
      }
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-5 max-w-lg space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text">Account</h2>
        {me && (
          <p className="mt-1 text-sm text-text-muted">
            Signed in as <span className="font-medium text-text">{me.username}</span>
            {me.email ? ` (${me.email})` : ""}, role: {me.is_admin ? "admin" : "user"}.
          </p>
        )}
      </div>
      <form
        onSubmit={changePassword}
        className="space-y-4 rounded-xl border border-border bg-background p-5 shadow-sm"
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Change password</h3>
        <label className="block space-y-1 text-sm text-text">
          <span>Current password</span>
          <input type="password" required autoComplete="current-password" value={current}
            onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
        </label>
        <label className="block space-y-1 text-sm text-text">
          <span>New password</span>
          <input type="password" required autoComplete="new-password" value={next}
            onChange={(e) => setNext(e.target.value)} className={inputClass} />
        </label>
        <label className="block space-y-1 text-sm text-text">
          <span>New password again</span>
          <input type="password" required autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {saving ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
