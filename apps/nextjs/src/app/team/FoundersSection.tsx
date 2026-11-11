"use client";

/**
 * What the Chief of Staff knows about each founder (business only): four summary fields any
 * founder can edit in place, dated notes with their source, and "New from the Chief this
 * week" so every note it added is seen. Retiring a note keeps it in the record but out of
 * the Chief's view. Lives at the bottom of the Team tab.
 */

import { useCallback, useEffect, useState } from "react";

import type { Profile } from "~/lib/team/profile";

interface RecentNote {
  id: string;
  userId: string;
  name: string;
  kind: string;
  text: string;
  traceId: string | null;
  createdAt: string;
  retiredAt: string | null;
}

const FIELDS: { key: "role" | "owns" | "answerStyle" | "focus"; label: string; hint: string }[] = [
  { key: "role", label: "Role", hint: "Co-founder, runs in-gym coaching" },
  { key: "owns", label: "Owns", hint: "Areas and recurring responsibilities" },
  { key: "answerStyle", label: "Likes answers", hint: "Numbers first, short, the why…" },
  { key: "focus", label: "Current focus", hint: "What they're chasing right now" },
];

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "America/Los_Angeles", day: "numeric", month: "short" });
const first = (name: string) => name.split(" ")[0] ?? name;

async function post(body: unknown) {
  const res = await fetch("/api/agent/team/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string; reason?: string; message?: string };
  if (!res.ok) throw new Error(data.reason ?? data.error ?? data.message ?? `HTTP ${res.status}`);
  return data;
}

function Field({ p, f, onSaved }: { p: Profile; f: (typeof FIELDS)[number]; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(p[f.key] ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await post({ userId: p.userId, action: "set", [f.key]: value });
      setEditing(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="text-sm">
      <span className="text-gray-500">{f.label}: </span>
      {editing ? (
        <span className="inline-flex w-full gap-2">
          <input
            autoFocus
            value={value}
            placeholder={f.hint}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setValue(p[f.key] ?? "");
                setEditing(false);
              }
              if (e.key === "Enter") void save();
            }}
            className="flex-1 rounded-md border border-blue-400 px-2 py-1 text-sm ring-2 ring-blue-100"
          />
          <button className="text-sm text-gray-700" disabled={busy} onClick={save}>Save</button>
        </span>
      ) : (
        <button className={`text-left ${p[f.key] ? "text-gray-900" : "text-gray-400"} hover:underline decoration-dotted`} onClick={() => setEditing(true)}>
          {p[f.key] ?? "add…"}
        </button>
      )}
    </div>
  );
}

function ProfileCard({ p, onChange }: { p: Profile; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await post({ userId: p.userId, action: "note", kind: "fact", text });
      setText("");
      onChange();
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="border-t border-gray-100 first:border-t-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-baseline gap-3 px-5 py-3 text-left">
        <span className="text-base font-semibold text-gray-900">{first(p.name)}</span>
        <span className="truncate text-sm text-gray-500">{p.role ?? "no role yet"} · {p.notes.length} note{p.notes.length === 1 ? "" : "s"}</span>
        <span className="ml-auto text-sm text-gray-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-gray-100 bg-gray-50/60 px-5 py-4">
          <div className="space-y-1.5">
            {FIELDS.map((f) => (
              <Field key={f.key} p={p} f={f} onSaved={onChange} />
            ))}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Messages per day:</span>
              <select
                value={p.dailyMessageLimit ?? ""}
                onChange={async (e) => {
                  await post({ userId: p.userId, action: "set", dailyMessageLimit: e.target.value ? Number(e.target.value) : null });
                  onChange();
                }}
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm"
              >
                <option value="">No limit</option>
                {[1, 2, 3, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <ul className="space-y-1.5">
            {p.notes.map((n) => (
              <li key={n.id} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 rounded bg-gray-100 px-1.5 text-xs text-gray-600">{n.kind}</span>
                <span className="flex-1 text-gray-800">
                  {n.text} <span className="text-gray-400">· {n.source === "agent" ? "Chief" : (n.author ?? "founder")} · {day(n.createdAt)}</span>
                </span>
                <button
                  className="text-gray-400 hover:text-gray-700"
                  title="Retire this note"
                  onClick={async () => {
                    await post({ userId: p.userId, action: "retire", noteId: n.id });
                    onChange();
                  }}
                >
                  ×
                </button>
              </li>
            ))}
            {!p.notes.length && <li className="text-sm text-gray-400">No notes yet.</li>}
          </ul>
          <form onSubmit={addNote} className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note the Chief should know" className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm" />
            <button type="submit" disabled={busy || !text.trim()} className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50">Add</button>
          </form>
        </div>
      )}
    </li>
  );
}

export function FoundersSection() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [recent, setRecent] = useState<RecentNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    Promise.all([fetch("/api/agent/team/profile").then((r) => r.json()), fetch("/api/agent/team/profile?recent=7").then((r) => r.json())])
      .then(([a, b]: [{ profiles?: Profile[]; error?: string }, { notes?: RecentNote[] }]) => {
        if (a.error) throw new Error(a.error);
        setProfiles(a.profiles ?? []);
        setRecent(b.notes ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!profiles) return null;
  const fresh = recent.filter((n) => !n.retiredAt);
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-baseline gap-3 px-5 py-4">
        <h3 className="text-lg font-semibold text-gray-900">Founders</h3>
        <span className="text-sm text-gray-500">what the Chief of Staff knows about working with each of us</span>
      </div>
      {fresh.length > 0 && (
        <div className="border-t border-gray-100 bg-amber-50/50 px-5 py-3 text-sm">
          <div className="mb-1 font-medium text-amber-900">New from the Chief this week ({fresh.length})</div>
          <ul className="space-y-1">
            {fresh.map((n) => (
              <li key={n.id} className="flex items-start gap-2 text-gray-800">
                <span className="text-gray-500">{first(n.name)}:</span>
                <span className="flex-1">
                  {n.text} <span className="text-gray-400">· {day(n.createdAt)}</span>
                </span>
                <button
                  className="text-gray-400 hover:text-gray-700"
                  title="Retire"
                  onClick={async () => {
                    await post({ userId: n.userId, action: "retire", noteId: n.id });
                    load();
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="border-t border-gray-100">
        {profiles.map((p) => (
          <ProfileCard key={p.userId} p={p} onChange={load} />
        ))}
      </ul>
    </section>
  );
}
