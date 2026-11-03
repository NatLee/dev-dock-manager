"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, errorMessage } from "@/lib/api";
import type { Account } from "@/types/api";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20";
const buttonClass =
  "rounded-lg border border-border px-2 py-1 text-xs font-medium text-text transition-colors hover:bg-surface disabled:opacity-50";

const emptyNewUser = { username: "", email: "", password: "", is_admin: false };

/**
 * Admins manage accounts here: create them, switch between admin and user, disable or enable
 * them, and set a new password. Regular users see a short note instead.
 */
export default function UsersPage() {
  const { token, me } = useAuth();
  const [users, setUsers] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [resetFor, setResetFor] = useState<Account | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch("/dashboard/api/users", { token });
      if (res.ok) setUsers((await res.json()) as Account[]);
      else toast.error(await errorMessage(res, "Could not load the users."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (me?.is_admin) load();
  }, [me, load]);

  async function update(user: Account, changes: Partial<Pick<Account, "is_admin" | "is_active">>) {
    const res = await apiFetch(`/dashboard/api/users/${user.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(changes),
    });
    if (!res.ok) {
      toast.error(await errorMessage(res, "Could not update the user."));
      return;
    }
    const updated = (await res.json()) as Account;
    setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
    toast.success(`Updated ${updated.username}.`);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiFetch("/dashboard/api/users", {
      method: "POST",
      token,
      body: JSON.stringify({ ...newUser, email: newUser.email || null }),
    });
    if (!res.ok) {
      toast.error(await errorMessage(res, "Could not create the user."));
      return;
    }
    const created = (await res.json()) as Account;
    setUsers((list) => [...list, created]);
    setNewUser(emptyNewUser);
    toast.success(`Created ${created.username}.`);
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    const res = await apiFetch(`/dashboard/api/users/${resetFor.id}/password`, {
      method: "POST",
      token,
      body: JSON.stringify({ new_password: resetPassword }),
    });
    if (!res.ok) {
      toast.error(await errorMessage(res, "Could not set the password."));
      return;
    }
    toast.success(`New password set for ${resetFor.username}.`);
    setResetFor(null);
    setResetPassword("");
  }

  if (me && !me.is_admin) {
    return (
      <div className="mx-5 rounded-xl border border-border bg-surface/50 p-6 text-sm text-text-muted">
        Only admins can manage users. You can change your own password on the Account page.
      </div>
    );
  }

  return (
    <div className="mx-5 space-y-6">
      <h2 className="text-2xl font-semibold text-text">Users</h2>

      <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted">Loading users…</td></tr>
            ) : (
              users.map((u) => {
                const self = u.id === me?.id;
                return (
                  <tr key={u.id} className="bg-background even:bg-surface/50" data-username={u.username}>
                    <td className="px-4 py-3 font-medium text-text">{u.username}{self && " (you)"}</td>
                    <td className="px-4 py-3 text-text-muted">{u.email || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${u.is_admin ? "bg-primary/15 text-primary" : "bg-surface text-text-muted"}`}>
                        {u.is_admin ? "admin" : "user"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${u.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {u.is_active ? "active" : "disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" className={buttonClass} disabled={self}
                          title={self ? "You can't change your own role" : undefined}
                          onClick={() => update(u, { is_admin: !u.is_admin })}>
                          {u.is_admin ? "Make user" : "Make admin"}
                        </button>
                        <button type="button" className={buttonClass} disabled={self}
                          title={self ? "You can't disable yourself" : undefined}
                          onClick={() => update(u, { is_active: !u.is_active })}>
                          {u.is_active ? "Disable" : "Enable"}
                        </button>
                        <button type="button" className={buttonClass} onClick={() => setResetFor(u)}>
                          Set password
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {resetFor && (
        <form onSubmit={submitReset}
          className="flex max-w-xl flex-wrap items-end gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
          <label className="flex-1 space-y-1 text-sm text-text">
            <span>New password for {resetFor.username}</span>
            <input type="password" required autoComplete="new-password" value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)} className={inputClass} />
          </label>
          <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
            Set password
          </button>
          <button type="button" className={buttonClass} onClick={() => setResetFor(null)}>Cancel</button>
        </form>
      )}

      <form onSubmit={create}
        className="max-w-xl space-y-3 rounded-xl border border-border bg-background p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">New user</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-text">
            <span>Username</span>
            <input required value={newUser.username} className={inputClass}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm text-text">
            <span>Email (optional)</span>
            <input type="email" value={newUser.email} className={inputClass}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm text-text">
            <span>Password</span>
            <input type="password" required autoComplete="new-password" value={newUser.password} className={inputClass}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-text">
            <input type="checkbox" checked={newUser.is_admin}
              onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })} />
            <span>Admin</span>
          </label>
        </div>
        <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
          Create user
        </button>
      </form>
    </div>
  );
}
