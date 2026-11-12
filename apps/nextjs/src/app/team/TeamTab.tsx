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
  closedUnassigned?: ReviewTask[];
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

/** One pill for a task's timing: the hard deadline (⏱) and when its message goes out (🔔) */
function TimePill({ t, d }: { t: ReviewTask; d: number | null }) {
  const tone = t.hardDeadline ? (d !== null && d < 0 ? "bg-red-50 text-red-700" : d !== null && d <= 1 ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-700") : "bg-blue-50 text-blue-700";
  const day = (iso: string) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  const sameDay = t.dueAt && t.nudgeAt && day(t.dueAt) === day(t.nudgeAt);
  const sent = t.nudgeAt && Date.parse(t.nudgeAt) <= Date.now() && t.nudges > 0;
  const bell = t.nudgeAt ? (sent ? "sent" : t.hardDeadline && sameDay ? time(t.nudgeAt) : `${day(t.nudgeAt)}, ${time(t.nudgeAt)}`) : null;
  const title = [
    t.hardDeadline && t.dueAt ? `Hard deadline ${day(t.dueAt)}` : null,
    t.nudgeAt ? `Reminder ${sent ? "sent" : "goes out"} ${day(t.nudgeAt)} ${time(t.nudgeAt)} (${t.nudgeSetBy === "rule" ? "by the rule: 8am on the due day" : `set by ${t.nudgeSetBy === "person" ? "a founder" : t.nudgeSetBy}`})` : null,
  ].filter(Boolean).join(" · ");
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`} title={title}>
      {t.hardDeadline && t.dueAt && <span>⏱ {day(t.dueAt)}</span>}
      {t.hardDeadline && t.dueAt && bell && <span className="opacity-40" aria-hidden>|</span>}
      {bell && <span className={sent ? "opacity-60" : ""}>🔔 {bell}</span>}
    </span>
  );
}

function Tags({ t }: { t: ReviewTask }) {
  const d = daysUntil(t.dueAt);
  const closed = !OPEN.includes(t.status);
  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-2 align-middle text-sm">
      {!closed && d !== null && d < 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>}
      {!closed && (t.hardDeadline || t.nudgeAt) && <TimePill t={t} d={d} />}
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

function Row({ t, owners, nextMeeting, onChange, image, ownerLabel, later }: { t: ReviewTask; owners: Owner[]; nextMeeting: string; onChange: (stay: boolean) => void; image?: string | null; ownerLabel?: string; later?: boolean }) {
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
      onChange(action !== "cancel"); // Done stays in place with Undo; Close goes straight to Closed
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
                  className="w-full rounded-md border border-blue-400 px-3 py-1.5 text-[15px] text-gray-900 ring-2 ring-blue-100"
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
              <span className={`text-[15px] leading-6 ${closed ? "text-gray-400" : "text-gray-800"}`}>
                {ownerLabel && <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{ownerLabel}</span>}
                {closed && <span className={`mr-2 text-xs font-medium ${t.status === "done" ? "text-emerald-600" : "text-gray-400"}`}>{t.status === "done" ? "✓ Done" : "Closed"}</span>}
                <button type="button" className={`text-left ${closed ? "line-through decoration-gray-300" : "hover:text-gray-950"}`} onClick={() => !closed && setEditing(true)} title={closed ? undefined : "Click to edit"}>
                  {t.title}
                </button>
                <Tags t={t} />
                {image && !closed && (
                  <button
                    type="button"
                    onClick={() => setMore(!more)}
                    className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 align-middle text-xs font-medium text-violet-700 hover:bg-violet-100"
                    title={more ? "Hide the image" : "Show the image"}
                  >
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                      <rect x="2" y="3" width="12" height="10" rx="1.5" />
                      <circle cx="6" cy="6.5" r="1.2" />
                      <path d="m3 12 3.5-3.5 2.5 2.5 2-2 2 2" />
                    </svg>
                    Image
                  </button>
                )}
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
              {!later && <button className={`${BTN_WHITE} flex-1 sm:flex-none`} disabled={!!busy} onClick={() => act("review")}>{busy === "review" ? "…" : "Not yet"}</button>}
              <button className={`${more ? BTN_ACTIVE : BTN_WHITE} flex-1 sm:flex-none`} onClick={() => setMore(!more)}>More</button>
            </>
          )}
        </div>
      </div>
      {more && !closed && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {image && (
            <a href={image} target="_blank" rel="noreferrer" className="mb-3 block w-fit" title="Open full size">
              {/* eslint-disable-next-line @next/next/no-img-element -- Blob URL, already a sized PNG */}
              <img src={image} alt={t.title} className="max-h-72 w-auto rounded-md border border-gray-200 bg-white shadow-sm" />
            </a>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button className={sub === "move" ? BTN_ACTIVE : BTN_WHITE} onClick={() => setSub(sub === "move" ? "none" : "move")}>Change date</button>
            <button className={sub === "handoff" ? BTN_ACTIVE : BTN_WHITE} onClick={() => setSub(sub === "handoff" ? "none" : "handoff")}>Hand off</button>
            <button className={BTN_WHITE} disabled={!!busy} onClick={() => act("unassign", { text: "Unassigned at the meeting" })}>Unassign</button>
            <button className={`${BTN} border-transparent text-gray-700 hover:bg-gray-100`} disabled={!!busy} onClick={() => act("cancel", { text: "Closed at the meeting" })}>Close</button>
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
              <span className="text-sm text-gray-600">Reminder at</span>
              <input type="datetime-local" value={nudgeLocal} onChange={(e) => setNudgeLocal(e.target.value)} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm" />
              <button className={BTN_WHITE} disabled={!nudgeLocal} onClick={() => act("set_deadline", { nudgeAt: new Date(nudgeLocal).toISOString(), text: "Nudge time set at the meeting" })}>Set</button>
              {t.nudgeSetBy && t.nudgeSetBy !== "rule" && <button className={`${BTN} border-transparent text-gray-700 hover:bg-gray-100`} onClick={() => act("set_deadline", { nudgeAt: null })}>Back to the rule</button>}
              <span className="text-xs text-gray-400">Default: hard deadline → reminder at 8am on the due day; otherwise none. Quiet hours 9pm–8am.</span>
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

// --- quick edits in place: title, details, due date, reminder time ---------------------------

const toLocalInput = (iso: string) => {
  // ISO → "YYYY-MM-DDTHH:mm" in Pacific, for <input type="datetime-local">
  const d = new Date(iso);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
};
/** "YYYY-MM-DDTHH:mm" read as Pacific → ISO */
const fromLocalInput = (v: string) => {
  const [day, hm] = v.split("T");
  const base = Date.parse(at9am(day!)); // 9:00 Pacific that day
  const [h, m] = (hm ?? "09:00").split(":").map(Number);
  return new Date(base + ((h! - 9) * 60 + m!) * 6e4).toISOString();
};

function EditableText({ value, placeholder, multiline, onSave, className }: { value: string; placeholder: string; multiline?: boolean; onSave: (v: string) => Promise<void>; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (draft.trim() === value.trim()) return setEditing(false);
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch {
      // the row shows the error; keep the editor open
    } finally {
      setSaving(false);
    }
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };
  if (!editing)
    return (
      <button type="button" onClick={() => { setDraft(value); setEditing(true); }} className={`block w-full rounded text-left hover:bg-gray-50 ${className ?? ""} ${value ? "" : "text-gray-400"}`} title="Click to edit">
        {value || placeholder}
      </button>
    );
  const props = {
    autoFocus: true,
    value: draft,
    disabled: saving,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") cancel();
      // Enter adds a line; ⌘/Ctrl+Enter (or Save) finishes
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void save();
      }
    },
    className: "w-full rounded-md border border-blue-400 px-2.5 py-1.5 text-sm text-gray-900 ring-2 ring-blue-100",
  };
  return (
    <div className="space-y-1.5">
      <textarea rows={multiline ? 3 : Math.max(1, draft.split("\n").length)} {...props} className={`${props.className} resize-y`} />
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <button type="button" onClick={() => void save()} disabled={saving} className="rounded-md bg-gray-900 px-2.5 py-1 font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        <button type="button" onClick={cancel} className="rounded-md px-2 py-1 hover:bg-gray-100">Cancel</button>
        <span>⌘↵ to save · Esc to cancel</span>
      </div>
    </div>
  );
}

/** Due date and its reminder, edited together from one chip */
function TimingChips({ t, onSave }: { t: ReviewTask; onSave: (extra: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<string | null>(null); // datetime-local draft when picking a custom reminder
  const [saving, setSaving] = useState(false);
  const run = async (extra: Record<string, unknown>) => {
    setSaving(true);
    try {
      await onSave(extra);
      setCustom(null);
    } catch {
      // the row shows the error
    } finally {
      setSaving(false);
    }
  };
  const when = (iso: string) => `${fmt(iso, { weekday: "short", day: "numeric", month: "short" })}, ${new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" })}`;
  const dueDay = t.dueAt ? ymd(new Date(t.dueAt)) : null;
  const atHour = (day: string, hour: number) => fromLocalInput(`${day}T${String(hour).padStart(2, "0")}:00`);
  const dayBefore = (day: string) => ymd(new Date(Date.parse(`${day}T12:00:00Z`) - 864e5));
  const presets = dueDay
    ? [
        { label: "Morning of, 8 AM", iso: atHour(dueDay, 8) },
        { label: "Day before, 9 AM", iso: atHour(dayBefore(dueDay), 9) },
      ].filter((p) => Date.parse(p.iso) > Date.now())
    : [];
  const isCurrent = (iso: string) => !!t.nudgeAt && Math.abs(Date.parse(t.nudgeAt) - Date.parse(iso)) < 6e4;
  const pill = (on: boolean) => `rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${on ? "bg-gray-900 text-white" : "bg-white text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50"}`;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setCustom(null);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${open ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
      >
        {t.dueAt || t.nudgeAt ? (
          <>
            {t.dueAt && <span>📅 {fmt(t.dueAt)}</span>}
            {t.dueAt && t.nudgeAt && <span className="opacity-40" aria-hidden>|</span>}
            {t.nudgeAt && <span>🔔 {when(t.nudgeAt)}</span>}
          </>
        ) : (
          "📅 Add due date"
        )}
      </button>
      {open && (
        <div className="mt-2 space-y-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-xs font-semibold uppercase tracking-wider text-gray-500">Due</span>
            <input
              type="date"
              autoFocus
              disabled={saving}
              defaultValue={dueDay ?? ""}
              onChange={(e) => e.target.value && void run({ dueAt: at9am(e.target.value) })}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5"
            />
            {t.dueAt && <button type="button" disabled={saving} onClick={() => void run({ dueAt: null, hardDeadline: false })} className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100">Remove</button>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-xs font-semibold uppercase tracking-wider text-gray-500">Reminder</span>
            <button type="button" disabled={saving} className={pill(!t.nudgeAt && custom === null)} onClick={() => (t.nudgeAt ? void run({ nudgeAt: null, hardDeadline: false }) : setCustom(null))}>None</button>
            {presets.map((p) => (
              <button key={p.label} type="button" disabled={saving} className={pill(isCurrent(p.iso) && custom === null)} onClick={() => void run({ nudgeAt: p.iso })}>{p.label}</button>
            ))}
            {t.nudgeAt && !presets.some((p) => isCurrent(p.iso)) && custom === null && <span className={pill(true)}>{when(t.nudgeAt)}</span>}
            <button type="button" disabled={saving} className={pill(custom !== null)} onClick={() => setCustom(custom === null ? (t.nudgeAt ? toLocalInput(t.nudgeAt) : dueDay ? `${dueDay}T09:00` : "") : null)}>Custom…</button>
          </div>
          {custom !== null && (
            <div className="flex flex-wrap items-center gap-2 pl-[4.5rem]">
              <input type="datetime-local" autoFocus disabled={saving} value={custom} onChange={(e) => setCustom(e.target.value)} className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5" />
              <button type="button" disabled={saving || !custom} onClick={() => void run({ nudgeAt: fromLocalInput(custom) })} className="rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Set"}</button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-2">
            <span className="text-xs text-gray-500">The owner gets one Slack reminder from the Chief at that time (never in quiet hours).</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- unassigned backlog: assign or drop, nothing else ------------------------------------

function UnassignedRow({ t, owners, onChange }: { t: ReviewTask; owners: Owner[]; onChange: () => void }) {
  const ctx = (t.context ?? {}) as { suggestedOwnerId?: string | null; suggestedOwnerName?: string | null; quote?: string | null; meeting?: string | null };
  const suggestedId = ctx.suggestedOwnerId && owners.some((o) => o.userId === ctx.suggestedOwnerId) ? ctx.suggestedOwnerId : undefined;
  // Picking a founder only selects; Accept assigns. The meeting's suggestion starts selected.
  const [picked, setPicked] = useState<string | undefined>(suggestedId);
  const [busy, setBusy] = useState<"accept" | "close" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const act = async (kind: "accept" | "close", action: string, extra: Record<string, unknown> = {}) => {
    setBusy(kind);
    setError(null);
    try {
      await post(`/api/agent/tasks/${t.id}`, { action, ...extra });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };
  const pickedName = picked ? first(owners.find((o) => o.userId === picked)?.name ?? "") : null;
  // Quick edits: stay on the row, refresh the data, surface errors in place
  const save = async (action: string, extra: Record<string, unknown>) => {
    setError(null);
    try {
      await post(`/api/agent/tasks/${t.id}`, { action, ...extra });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };
  return (
    <li className={`border-t border-gray-100 px-5 py-4 first:border-t-0 transition-opacity ${busy ? "opacity-60" : ""}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1">
          <EditableText value={t.title} placeholder="Title" className="-mx-1 whitespace-pre-line px-1 text-[15px] leading-6 text-gray-800" onSave={(title) => save("edit", { title })} />
          <EditableText
            value={t.details ?? ""}
            placeholder="Add details"
            multiline
            className="-mx-1 mt-0.5 line-clamp-3 whitespace-pre-line px-1 text-sm text-gray-500"
            onSave={(details) => save("edit", { details: details || null })}
          />
          {!suggestedId && ctx.suggestedOwnerName && <div className="mt-1 text-sm text-gray-500">Mentioned: {ctx.suggestedOwnerName}</div>}
          <TimingChips t={t} onSave={(extra) => save("set_deadline", extra)} />
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Owner">
            {owners.map((o) => {
              const on = o.userId === picked;
              return (
                <button
                  key={o.userId}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!!busy}
                  onClick={() => setPicked(on ? undefined : o.userId)}
                  title={o.userId === suggestedId ? "Suggested from the meeting" : undefined}
                  className={`relative rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${on ? "bg-gray-900 text-white" : "bg-white text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50"}`}
                >
                  {first(o.name)}
                  {o.userId === suggestedId && !on && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-blue-500" aria-hidden />}
                </button>
              );
            })}
          </div>
          <span className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" aria-hidden />
          <button
            type="button"
            className={`${BTN} border-blue-600 bg-blue-600 px-4 text-white hover:bg-blue-700 disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400`}
            disabled={!picked || !!busy}
            onClick={() => picked && act("accept", "handoff", { newOwnerUserId: picked, text: "Assigned at the meeting" })}
            title={pickedName ? `Assign to ${pickedName}` : "Pick an owner first"}
          >
            {busy === "accept" ? "Assigning…" : "Accept"}
          </button>
          <button className={`${BTN} border-transparent text-gray-600 hover:bg-gray-100`} disabled={!!busy} onClick={() => act("close", "cancel", { text: "Closed at the meeting" })}>
            {busy === "close" ? "…" : "Close"}
          </button>
        </div>
      </div>
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
          <span className="text-sm text-gray-600">Reminder at</span>
          <input type="datetime-local" value={nudge} onChange={(e) => setNudge(e.target.value)} className="rounded-md border border-gray-200 px-3 py-2 text-sm" />
          <span className="text-xs text-gray-400">optional; otherwise hard deadlines get a reminder at 8am on the day</span>
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
  const [laterOpen, setLaterOpen] = useState<Set<string>>(new Set()); // people whose Later list is expanded
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
  const changed = (ids: string[], stay = true) => {
    setTouched((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (stay) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    load();
  };

  if (error) return <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;
  if (!data) return <div className="mt-6 py-12 text-center text-gray-500">Loading the review…</div>;

  const openTotal = data.people.reduce((n, p) => n + p.open.length, 0);
  const closedUnassigned = data.closedUnassigned ?? [];
  const closedTotal = data.people.reduce((n, p) => n + p.closedThisWeek.length, 0) + closedUnassigned.length;
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
        <section className="overflow-hidden rounded-xl border border-amber-200 bg-white">
          <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50/60 px-5 py-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-dashed border-amber-400 text-base font-semibold text-amber-700" aria-hidden>?</span>
            <h3 className="text-xl font-semibold tracking-tight text-gray-900">Unassigned</h3>
            <button onClick={() => setAdding(true)} className={`${BTN_WHITE} ml-auto px-3`} aria-label="Add an item" title="Add an item">+</button>
          </div>
          <ul>
            {data.unassigned.map((t) => (
              <UnassignedRow key={t.id} t={t} owners={data.owners} onChange={() => changed([t.id], false)} />
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
        // Later: due after the meeting after next. Out of the weekly review until it gets close.
        const laterCutoff = Date.parse(data._meta.nextMeeting) + 7 * 864e5;
        const isLater = (t: ReviewTask) => !!t.dueAt && Date.parse(t.dueAt) > laterCutoff;
        const now = p.open.filter((t) => !isLater(t));
        const later = p.open.filter(isLater);
        const showLater = laterOpen.has(p.userId);
        return (
          <section key={p.userId} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className={`flex items-center gap-3 px-5 py-4 ${now.length || stuck.length || later.length ? "border-b border-gray-200 bg-gray-50" : ""}`}>
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gray-900 text-base font-semibold text-white" aria-hidden>
                {first(p.name).charAt(0)}
              </span>
              <h3 className="text-xl font-semibold tracking-tight text-gray-900">{first(p.name)}</h3>
              {!now.length && !stuck.length && <span className="text-sm text-gray-400">{later.length ? "Nothing due soon" : "Nothing open"}</span>}
              {p.carryOvers > 0 && <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">{p.carryOvers} carried</span>}
            </div>
            {(p.open.length > 0 || stuck.length > 0) && (
              <ul>
                {now.map((t) => {
                  const image = typeof t.context?.imageUrl === "string" ? t.context.imageUrl : null;
                  return <Row key={t.id} t={t} owners={data.owners} nextMeeting={data._meta.nextMeeting} onChange={(stay) => changed([t.id], stay)} image={image} />;
                })}
                {stuck.map((t) => (
                  <Row key={t.id} t={t} owners={data.owners} nextMeeting={data._meta.nextMeeting} onChange={(stay) => changed([t.id], stay)} />
                ))}
                {later.length > 0 && (
                  <li className="border-t border-gray-100 first:border-t-0">
                    <button
                      type="button"
                      onClick={() =>
                        setLaterOpen((prev) => {
                          const next = new Set(prev);
                          if (next.has(p.userId)) next.delete(p.userId);
                          else next.add(p.userId);
                          return next;
                        })
                      }
                      className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-sm text-gray-500 hover:bg-gray-50"
                      aria-expanded={showLater}
                    >
                      <span className="text-gray-400">{showLater ? "▾" : "▸"}</span>
                      Later ({later.length})
                      {!showLater && <span className="truncate text-gray-400">· next due {fmt(later.map((t) => t.dueAt!).sort()[0]!)}</span>}
                    </button>
                  </li>
                )}
                {showLater &&
                  later.map((t) => {
                    const image = typeof t.context?.imageUrl === "string" ? t.context.imageUrl : null;
                    return <Row key={t.id} t={t} owners={data.owners} nextMeeting={data._meta.nextMeeting} onChange={(stay) => changed([t.id], stay)} image={image} later />;
                  })}
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
              {data.people.flatMap((p) =>
                p.closedThisWeek
                  .filter((t) => !touched.has(t.id))
                  .map((t) => <Row key={t.id} t={t} owners={data.owners} nextMeeting={data._meta.nextMeeting} onChange={(stay) => changed([t.id], stay)} ownerLabel={first(p.name)} />),
              )}
              {closedUnassigned.map((t) => (
                <Row key={t.id} t={t} owners={data.owners} nextMeeting={data._meta.nextMeeting} onChange={(stay) => changed([t.id], stay)} ownerLabel="Unassigned" />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
