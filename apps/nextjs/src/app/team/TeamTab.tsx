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
  unassigned: ReviewTask[];
  people: ReviewPerson[];
  owners: Owner[];
  _meta: { nextMeeting: string; since: string };
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

function NamePicker({ owners, value, onPick, exclude, disabled }: { owners: Owner[]; value?: string; onPick: (id: string) => void; exclude?: string | null; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {owners
        .filter((o) => o.userId !== exclude)
        .map((o) => (
          <button key={o.userId} type="button" disabled={disabled} onClick={() => onPick(o.userId)} className={o.userId === value ? BTN_PICK : BTN_WHITE}>
            {o.userId === value && disabled ? `${first(o.name)}…` : first(o.name)}
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
      {!closed && t.hardDeadline && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d !== null && d < 0 ? "bg-red-50 text-red-700" : d !== null && d <= 1 ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-700"}`} title="Hard deadline: the owner gets one message the morning it's due">
        ⏱ {fmt(t.dueAt, { weekday: "short", day: "numeric", month: "short" })}
        </span>
      )}
      {!closed && !t.hardDeadline && d !== null && d >= 0 && d <= 1 && <span className="text-gray-600">{d === 0 ? "Today" : "Tomorrow"}</span>}
      {!closed && t.nudgeAt && (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700" title={`Message goes out ${t.nudgeSetBy === "rule" ? "by the rule (8am on the due day)" : `at a time set by ${t.nudgeSetBy === "person" ? "a founder" : t.nudgeSetBy}`}`}>
          🔔 {fmt(t.nudgeAt, { weekday: "short", day: "numeric", month: "short" })} {new Date(t.nudgeAt).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" })}{t.nudgeSetBy !== "rule" ? " · set" : ""}
        </span>
      )}
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
  const [nudgeLocal, setNudgeLocal] = useState("");
  const [picked, setPicked] = useState<string | undefined>();
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
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {thumb !== undefined && (
            <div className="h-11 w-11 flex-none overflow-hidden rounded-md bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- Blob URL, already a sized PNG */}
              {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {editing ? (
              <form
                className="flex w-full gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("edit", { title });
                }}
              >
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setTitle(t.title);
                      setEditing(false);
                    }
                  }}
                  className="w-full rounded-md border border-blue-400 px-3 py-1.5 text-base font-semibold text-gray-900 ring-2 ring-blue-100"
                />
                <button type="submit" className={BTN_WHITE} disabled={!!busy || !title.trim() || title === t.title}>Save</button>
                <button
                  type="button"
                  className={`${BTN} border-transparent text-gray-600 hover:bg-gray-100`}
                  onClick={() => {
                    setTitle(t.title);
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
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
              <button className={`${BTN_WHITE} flex-1 sm:flex-none`} disabled={!!busy} onClick={() => act("review")}>{busy === "review" ? "…" : "Not yet"}</button>
              <button className={`${more ? BTN_ACTIVE : BTN_WHITE} flex-1 sm:flex-none`} onClick={() => setMore(!more)}>More</button>
            </>
          )}
        </div>
      </div>
      {more && !closed && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className={sub === "move" ? BTN_ACTIVE : BTN_WHITE} onClick={() => setSub(sub === "move" ? "none" : "move")}>Change date</button>
            <button className={sub === "handoff" ? BTN_ACTIVE : BTN_WHITE} onClick={() => setSub(sub === "handoff" ? "none" : "handoff")}>Hand off</button>
            <button className={BTN_WHITE} disabled={!!busy} onClick={() => act("unassign", { text: "Unassigned at the meeting" })}>Unassign</button>
            <button className={`${BTN} border-transparent text-gray-700 hover:bg-gray-100`} disabled={!!busy} onClick={() => act("cancel", { text: "Dropped at the meeting" })}>Delete</button>
          </div>
          {sub === "move" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className={BTN_WHITE} onClick={() => act("set_deadline", { dueAt: at9am(ymd(new Date(nextMeeting))), text: "Moved at the meeting" })}>Next meeting</button>
              <button className={BTN_WHITE} onClick={() => act("set_deadline", { dueAt: at9am(plusDays(3)), text: "Moved at the meeting" })}>+3 days</button>
              <button className={BTN_WHITE} onClick={() => act("set_deadline", { dueAt: at9am(plusDays(7)), text: "Moved at the meeting" })}>+1 week</button>
              <input type="date" value={custom} onChange={(e) => setCustom(e.target.value)} onBlur={() => custom && act("set_deadline", { dueAt: at9am(custom), text: "Moved at the meeting" })} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm" />
              {t.dueAt && <button className={`${BTN} border-transparent text-gray-700 hover:bg-gray-100`} onClick={() => act("set_deadline", { dueAt: null, hardDeadline: false, text: "Date removed at the meeting" })}>No date</button>}
              <button className={`${BTN} border-transparent text-gray-700 hover:bg-gray-100`} disabled={!t.dueAt && !t.hardDeadline} onClick={() => act("set_deadline", { hardDeadline: !t.hardDeadline })}>{t.hardDeadline ? "Make soft" : "Make hard"}</button>
            </div>
          )}
          {sub === "move" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
              <span className="text-sm text-gray-600">Message at</span>
              <input type="datetime-local" value={nudgeLocal} onChange={(e) => setNudgeLocal(e.target.value)} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm" />
              <button className={BTN_WHITE} disabled={!nudgeLocal} onClick={() => act("set_deadline", { nudgeAt: new Date(nudgeLocal).toISOString(), text: "Nudge time set at the meeting" })}>Set</button>
              {t.nudgeSetBy && t.nudgeSetBy !== "rule" && <button className={`${BTN} border-transparent text-gray-700 hover:bg-gray-100`} onClick={() => act("set_deadline", { nudgeAt: null })}>Back to the rule</button>}
              <span className="text-xs text-gray-400">Rule: hard deadline → 8am on the due day; else no message. Checked every 5 min; one per person per day; quiet hours 9pm–8am.</span>
            </div>
          )}
          {sub === "handoff" && (
            <div className="mt-3">
              <NamePicker owners={owners} exclude={t.ownerId} value={picked} disabled={!!busy} onPick={(id) => { setPicked(id); void act("handoff", { newOwnerUserId: id, text: "Handed off at the meeting" }); }} />
            </div>
          )}
          <Meta t={t} />
        </div>
      )}
      {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
    </li>
  );
}

// --- unassigned backlog: assign or drop, nothing else ------------------------------------

function UnassignedRow({ t, owners, onChange }: { t: ReviewTask; owners: Owner[]; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setError(null);
    try {
      await post(`/api/agent/tasks/${t.id}`, { action, ...extra });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const ctx = (t.context ?? {}) as { suggestedOwnerId?: string | null; suggestedOwnerName?: string | null; quote?: string | null; meeting?: string | null };
  const suggested = ctx.suggestedOwnerId ? owners.find((o) => o.userId === ctx.suggestedOwnerId) : undefined;
  const assign = (id: string) => {
    setPicked(id);
    void act("handoff", { newOwnerUserId: id, text: "Assigned at the meeting" });
  };
  return (
    <li className={`border-t border-gray-100 px-5 py-4 first:border-t-0 transition-opacity ${busy ? "opacity-60" : ""}`}>
      {suggested && !busy && (
        <div className="mb-2 flex items-center gap-2">
          <button className={`${BTN} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`} onClick={() => assign(suggested.userId)}>
            Accept → {first(suggested.name)}
          </button>
          <span className="text-sm text-gray-500">suggested from {ctx.meeting ?? "the meeting"}</span>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-base font-semibold text-gray-900">
          {t.title}
          <span className="ml-2 text-sm font-normal text-gray-600">
            {busy && picked ? `Assigning to ${first(owners.find((o) => o.userId === picked)?.name ?? "")}…` : t.dueAt ? `Due ${fmt(t.dueAt)}` : "no date"}
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <NamePicker
            owners={owners}
            value={picked}
            disabled={busy}
            onPick={assign}
          />
          <button className={`${BTN} border-transparent text-gray-700 hover:bg-gray-100`} disabled={busy} onClick={() => act("cancel", { text: "Dropped at the meeting" })}>Delete</button>
        </div>
      </div>
      {(ctx.quote || (!suggested && ctx.suggestedOwnerName)) && (
        <div className="mt-1.5 text-sm text-gray-500">
          {ctx.quote ? `“${ctx.quote}”` : ""}
          {!suggested && ctx.suggestedOwnerName ? `${ctx.quote ? " · " : ""}mentioned: ${ctx.suggestedOwnerName}` : ""}
        </div>
      )}
      {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
    </li>
  );
}

// --- add an item (modal from the + in Unassigned) ------------------------------------------

function AddItemModal({ owners, onClose, onAdded }: { owners: Owner[]; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [due, setDue] = useState("");
  const [hard, setHard] = useState(false);
  const [nudge, setNudge] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await post("/api/agent/tasks", { tasks: [{ title: title.trim(), ownerUserId: ownerId || undefined, dueAt: due ? at9am(due) : null, hardDeadline: hard, nudgeAt: nudge ? new Date(nudge).toISOString() : null }] });
      setAdded((n) => n + 1);
      setTitle("");
      setHard(false);
      setNudge("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add an item</h3>
          {added > 0 && <span className="text-sm text-gray-500">{added} added</span>}
        </div>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing" className="w-full rounded-md border border-gray-200 px-3 py-2.5 text-base font-medium text-gray-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Owner <span className="font-normal normal-case tracking-normal">(none = unassigned)</span></div>
          <NamePicker owners={owners} value={ownerId} onPick={(id) => setOwnerId(ownerId === id ? "" : id)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-md border border-gray-200 px-3 py-2 text-sm" />
          <label className="flex items-center gap-1.5 text-sm text-gray-700"><input type="checkbox" checked={hard} onChange={(e) => setHard(e.target.checked)} disabled={!due} /> Hard deadline</label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600">Message at</span>
          <input type="datetime-local" value={nudge} onChange={(e) => setNudge(e.target.value)} className="rounded-md border border-gray-200 px-3 py-2 text-sm" />
          <span className="text-xs text-gray-400">optional; otherwise hard deadlines message at 8am on the day</span>
        </div>
        {error && <div className="text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_WHITE}>Close</button>
          <button type="submit" disabled={busy || !title.trim()} className={`${BTN_PICK} px-6`}>{busy ? "Adding…" : "Add"}</button>
        </div>
      </form>
    </div>
  );
}

// --- the tab -----------------------------------------------------------------------------

export function TeamTab() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
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
    // Live during the meeting: meeting drafts from Granola appear without a reload
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 20_000);
    return () => clearInterval(id);
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm text-gray-500">
        <span>Next meeting {fmt(data._meta.nextMeeting)}</span>
        <span aria-hidden>·</span>
        <span><span className="font-medium text-gray-700">{openTotal}</span> open</span>
        <span><span className="font-medium text-gray-700">{closedTotal}</span> closed</span>
        <span><span className={`font-medium ${carried ? "text-amber-700" : "text-gray-700"}`}>{carried}</span> carried</span>
        <button onClick={load} className="ml-auto text-gray-400 hover:text-gray-700" aria-label="Refresh" title="Refresh">↻</button>
      </div>

      {data.unassigned.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-white">
          <div className="flex items-center gap-3 px-5 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Unassigned</h3>
            <span className="text-sm text-gray-600">{data.unassigned.length} open</span>
            <button onClick={() => setAdding(true)} className={`${BTN_WHITE} ml-auto px-3`} aria-label="Add an item" title="Add an item">+</button>
          </div>
          <ul className="border-t border-gray-100">
            {data.unassigned.map((t) => (
              <UnassignedRow key={t.id} t={t} owners={data.owners} onChange={() => changed([t.id])} />
            ))}
          </ul>
        </section>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 px-5 py-3">
          <h3 className="text-base font-medium text-gray-400">Unassigned</h3>
          <span className="text-sm text-gray-400">Nothing open.</span>
          <button onClick={() => setAdding(true)} className={`${BTN_WHITE} ml-auto px-3`} aria-label="Add an item" title="Add an item">+</button>
        </div>
      )}

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

      {adding && <AddItemModal owners={data.owners} onClose={() => setAdding(false)} onAdded={load} />}

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
