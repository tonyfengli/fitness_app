"use client";

/**
 * The Monday review (BUSINESS-ACCOUNTABILITY.md → MVP), after the Claude Design frames of
 * Nov 10: header with open / closed / carried chips; a New items card (drafts: editable title,
 * source chip, owner as a row of names, remove; add form; Send creates them all at once, later
 * pre-filled by Granola); one block per founder with Done / Still on / More (Move, Hand off,
 * Drop, meta line); closed rows stay in place struck through with Undo. Desktop first, works on a phone.
 */

import { useCallback, useEffect, useState } from "react";

import type { ReviewPerson, ReviewTask } from "../api/agent/tasks/review/route";

interface Owner {
  userId: string;
  name: string;
}
interface ReviewData {
  people: ReviewPerson[];
  owners: Owner[];
  _meta: { nextMeeting: string; since: string };
}
interface Draft {
  key: string;
  title: string;
  ownerId: string;
  due: string; // YYYY-MM-DD or ""
  hard: boolean;
  source?: "granola";
}

const TZ = "America/Los_Angeles";
const fmt = (iso: string | null, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) => (iso ? new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, ...opts }) : "no date");
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const plusDays = (n: number) => ymd(new Date(Date.now() + n * 864e5));
const daysUntil = (iso: string | null) => (iso ? Math.ceil((Date.parse(iso) - Date.now()) / 864e5) : null);
const first = (name: string) => name.split(" ")[0] ?? name;
const OPEN = ["open", "in_progress", "blocked"];

/** ISO for 9am Pacific on a YYYY-MM-DD */
const at9am = (day: string) => {
  const noonUtc = new Date(`${day}T12:00:00Z`);
  const pacificHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(noonUtc)) % 24;
  return new Date(noonUtc.getTime() + (9 - pacificHour) * 36e5).toISOString();
};

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string; reason?: string; message?: string };
  if (!res.ok) throw new Error(data.reason ?? data.error ?? data.message ?? `HTTP ${res.status}`);
  return data;
}

// --- small pieces ---------------------------------------------------------------

const BTN = "rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50";
const BTN_WHITE = `${BTN} border-gray-200 bg-white text-gray-900 hover:bg-gray-50`;
const BTN_DONE = `${BTN} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`;
const BTN_ACTIVE = `${BTN} border-blue-300 bg-blue-50 text-blue-700`;
const BTN_PICK = `${BTN} border-blue-600 bg-blue-600 text-white`;

function Chip({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-lg bg-gray-100 px-3 py-2">
      <span className="text-lg font-semibold tabular-nums text-gray-900">{n}</span>
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  );
}

function NamePicker({ owners, value, onPick, exclude }: { owners: Owner[]; value?: string; onPick: (id: string) => void; exclude?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {owners
        .filter((o) => o.userId !== exclude)
        .map((o) => (
          <button key={o.userId} type="button" onClick={() => onPick(o.userId)} className={o.userId === value ? BTN_PICK : BTN_WHITE}>
            {first(o.name)}
          </button>
        ))}
    </div>
  );
}

function Tags({ t }: { t: ReviewTask }) {
  const d = daysUntil(t.dueAt);
  const closed = !OPEN.includes(t.status);
  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-2 align-middle text-sm">
      {!closed && d !== null && d < 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>}
      {!closed && t.hardDeadline && <span className="text-gray-600">Hard deadline{d !== null && d >= 0 && d <= 1 ? ` · ${d === 0 ? "today" : "tomorrow"}` : ""}</span>}
      {!closed && !t.hardDeadline && d !== null && d >= 0 && d <= 1 && <span className="text-gray-600">{d === 0 ? "Today" : "Tomorrow"}</span>}
      {t.status === "blocked" && <span className="text-gray-600">Blocked</span>}
      {t.carryOvers > 0 && <span className="font-semibold text-gray-900">×{t.carryOvers}</span>}
    </span>
  );
}

function Meta({ t }: { t: ReviewTask }) {
  const parts = [`Due ${fmt(t.dueAt)}`, `${t.daysOpen} days`, t.nudges ? `${t.nudges} nudge${t.nudges === 1 ? "" : "s"}` : ""].filter(Boolean);
  return (
    <div className="mt-3 space-y-1 text-sm text-gray-600">
      {t.blockedReason && <div className="font-medium text-gray-800">Blocked: {t.blockedReason}</div>}
      <div>
        {parts.join(" · ")}
        {t.lastReply ? ` · “${t.lastReply.text.slice(0, 160)}” (${fmt(t.lastReply.at, { day: "numeric", month: "short" })})` : ""}
      </div>
    </div>
  );
}

// --- a task row -------------------------------------------------------------------

function Row({ t, owners, nextMeeting, onChange, thumb }: { t: ReviewTask; owners: Owner[]; nextMeeting: string; onChange: () => void; thumb?: string | null }) {
  const [more, setMore] = useState(false);
  const [sub, setSub] = useState<"none" | "move" | "handoff">("none");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const closed = !OPEN.includes(t.status);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    setError(null);
    try {
      await post(`/api/agent/tasks/${t.id}`, { action, ...extra });
      setMore(false);
      setSub("none");
      setEditing(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="border-t border-gray-100 px-5 py-4 first:border-t-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {thumb !== undefined && (
            <div className="h-11 w-11 flex-none overflow-hidden rounded-md bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- Blob URL, already a sized PNG */}
              {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
            </div>
          )}
          <div className="min-w-0">
            {editing ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("edit", { title });
                }}
              >
                <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-blue-400 px-3 py-1.5 text-base font-semibold text-gray-900 ring-2 ring-blue-100" />
                <button type="submit" className={BTN_WHITE} disabled={!!busy}>Save</button>
              </form>
            ) : (
              <span className={`text-base font-semibold ${closed ? "text-gray-500 line-through" : "text-gray-900"}`}>
                <button type="button" className="text-left" onClick={() => !closed && setEditing(true)} title={closed ? undefined : "Click to edit"}>
                  {t.title}
                </button>
                <Tags t={t} />
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-none gap-2">
          {closed ? (
            <button className={BTN_WHITE} disabled={!!busy} onClick={() => act("reopen")}>{busy ? "…" : "Undo"}</button>
          ) : (
            <>
              <button className={`${BTN_DONE} flex-1 sm:flex-none sm:px-5`} disabled={!!busy} onClick={() => act("complete")}>{busy === "complete" ? "…" : "Done"}</button>
              <button className={`${BTN_WHITE} flex-1 sm:flex-none`} disabled={!!busy} onClick={() => act("review")}>{busy === "review" ? "…" : "Still on"}</button>
              <button className={`${more ? BTN_ACTIVE : BTN_WHITE} flex-1 sm:flex-none`} onClick={() => setMore(!more)}>More</button>
            </>
          )}
        </div>
      </div>
      {more && !closed && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {t.hardDeadline ? (
              <span className={`${BTN} cursor-default border-transparent text-gray-400`} title="This deadline can't move">Move</span>
            ) : (
              <button className={sub === "move" ? BTN_ACTIVE : BTN_WHITE} onClick={() => setSub(sub === "move" ? "none" : "move")}>Move</button>
            )}
            <button className={sub === "handoff" ? BTN_ACTIVE : BTN_WHITE} onClick={() => setSub(sub === "handoff" ? "none" : "handoff")}>Hand off</button>
            <button className={`${BTN} border-transparent text-gray-700 hover:bg-gray-100`} disabled={!!busy} onClick={() => act("cancel", { text: "Dropped at the meeting" })}>Drop</button>
          </div>
          {sub === "move" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className={BTN_WHITE} onClick={() => act("move", { dueAt: at9am(ymd(new Date(nextMeeting))), text: "Moved at the meeting" })}>Next meeting</button>
              <button className={BTN_WHITE} onClick={() => act("move", { dueAt: at9am(plusDays(3)), text: "Moved at the meeting" })}>+3 days</button>
              <button className={BTN_WHITE} onClick={() => act("move", { dueAt: at9am(plusDays(7)), text: "Moved at the meeting" })}>+1 week</button>
              <input type="date" value={custom} onChange={(e) => setCustom(e.target.value)} onBlur={() => custom && act("move", { dueAt: at9am(custom), text: "Moved at the meeting" })} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm" />
            </div>
          )}
          {sub === "handoff" && (
            <div className="mt-3">
              <NamePicker owners={owners} exclude={t.ownerId} onPick={(id) => act("handoff", { newOwnerUserId: id, text: "Handed off at the meeting" })} />
            </div>
          )}
          <Meta t={t} />
        </div>
      )}
      {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
    </li>
  );
}

// --- new items -------------------------------------------------------------------------

function NewItems({ owners, drafts, setDrafts, onSent }: { owners: Owner[]; drafts: Draft[]; setDrafts: (d: Draft[]) => void; onSent: () => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [hard, setHard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (key: string, patch: Partial<Draft>) => setDrafts(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setDrafts([...drafts, { key: `${Date.now()}`, title: title.trim(), ownerId: "", due, hard }]);
    setTitle("");
    setHard(false);
  };
  const ready = drafts.filter((d) => d.title.trim() && d.ownerId);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await post("/api/agent/tasks", { tasks: ready.map((d) => ({ title: d.title.trim(), ownerUserId: d.ownerId, dueAt: d.due ? at9am(d.due) : null, hardDeadline: d.hard })) });
      setDrafts(drafts.filter((d) => !ready.includes(d)));
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-4">
        <h3 className="text-lg font-semibold text-gray-900">New items</h3>
        {drafts.length > 0 && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{drafts.length}</span>}
        {ready.length > 0 && (
          <button onClick={send} disabled={busy} className={`${BTN_PICK} ml-auto`}>{busy ? "Sending…" : `Send ${ready.length} item${ready.length === 1 ? "" : "s"}`}</button>
        )}
      </div>
      {drafts.length > 0 && (
        <ul className="space-y-2 border-t border-gray-100 px-5 py-4">
          {drafts.map((d) => (
            <li key={d.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input value={d.title} onChange={(e) => update(d.key, { title: e.target.value })} className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-base font-semibold text-gray-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              {d.source === "granola" && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Granola</span>}
              <div className="flex items-center gap-2">
                <NamePicker owners={owners} value={d.ownerId} onPick={(id) => update(d.key, { ownerId: id })} />
                <input type="date" value={d.due} onChange={(e) => update(d.key, { due: e.target.value })} className="rounded-md border border-gray-200 px-2 py-2 text-sm" title="Due" />
                <button type="button" onClick={() => setDrafts(drafts.filter((x) => x.key !== d.key))} className="px-2 text-lg text-gray-400 hover:text-gray-700" aria-label="Remove">×</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:grid-cols-[1fr_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add an item" className="rounded-md border border-gray-200 bg-white px-3 py-2.5 text-base" />
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm" />
          <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="checkbox" checked={hard} onChange={(e) => setHard(e.target.checked)} /> Hard deadline</label>
          <button type="submit" disabled={!title.trim()} className={`${BTN_WHITE} sm:px-8`}>Add</button>
        </div>
      </form>
      {error && <div className="px-5 pb-3 text-sm text-red-700">{error}</div>}
    </section>
  );
}

// --- the tab -----------------------------------------------------------------------------

export function TeamTab() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set()); // closed during this review: stay in place with Undo
  const load = useCallback(() => {
    fetch("/api/agent/tasks/review")
      .then(async (res) => {
        const body = (await res.json()) as ReviewData & { error?: string; message?: string };
        if (!res.ok) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
        setData(body);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const changed = (ids: string[]) => {
    setTouched((prev) => new Set([...prev, ...ids]));
    load();
  };

  if (error) return <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;
  if (!data) return <div className="mt-6 py-12 text-center text-gray-500">Loading the review…</div>;

  const openTotal = data.people.reduce((n, p) => n + p.open.length, 0);
  const closedTotal = data.people.reduce((n, p) => n + p.closedThisWeek.length, 0);
  const carried = data.people.reduce((n, p) => n + p.carryOvers, 0);

  return (
    <div className="mt-6 space-y-4">
      <header className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4">
        <h2 className="text-2xl font-bold text-gray-900">Monday review</h2>
        <span className="text-sm text-gray-600">Next: {fmt(data._meta.nextMeeting)}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Chip n={openTotal} label="open" />
          <Chip n={closedTotal} label="closed" />
          <Chip n={carried} label="carried" />
          <button onClick={load} className={BTN_WHITE} aria-label="Refresh" title="Refresh">↻</button>
        </div>
      </header>

      <NewItems owners={data.owners} drafts={drafts} setDrafts={setDrafts} onSent={load} />

      {data.people.map((p) => {
        const stuck = p.closedThisWeek.filter((t) => touched.has(t.id));
        return (
          <section key={p.userId} className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-baseline gap-3 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">{first(p.name)}</h3>
              <span className="text-sm text-gray-600">{p.open.length ? `${p.open.length} open` : "Nothing open."}</span>
              {p.carryOvers > 0 && <span className="text-sm text-gray-600">{p.carryOvers} carried</span>}
            </div>
            {(p.open.length > 0 || stuck.length > 0) && (
              <ul className="border-t border-gray-100">
                {p.open.map((t) => {
                  const image = typeof t.context?.imageUrl === "string" ? t.context.imageUrl : null;
                  return <Row key={t.id} t={t} owners={data.owners} nextMeeting={data._meta.nextMeeting} onChange={() => changed([t.id])} thumb={t.source === "celebrations" ? image : undefined} />;
                })}
                {stuck.map((t) => (
                  <Row key={t.id} t={t} owners={data.owners} nextMeeting={data._meta.nextMeeting} onChange={() => changed([t.id])} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {/* Intake happens at the end of the meeting too: the same drafts list, bottom of the page */}
      {data.people.length > 0 && <NewItems owners={data.owners} drafts={drafts} setDrafts={setDrafts} onSent={load} />}

      {closedTotal > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white">
          <button onClick={() => setShowClosed(!showClosed)} className="flex w-full items-center gap-2 px-5 py-4 text-left text-sm font-medium text-gray-900">
            <span className="text-gray-500">{showClosed ? "▾" : "▸"}</span> Closed since last Monday ({closedTotal})
          </button>
          {showClosed && (
            <ul className="border-t border-gray-100">
              {data.people.flatMap((p) => p.closedThisWeek.filter((t) => !touched.has(t.id)).map((t) => <Row key={t.id} t={t} owners={data.owners} nextMeeting={data._meta.nextMeeting} onChange={() => changed([t.id])} />))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
