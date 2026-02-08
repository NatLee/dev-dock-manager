"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useFreePorts,
  usePortCheck,
  useNvdockerCheck,
  useRunContainer,
} from "@/hooks/useNewContainerForm";
import type { RunContainerBody } from "@/types/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const initialForm: RunContainerBody = {
  container_name: "",
  ssh: "",
  user: "",
  password: "",
  vnc_password: "",
  root_password: "",
  privileged: false,
  nvdocker: false,
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <label className="block text-xs font-medium text-text">{label}</label>
      {hint && <p className="text-[11px] text-text-muted">{hint}</p>}
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors";

export function NewContainerModal({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<RunContainerBody>(initialForm);
  const { freePorts, fetchPorts } = useFreePorts();
  const checkPort = usePortCheck();
  const { nvdockerAvailable, fetchNvdocker } = useNvdockerCheck();
  const { run, loading, error } = useRunContainer();

  useEffect(() => {
    if (open) {
      fetchPorts(2);
      fetchNvdocker();
    }
  }, [open, fetchPorts, fetchNvdocker]);

  useEffect(() => {
    if (open && freePorts.length > 0 && !form.ssh) {
      setForm((f) => ({ ...f, ssh: String(freePorts[0]) }));
    }
  }, [open, freePorts, form.ssh]);

  const handleChange = useCallback(
    (field: keyof RunContainerBody, value: string | boolean) => {
      setForm((f) => ({ ...f, [field]: value }));
    },
    []
  );

  const handleSshBlur = useCallback(() => {
    const port = parseInt(form.ssh, 10);
    if (isNaN(port) || port <= 0 || port >= 65535) return;
    checkPort(port).then((isUsed) => {
      if (isUsed) {
        toast.warning(`Port ${port} is already in use. Please choose another.`);
      }
    });
  }, [form.ssh, checkPort]);

  const pickSuggestedPort = useCallback(() => {
    if (freePorts.length > 0) {
      setForm((f) => ({ ...f, ssh: String(freePorts[0]) }));
    }
  }, [freePorts]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.container_name.trim()) {
        toast.error("Please enter a container name.");
        return;
      }
      if (form.container_name.length < 2) {
        toast.error("Container name must be at least 2 characters.");
        return;
      }
      if (!/^[a-zA-Z]/.test(form.container_name)) {
        toast.error("Container name must start with a letter.");
        return;
      }
      const port = parseInt(form.ssh, 10);
      if (isNaN(port) || port <= 0 || port >= 65535) {
        toast.error("Port must be between 1 and 65534.");
        return;
      }
      const result = await run(form);
      if (result) {
        setForm(initialForm);
        onClose();
        onSuccess?.();
      }
    },
    [form, run, onClose, onSuccess]
  );

  if (!open) return null;

  const nvdockerDisabled = nvdockerAvailable === false;
  const showNvdockerAlert = nvdockerAvailable === false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="new-container-title"
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border border-border bg-background shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-t-2xl border-b border-border bg-surface px-4 py-2.5">
          <h2 id="new-container-title" className="text-base font-semibold text-text">
            Create New Container
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-border hover:text-text focus:outline-none focus:ring-1 focus:ring-primary/20"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {showNvdockerAlert && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                Nvidia Docker is not available. Ensure you have an Nvidia GPU and the{" "}
                <a
                  href="https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html#installation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline hover:no-underline"
                >
                  Nvidia Container Toolkit
                </a>
                .
              </div>
            )}

            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Basics
              </h3>
              <Field
                label="Container Name"
                hint="Must start with a letter, at least 2 characters."
              >
                <input
                  type="text"
                  value={form.container_name}
                  onChange={(e) => handleChange("container_name", e.target.value)}
                  placeholder="e.g. dev-gui-01"
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="SSH Port" hint="Host port mapped to container SSH (1–65534).">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={form.ssh}
                    onChange={(e) => handleChange("ssh", e.target.value)}
                    onBlur={handleSshBlur}
                    placeholder="e.g. 2222"
                    min={1}
                    max={65534}
                    className={inputClass}
                    required
                  />
                  {freePorts.length > 0 && (
                    <button
                      type="button"
                      onClick={pickSuggestedPort}
                      className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-medium text-text transition-colors hover:bg-border focus:outline-none focus:ring-1 focus:ring-primary/20"
                    >
                      Use {freePorts[0]}
                    </button>
                  )}
                </div>
              </Field>
            </section>

            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Credentials
              </h3>
              <Field label="User">
                <input
                  type="text"
                  value={form.user}
                  onChange={(e) => handleChange("user", e.target.value)}
                  placeholder="Login user name"
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="User Password">
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  placeholder="Password for the user"
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="VNC Password">
                <input
                  type="password"
                  value={form.vnc_password}
                  onChange={(e) => handleChange("vnc_password", e.target.value)}
                  placeholder="NoVNC / VNC access"
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Root Password">
                <input
                  type="password"
                  value={form.root_password}
                  onChange={(e) => handleChange("root_password", e.target.value)}
                  placeholder="Root (sudo) password"
                  className={inputClass}
                  required
                />
              </Field>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Options
              </h3>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2 transition-colors hover:bg-surface focus-within:ring-1 focus-within:ring-primary/20">
                <input
                  type="checkbox"
                  checked={form.privileged}
                  onChange={(e) => handleChange("privileged", e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-xs font-medium text-text">Privileged mode</span>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 transition-colors focus-within:ring-1 focus-within:ring-primary/20 ${
                  nvdockerDisabled
                    ? "cursor-not-allowed bg-surface/30 opacity-75"
                    : "bg-surface/50 hover:bg-surface"
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.nvdocker}
                  disabled={nvdockerDisabled}
                  onChange={(e) => handleChange("nvdocker", e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary disabled:opacity-50"
                />
                <span className="text-xs font-medium text-text">
                  {nvdockerAvailable === false ? "Nvidia Docker (not available)" : "Nvidia Docker"}
                </span>
              </label>
            </section>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-200">
                {error}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? "Creating…" : "Create Container"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
