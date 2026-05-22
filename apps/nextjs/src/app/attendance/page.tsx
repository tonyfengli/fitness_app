'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '~/trpc/react';

interface ClientRow {
  clientId: string;
  name: string;
}

interface ActiveClient {
  id: string;
  name: string;
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const AVATAR_COLORS = [
  'from-pink-400 to-rose-500',
  'from-blue-400 to-indigo-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-purple-400 to-fuchsia-500',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function formatTime(time: string): string {
  // input like '05:00:00' or '05:00' -> '5:00 AM'
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = mStr ?? '00';
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m} ${period}`;
}

// Week helpers — Monday-based weeks (matches the convention used elsewhere in the codebase)
function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const sameYear = monday.getFullYear() === sunday.getFullYear();

  const m1 = MONTH_SHORT[monday.getMonth()];
  const m2 = MONTH_SHORT[sunday.getMonth()];
  const d1 = monday.getDate();
  const d2 = sunday.getDate();
  const y1 = monday.getFullYear();
  const y2 = sunday.getFullYear();

  if (sameMonth && sameYear) return `${m1} ${d1} – ${d2}, ${y1}`;
  if (sameYear) return `${m1} ${d1} – ${m2} ${d2}, ${y1}`;
  return `${m1} ${d1}, ${y1} – ${m2} ${d2}, ${y2}`;
}

// Given a Monday and a schedule's day_of_week (0=Sun ... 6=Sat), return that day's actual date.
function dateForDayOfWeek(monday: Date, dayOfWeek: number): Date {
  // Monday is index 0 in our week, so:
  // Mon(1) -> 0, Tue(2) -> 1, ..., Sat(6) -> 5, Sun(0) -> 6
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return addDays(monday, offset);
}

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface ScheduleCardProps {
  scheduleId: string;
  title: string;
  dayOfWeek: number;
  startTime: string;
  weekStart: Date;
  addedClients: ClientRow[];
  activeClients: ActiveClient[];
  onAddClient: (client: ActiveClient) => void;
  onRemoveClient: (clientId: string) => void;
}

function ScheduleCard({
  title,
  dayOfWeek,
  startTime,
  weekStart,
  addedClients,
  activeClients,
  onAddClient,
  onRemoveClient,
}: ScheduleCardProps) {
  const slotDate = dateForDayOfWeek(weekStart, dayOfWeek);
  const slotDateLabel = `${DAY_SHORT[dayOfWeek] ?? '?'} ${MONTH_SHORT[slotDate.getMonth()]} ${slotDate.getDate()}`;

  const clients = addedClients;

  // Search dropdown state
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  const trimmedQuery = query.trim().toLowerCase();
  const hasQuery = trimmedQuery.length > 0;

  const dropdownOptions = useMemo(() => {
    if (!hasQuery) return [];
    const excludedNames = new Set(clients.map((c) => c.name.toLowerCase()));
    const excludedIds = new Set(
      clients.map((c) => c.clientId).filter((id): id is string => Boolean(id)),
    );
    return activeClients
      .filter((c) => !excludedIds.has(c.id) && !excludedNames.has(c.name.toLowerCase()))
      .filter((c) => c.name.toLowerCase().includes(trimmedQuery))
      .slice(0, 8);
  }, [activeClients, clients, hasQuery, trimmedQuery]);

  const handleSelectClient = (client: ActiveClient) => {
    onAddClient(client);
    setQuery('');
    setSearchOpen(false);
  };
  const hasAttendance = clients.length > 0;
  const avatarClients = clients.slice(0, 3);
  const extra = Math.max(clients.length - avatarClients.length, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 flex flex-col shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {hasAttendance && (
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Logged
          </span>
        )}
      </div>

      {/* Day + Time */}
      <div className="flex items-center gap-2 text-gray-600 text-sm mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          {slotDateLabel} · {formatTime(startTime)}
        </span>
      </div>

      {/* Quick add */}
      <div ref={searchContainerRef} className="relative mb-4">
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-colors">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h6m9-5l-3-3m0 0l-3 3m3-3v6" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Quick add client..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
          />
        </div>

        {searchOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
            {!hasQuery ? (
              <div className="px-3 py-2 text-sm text-gray-400 italic">
                Type to search clients…
              </div>
            ) : dropdownOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No matching clients
              </div>
            ) : (
              dropdownOptions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectClient(c)}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                >
                  {c.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Client list */}
      <div className="flex-1 space-y-3 mb-4">
        {clients.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No clients added yet</p>
        ) : (
          clients.map((client) => (
            <div key={client.clientId} className="flex items-center justify-between gap-2">
              <span className="text-sm flex-1 min-w-0 truncate text-gray-900">
                {client.name}
              </span>
              <button
                type="button"
                onClick={() => onRemoveClient(client.clientId)}
                aria-label={`Remove ${client.name}`}
                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {avatarClients.length > 0 ? (
              avatarClients.map((c, i) => (
                <div
                  key={c.name}
                  className={`w-7 h-7 rounded-full bg-gradient-to-br ${
                    AVATAR_COLORS[i % AVATAR_COLORS.length]
                  } border-2 border-white flex items-center justify-center text-[10px] font-bold text-white`}
                >
                  {getInitials(c.name)}
                </div>
              ))
            ) : (
              <div className="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-semibold text-gray-400">
                0
              </div>
            )}
            {extra > 0 && (
              <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-600">
                +{extra}
              </div>
            )}
          </div>
          <span className="text-sm text-gray-700 font-medium">
            {clients.length} Present
          </span>
        </div>

      </div>
    </div>
  );
}

export default function AttendancePage() {
  const router = useRouter();
  const trpc = api();

  const todayMonday = getMonday(new Date());
  const [weekStart, setWeekStart] = useState<Date>(todayMonday);

  const isCurrentWeek = isSameDay(weekStart, todayMonday);
  const canGoForward = !isCurrentWeek; // disable going into future weeks

  const goPrev = () => setWeekStart((d) => addDays(d, -7));
  const goNext = () => {
    if (canGoForward) setWeekStart((d) => addDays(d, 7));
  };
  const goToday = () => setWeekStart(todayMonday);

  const { data: schedules, isLoading, error } = useQuery({
    ...trpc.classSchedule.list.queryOptions(),
  });

  // All clients in the business for the search dropdown (no package filter so
  // historically-active clients are still selectable for retroactive logging)
  const { data: allClientsData } = useQuery({
    ...trpc.clients.listAll.queryOptions(),
  });
  const activeClients = useMemo<ActiveClient[]>(() => {
    return (allClientsData ?? []).map((u) => ({ id: u.id, name: u.name }));
  }, [allClientsData]);

  // Attendance rows for the currently-viewed week (persisted in class_attendance)
  const weekKey = toDateString(weekStart);
  const queryClient = useQueryClient();
  const attendanceQueryOptions = trpc.classAttendance.byWeek.queryOptions({ weekStart: weekKey });
  const attendanceQueryKey = attendanceQueryOptions.queryKey;

  const { data: attendanceRows = [] } = useQuery(attendanceQueryOptions);

  type AttendanceRow = { classScheduleId: string; userId: string; date: string; name: string };

  const markMutation = useMutation(trpc.classAttendance.mark.mutationOptions());
  const unmarkMutation = useMutation(trpc.classAttendance.unmark.mutationOptions());

  const handleAddClient = (scheduleId: string, dayOfWeek: number, client: ActiveClient) => {
    const slotDate = toDateString(dateForDayOfWeek(weekStart, dayOfWeek));
    const optimisticRow: AttendanceRow = {
      classScheduleId: scheduleId,
      userId: client.id,
      date: slotDate,
      name: client.name,
    };

    // Optimistic add
    queryClient.setQueryData<AttendanceRow[]>(attendanceQueryKey, (old) => [
      ...(old ?? []),
      optimisticRow,
    ]);

    markMutation.mutate(
      { classScheduleId: scheduleId, userId: client.id, date: slotDate },
      {
        onError: (err) => {
          // Rollback
          queryClient.setQueryData<AttendanceRow[]>(attendanceQueryKey, (old) =>
            (old ?? []).filter(
              (r) =>
                !(
                  r.classScheduleId === scheduleId &&
                  r.userId === client.id &&
                  r.date === slotDate
                ),
            ),
          );
          alert(`Failed to add ${client.name}: ${err.message}`);
        },
      },
    );
  };

  const handleRemoveClient = (scheduleId: string, dayOfWeek: number, clientId: string) => {
    const slotDate = toDateString(dateForDayOfWeek(weekStart, dayOfWeek));

    // Snapshot the removed row in case we need to rollback
    const prevRows = queryClient.getQueryData<AttendanceRow[]>(attendanceQueryKey) ?? [];
    const removedRow = prevRows.find(
      (r) =>
        r.classScheduleId === scheduleId &&
        r.userId === clientId &&
        r.date === slotDate,
    );

    // Optimistic remove
    queryClient.setQueryData<AttendanceRow[]>(attendanceQueryKey, (old) =>
      (old ?? []).filter(
        (r) =>
          !(
            r.classScheduleId === scheduleId &&
            r.userId === clientId &&
            r.date === slotDate
          ),
      ),
    );

    unmarkMutation.mutate(
      { classScheduleId: scheduleId, userId: clientId, date: slotDate },
      {
        onError: (err) => {
          // Rollback
          if (removedRow) {
            queryClient.setQueryData<AttendanceRow[]>(attendanceQueryKey, (old) => [
              ...(old ?? []),
              removedRow,
            ]);
          }
          alert(`Failed to remove client: ${err.message}`);
        },
      },
    );
  };

  // Group attendance rows by classScheduleId for per-card lookup
  const addedByScheduleId = useMemo(() => {
    const map = new Map<string, ClientRow[]>();
    for (const row of attendanceRows as AttendanceRow[]) {
      const existing = map.get(row.classScheduleId) ?? [];
      existing.push({ clientId: row.userId, name: row.name });
      map.set(row.classScheduleId, existing);
    }
    return map;
  }, [attendanceRows]);

  const addedForCard = (scheduleId: string): ClientRow[] => {
    return addedByScheduleId.get(scheduleId) ?? [];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push('/client-hub')}
            className="group flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all duration-200 flex-shrink-0"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Back</span>
          </button>

          <h1 className="text-base sm:text-lg font-semibold text-gray-900">Attendance</h1>

          <div className="w-[60px] sm:w-[76px] flex-shrink-0" />
        </div>
      </div>

      {/* Week selector */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={goPrev}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0"
              aria-label="Previous week"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2 justify-center text-center">
              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                {formatWeekRange(weekStart)}
              </span>
              {isCurrentWeek && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">
                  This Week
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={!canGoForward}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white flex-shrink-0"
              aria-label="Next week"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {!isCurrentWeek && (
            <button
              type="button"
              onClick={goToday}
              className="w-full sm:w-auto sm:ml-3 inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 shadow-sm transition-colors"
            >
              Today
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
          </div>
        ) : error ? (
          <div className="text-center py-24 text-red-600">
            Failed to load schedule: {error.message}
          </div>
        ) : !schedules || schedules.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            No class schedules configured yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {schedules.map((s) => (
              <ScheduleCard
                key={s.id}
                scheduleId={s.id}
                title={s.name}
                dayOfWeek={s.dayOfWeek}
                startTime={s.startTime}
                weekStart={weekStart}
                addedClients={addedForCard(s.id)}
                activeClients={activeClients}
                onAddClient={(client) => handleAddClient(s.id, s.dayOfWeek, client)}
                onRemoveClient={(clientId) => handleRemoveClient(s.id, s.dayOfWeek, clientId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
