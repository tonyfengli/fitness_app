"use client";

/**
 * The Monday review (BUSINESS-ACCOUNTABILITY.md → MVP). One block per founder with their open
 * items; for each: Done / Still on / Move / Drop / Hand off, plus inline edit of the title.
 * Carry-over counts are the failure signal ("items keep carrying over"). Add new items at the
 * bottom (Granola will pre-fill this later). Built for Tony driving on a laptop; works on a phone.
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

const pacific = (iso: string | null, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", ...opts }) : "no date";

const daysUntil = (iso: string | null) => (iso ? Math.ceil((Date.parse(iso) - Date.now()) / 864e5) : null);

function dueLabel(t: ReviewTask) {
  const d = daysUntil(t.dueAt);
  if (d === null) return "no date";
  if (d < 0) return `${-d}d overdue`;
  if (d === 0) return "due today";
  return `due ${pacific(t.dueAt)}`;
}

/** ISO for 9am Pacific on a YYYY-MM-DD */
const at9amPacific = (ymd: string) => {
  const noonUtc = new Date(`${ymd}T12:00:00Z`);
  const pacificHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false }).format(noonUtc)) % 24;
  return new Date(noonUtc.getTime() + (9 - pacificHour) * 36e5).toISOString();
};
const ymdPacific = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const plusDays = (n: number) => ymdPacific(new Date(Date.now() + n * 864e5));

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string; reason?: string; message?: string };
  if (!res.ok) throw new Error(data.reason ?? data.error ?? data.message ?? `HTTP ${res.status}`);
  return data;
}

const btn = "px-2.5 py-1.5 text-sm rounded border disabled:opacity-50";
const btnGray = `${btn} border-gray-300 text-gray-700 hover:bg-gray-50`;

function MovePicker({ task, onPick, onClose, nextMeeting }: { task: ReviewTask; onPick: (iso: string) => void; onClose: () => void; nextMeeting: string }) {
  const [custom, setCustom] = useState("");
  const nextMeetingYmd = ymdPacific(new Date(nextMeeting));
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2">
      {task.hardDeadline ? (
        <span className="text-sm text-red-700">This deadline can&apos;t move.</span>
      ) : (
        <>
          <button className={btnGray} onClick={() => onPick(at9amPacific(nextMeetingYmd))}>Next meeting ({pacific(nextMeeting, { month: "short", day: "numeric" })})</button>
          <button className={btnGray} onClick={() => onPick(at9amPacific(plusDays(3)))}>+3 days</button>
          <button className={btnGray} onClick={() => onPick(at9amPacific(plusDays(7)))}>+1 week</button>
          <input type="date" value={custom} onChange={(e) => setCustom(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm" />
          <button className={btnGray} disabled={!custom} onClick={() => custom && onPick(at9amPacific(custom))}>Set</button>
        </>
      )}
      <button className="ml-auto text-sm text-gray-500 hover:text-gray-800" onClick={onClose}>Cancel</button>
    </div>
  );
}

function TaskRow({ task, owners, nextMeeting, onChange }: { task: ReviewTask; owners: Owner[]; nextMeeting: string; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "move" | "handoff" | "edit">("none");
  const [title, setTitle] = useState(task.title);
  const [error, setError] = useState<string | null>(null);
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    setError(null);
    try {
      await post(`/api/agent/tasks/${task.id}`, { action, ...extra });
      setMode("none");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };
  const d = daysUntil(task.dueAt);
  const dueTone = d !== null && d < 0 ? "text-red-700" : d !== null && d <= 1 ? "text-amber-700" : "text-gray-600";
  const closed = !["open", "in_progress", "blocked"].includes(task.status);
  const card = task.context && typeof task.context.imageUrl === "string" ? task.context.imageUrl : null;
  return (
    <li className={`rounded-lg border bg-white p-3 ${closed ? "border-gray-100 opacity-70" : task.carryOvers >= 2 ? "border-amber-300" : "border-gray-200"}`}>
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- Blob URL, already a sized PNG */}
        {card && <img src={card} alt="" className="h-12 w-12 rounded object-cover flex-none" />}
        <div className="min-w-0 flex-1">
          {mode === "edit" ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void act("edit", { title });
              }}
            >
              <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
              <button className={btnGray} type="submit" disabled={!!busy}>Save</button>
              <button className="text-sm text-gray-500" type="button" onClick={() => setMode("none")}>Cancel</button>
            </form>
          ) : (
            <button className="text-left font-medium text-gray-900 hover:underline decoration-dotted" title="Click to edit" onClick={() => !closed && setMode("edit")}>
              {task.title}
            </button>
          )}
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            <span className={dueTone}>{dueLabel(task)}{task.hardDeadline ? " · hard deadline" : ""}</span>
            {task.status === "blocked" && <span className="text-amber-700">blocked{task.blockedReason ? `: ${task.blockedReason}` : ""}</span>}
            {task.status === "in_progress" && <span className="text-gray-500">in progress</span>}
            {closed && <span className="text-gray-500">{task.status}{task.completedAt ? ` ${pacific(task.completedAt)}` : ""}</span>}
            {task.carryOvers > 0 && <span className="rounded bg-amber-100 px-1.5 text-amber-800">carried over ×{task.carryOvers}</span>}
            {task.nudges > 0 && <span className="text-gray-500">{task.nudges} nudge{task.nudges === 1 ? "" : "s"}</span>}
            <span className="text-gray-400">{task.daysOpen}d open · {task.source}</span>
          </div>
          {task.lastReply && (
            <div className="mt-1 text-xs text-gray-600">
              <span className="text-gray-400">{pacific(task.lastReply.at, { month: "short", day: "numeric" })} ·</span> &ldquo;{task.lastReply.text.slice(0, 140)}&rdquo;
            </div>
          )}
          {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
        </div>
      </div>
      {!closed && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={`${btn} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`} disabled={!!busy} onClick={() => act("complete")}>{busy === "complete" ? "…" : "Done"}</button>
          <button className={btnGray} disabled={!!busy} onClick={() => act("review")}>{busy === "review" ? "…" : "Still on"}</button>
          <button className={btnGray} disabled={!!busy} onClick={() => setMode(mode === "move" ? "none" : "move")}>Move</button>
          <button className={btnGray} disabled={!!busy} onClick={() => setMode(mode === "handoff" ? "none" : "handoff")}>Hand off</button>
          <button className={`${btn} border-gray-300 text-gray-500 hover:bg-gray-50 ml-auto`} disabled={!!busy} onClick={() => confirm(`Drop "${task.title}"?`) && act("cancel", { text: "Dropped at the meeting" })}>Drop</button>
        </div>
      )}
      {mode === "move" && <MovePicker task={task} nextMeeting={nextMeeting} onPick={(iso) => act("move", { dueAt: iso, text: "Moved at the meeting" })} onClose={() => setMode("none")} />}
      {mode === "handoff" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2">
          {owners.filter((o) => o.userId !== task.ownerId).map((o) => (
            <button key={o.userId} className={btnGray} onClick={() => act("handoff", { newOwnerUserId: o.userId, text: "Handed off at the meeting" })}>{o.name.split(" ")[0]}</button>
          ))}
          <button className="ml-auto text-sm text-gray-500 hover:text-gray-800" onClick={() => setMode("none")}>Cancel</button>
        </div>
      )}
    </li>
  );
}

function AddTasks({ owners, onAdded }: { owners: Owner[]; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState(owners[0]?.userId ?? "");
  const [due, setDue] = useState(plusDays(7));
  const [hard, setHard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!ownerId && owners[0]) setOwnerId(owners[0].userId);
  }, [owners, ownerId]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !ownerId) return;
    setBusy(true);
    setError(null);
    try {
      await post("/api/agent/tasks", { tasks: [{ title, ownerUserId: ownerId, dueAt: due ? at9amPacific(due) : null, hardDeadline: hard }] });
      setTitle("");
      setHard(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="rounded-lg border border-dashed border-gray-300 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Add an item</div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What, for whom, by when" className="flex-1 min-w-[200px] rounded border border-gray-300 px-2 py-1.5 text-sm" />
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
          {owners.map((o) => (
            <option key={o.userId} value={o.userId}>{o.name}</option>
          ))}
        </select>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={hard} onChange={(e) => setHard(e.target.checked)} /> hard deadline
        </label>
        <button type="submit" disabled={busy || !title.trim()} className={`${btn} border-gray-900 bg-gray-900 text-white hover:bg-black`}>{busy ? "Adding…" : "Add"}</button>
      </div>
      <div className="mt-1 text-xs text-gray-500">Hard deadline = the owner gets one message the morning it&apos;s due; everything else waits for next Monday.</div>
      {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
    </form>
  );
}

export function TeamTab() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
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

  if (error) return <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;
  if (!data) return <div className="mt-6 py-12 text-center text-gray-500">Loading the review…</div>;

  const openTotal = data.people.reduce((n, p) => n + p.open.length, 0);
  const carryTotal = data.people.reduce((n, p) => n + p.carryOvers, 0);
  const closedTotal = data.people.reduce((n, p) => n + p.closedThisWeek.length, 0);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Monday review</h2>
          <p className="text-sm text-gray-500">
            Next meeting {pacific(data._meta.nextMeeting, { weekday: "long", month: "short", day: "numeric" })} 7pm · {openTotal} open · {closedTotal} closed since last Monday ·{" "}
            <span className={carryTotal ? "text-amber-700" : ""}>{carryTotal} carry-over{carryTotal === 1 ? "" : "s"}</span>
          </p>
        </div>
        <button onClick={load} className="text-sm font-medium text-gray-700 hover:text-gray-900">Refresh</button>
      </div>

      <div className="mt-4 space-y-6">
        {data.people.map((p) => (
          <section key={p.userId}>
            <h3 className="mb-2 flex items-baseline gap-2 text-base font-semibold text-gray-900">
              {p.name}
              <span className="text-sm font-normal text-gray-500">{p.open.length} open{p.carryOvers ? ` · ${p.carryOvers} carried over` : ""}</span>
            </h3>
            {p.open.length ? (
              <ul className="space-y-2">
                {p.open.map((t) => (
                  <TaskRow key={t.id} task={t} owners={data.owners} nextMeeting={data._meta.nextMeeting} onChange={load} />
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-400">Nothing open.</div>
            )}
          </section>
        ))}
      </div>

      {closedTotal > 0 && (
        <section className="mt-6">
          <button onClick={() => setShowClosed(!showClosed)} className="text-sm font-medium text-gray-700 hover:text-gray-900">
            {showClosed ? "▾" : "▸"} Closed since last Monday ({closedTotal})
          </button>
          {showClosed && (
            <ul className="mt-2 space-y-2">
              {data.people.flatMap((p) => p.closedThisWeek.map((t) => <TaskRow key={t.id} task={t} owners={data.owners} nextMeeting={data._meta.nextMeeting} onChange={load} />))}
            </ul>
          )}
        </section>
      )}

      <div className="mt-8">
        <AddTasks owners={data.owners} onAdded={load} />
      </div>
    </div>
  );
}
