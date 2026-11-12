"use client";

/**
 * The Retention tab's Celebrations view: cards the cron rendered, soonest first. A founder
 * downloads the image, posts it in GroupMe by hand, then taps Posted (recorded with who/when).
 * Skip passes on one; both can be undone. Rerender rebuilds a card after a photo change.
 */

import { useState } from "react";

export interface CelebrationRow {
  id: string;
  memberId: string;
  memberName: string;
  type: "birthday" | "milestone";
  occasionDate: string; // YYYY-MM-DD
  daysAway: number; // negative = passed
  detail: string | null;
  themeKey: string; // the design
  customWords: boolean; // a founder changed the words on this card
  photo: "shown" | "none" | "off"; // none = the member has no photo; off = a founder turned it off
  ownBackground: boolean; // art made for this card alone
  photoFrom: "gymmaster" | "groupme" | null; // where the photo on the card came from
  aiEdit: string | null; // a founder had the card redrawn by the image model: their words
  /** The member's GroupMe picture and a founder's one-time answer on it; null = none found */
  groupMePhoto: { status: "suggested" | "approved" | "rejected"; nickname: string; exactName: boolean } | null;
  status: "ready" | "posted" | "skipped";
  imageUrl: string | null;
  renderedAt: string | null;
  postedAt: string | null;
  skippedAt: string | null;
  skippedReason: string | null;
  actedBy: string | null; // who posted or skipped
}

export type CelebrationAction = "posted" | "skipped" | "reopen" | "rerender";

interface Props {
  rows: CelebrationRow[];
  onAction: (row: CelebrationRow, action: CelebrationAction) => Promise<void>;
}

const when = (c: CelebrationRow) => {
  const date = new Date(`${c.occasionDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (c.daysAway === 0) return `Today · ${date}`;
  if (c.daysAway === 1) return `Tomorrow · ${date}`;
  if (c.daysAway > 1) return `In ${c.daysAway} days · ${date}`;
  return `${-c.daysAway} day${c.daysAway === -1 ? "" : "s"} ago · ${date}`;
};

const label = (c: CelebrationRow) => (c.type === "birthday" ? "Birthday" : `${c.detail ?? ""} classes`.trim());

function Card({ row, onAction }: { row: CelebrationRow; onAction: Props["onAction"] }) {
  const [busy, setBusy] = useState<CelebrationAction | null>(null);
  const act = async (action: CelebrationAction) => {
    if (action === "skipped" && !confirm(`Skip ${row.memberName}'s ${label(row).toLowerCase()} card?`)) return;
    setBusy(action);
    try {
      await onAction(row, action);
    } finally {
      setBusy(null);
    }
  };
  const ready = row.status === "ready";
  const urgent = ready && row.daysAway <= 1;
  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${urgent ? "border-amber-400" : "border-gray-200"}`}>
      {row.imageUrl ? (
        // Blob URLs aren't on next/image's allowlist; the card is already a sized PNG
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.imageUrl} alt={`${row.memberName} ${label(row)} card`} className="w-full aspect-square object-cover bg-gray-100" />
      ) : (
        <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-sm text-gray-500">Not rendered yet</div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-medium text-gray-900 truncate">{row.memberName}</div>
          <div className="text-xs text-gray-500 whitespace-nowrap">#{row.memberId}</div>
        </div>
        <div className="text-sm text-gray-600">
          {label(row)} · {when(row)}
        </div>
        {!ready && (
          <div className="text-xs text-gray-500">
            {row.status === "posted" ? "Posted" : "Skipped"}
            {row.actedBy ? ` by ${row.actedBy}` : ""}
            {row.skippedReason ? ` · ${row.skippedReason}` : ""}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {row.imageUrl && (
            <a
              href={row.imageUrl}
              download={`${row.memberName.replace(/\s+/g, "-")}-${row.type}-${row.occasionDate}.png`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Download
            </a>
          )}
          {ready ? (
            <>
              <button disabled={!!busy || !row.imageUrl} onClick={() => act("posted")} className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                {busy === "posted" ? "Saving…" : "Posted"}
              </button>
              <button disabled={!!busy} onClick={() => act("skipped")} className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                Skip
              </button>
            </>
          ) : (
            <button disabled={!!busy} onClick={() => act("reopen")} className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              Undo
            </button>
          )}
          <button disabled={!!busy} onClick={() => act("rerender")} className="ml-auto px-2 py-1.5 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50" title="Rebuild the card (new photo or theme art)">
            {busy === "rerender" ? "Rendering…" : "Re-render"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CelebrationsView({ rows, onAction }: Props) {
  const [showDone, setShowDone] = useState(false);
  const ready = rows.filter((r) => r.status === "ready");
  const done = rows.filter((r) => r.status !== "ready").sort((a, b) => (b.postedAt ?? b.skippedAt ?? "").localeCompare(a.postedAt ?? a.skippedAt ?? ""));
  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Ready to post{ready.length ? ` (${ready.length})` : ""}</h3>
        {ready.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ready.map((r) => (
              <Card key={r.id} row={r} onAction={onAction} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No birthdays in the next 14 days. Cards appear here two weeks out.</div>
        )}
      </section>
      {!!done.length && (
        <section>
          <button onClick={() => setShowDone(!showDone)} className="text-sm font-medium text-gray-700 hover:text-gray-900">
            {showDone ? "▾" : "▸"} Posted or skipped, last 30 days ({done.length})
          </button>
          {showDone && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {done.map((r) => (
                <Card key={r.id} row={r} onAction={onAction} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
