'use client';

import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '~/trpc/react';
import { CircuitHeader } from '~/components/CircuitHeader';
import { Loader2Icon } from '@acme/ui-shared';
import { AttendanceTab } from './_components/AttendanceTab';
import { SessionsTab } from './_components/SessionsTab';

type ClientsTab = 'roster' | 'attendance' | 'sessions';


// Week helpers — Monday-based weeks, matches /attendance convention.
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
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

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseWeekParam(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parts = value.split('-').map(Number);
  const d = new Date(parts[0]!, (parts[1]! - 1), parts[2]!);
  if (isNaN(d.getTime())) return null;
  return getMonday(d);
}

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

// Get initials from name
function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

// "Christina Herrera" -> "Herrera, Christina"; "Tabi" -> "Tabi" (single word stays as-is).
function formatLastFirst(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return `${last}, ${first}`;
}

// Excel-style 3-color heatmap: red @ 0% → amber @ 50% → green @ 100%.
function getHeatmapColor(pct: number): string {
  const p = Math.max(0, Math.min(100, pct));
  if (p <= 50) {
    const t = p / 50;
    const r = Math.round(220 + (245 - 220) * t);
    const g = Math.round(38 + (158 - 38) * t);
    const b = Math.round(38 + (11 - 38) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const t = (p - 50) / 50;
  const r = Math.round(245 + (22 - 245) * t);
  const g = Math.round(158 + (163 - 158) * t);
  const b = Math.round(11 + (74 - 11) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function ClientsPageContent() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Only run auth check on client side
        if (typeof window === 'undefined') return;
        
        const response = await fetch('/api/auth/get-session', {
          credentials: 'include',
          cache: 'no-store',
        });
        const sessionData = await response.json();
        if (sessionData?.user) {
          setUser(sessionData.user);
        } else {
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        router.push('/login');
        return;
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router]);
  const searchParams = useSearchParams();
  const trpc = api();
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state — defaults to score ascending (at-risk clients on top).
  type SortKey = 'name' | 'score' | 'attended';
  type SortDir = 'asc' | 'desc';
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      // Sensible per-column default direction:
      // - name: A→Z
      // - score: lowest first (surface at-risk)
      // - attended: most first (leaderboard feel)
      setSortDir(key === 'attended' ? 'desc' : 'asc');
    }
  };

  // Week-based filter. URL param `?week=YYYY-MM-DD` carries the Monday;
  // falls back to the current week.
  const todayMonday = useMemo(() => getMonday(new Date()), []);
  const weekFromUrl = parseWeekParam(searchParams.get('week'));
  const [weekStart, setWeekStart] = useState<Date>(weekFromUrl ?? todayMonday);

  // Tab state: roster (table) | attendance (cards) | sessions (weekly stats).
  // URL param `?tab=…`.
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<ClientsTab>(
    tabFromUrl === 'attendance' || tabFromUrl === 'sessions'
      ? tabFromUrl
      : 'roster',
  );

  const isCurrentWeek = isSameDay(weekStart, todayMonday);
  const canGoForward = !isCurrentWeek;

  // Keep URL in sync with the selected week + tab.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('week', toDateString(weekStart));
    params.set('tab', activeTab);
    router.replace(`/clients?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, activeTab]);

  const goPrev = () => setWeekStart((d) => addDays(d, -7));
  const goNext = () => {
    if (canGoForward) setWeekStart((d) => addDays(d, 7));
  };
  const goToday = () => setWeekStart(todayMonday);

  // Date-picker jump: any date selected snaps to its Monday. Future weeks are
  // blocked via the `max` attribute on the input.
  const dateInputRef = useRef<HTMLInputElement>(null);

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    // Chrome 99+ / Safari 16+ / Firefox 101+ all support showPicker, which is
    // the only reliable way to open a date picker from arbitrary click areas.
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        // Some browsers throw outside a user gesture; fall through.
      }
    }
    input.click();
    input.focus();
  };

  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const parts = value.split('-').map(Number);
    const picked = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
    if (isNaN(picked.getTime())) return;
    const monday = getMonday(picked);
    if (monday.getTime() > todayMonday.getTime()) return;
    setWeekStart(monday);
  };

  // Single-week date range: Monday → Sunday (inclusive)
  const dateRange = useMemo(() => {
    const start = new Date(weekStart);
    const end = addDays(weekStart, 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [weekStart]);

  // Always one week of expected sessions now
  const weekCount = 1;

  // Inactive clients expansion state
  const [showInactiveClients, setShowInactiveClients] = useState(false);

  // Fetch clients data with their training packages.
  // `placeholderData: keepPreviousData` keeps the table visible while a
  // new week refetches, so navigation doesn't blank the screen.
  const { data: clientsData, isLoading, isFetching, error } = useQuery({
    ...trpc.clients.getClientsWithPackages.queryOptions({
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      weekCount: weekCount,
    }),
    placeholderData: keepPreviousData,
  });

  // Fetch inactive clients data
  const { data: inactiveClientsData, isLoading: isLoadingInactive } = useQuery({
    ...trpc.clients.getClientsWithInactivePackages.queryOptions(),
    enabled: showInactiveClients, // Only fetch when expanded
  });

  // Only show the full-screen loader on the very first load (no data yet).
  // Subsequent week changes keep the existing table and show a small inline spinner.
  const isInitialLoad = !clientsData && isLoading;
  const isRefetching = !isInitialLoad && isFetching;

  if (isInitialLoad) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <CircuitHeader
          onBack={() => router.push('/trainer-home')}
          backText="Back"
          title="Clients"
          subtitle="Track client progress and insights"
        />
        <div className="flex items-center justify-center h-64">
          <Loader2Icon className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  // All clients returned already have packages and attendance data
  const clientsWithPackages = clientsData || [];
  

  // Specifically check for trainers with packages
  const trainersWithPackages = clientsWithPackages.filter(client => 
    client.role === 'trainer' && client.packages && client.packages.length > 0
  );
  
  if (trainersWithPackages.length > 0) {
    console.log('⚠️ Found trainers with packages:', trainersWithPackages.map(trainer => ({
      name: trainer.name,
      email: trainer.email,
      packageCount: trainer.packages.length,
      packages: trainer.packages,
      currentPackage: trainer.currentPackage
    })));
  }

  // Controlled by sortBy/sortDir state above; tie-break always falls back to
  // alphabetical-by-last-name so order is stable across renders.
  const filteredClients = clientsWithPackages
    .filter((client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = formatLastFirst(a.name).localeCompare(formatLastFirst(b.name));
      } else if (sortBy === 'score') {
        cmp = (a.attendance?.attendancePercentage ?? 0) - (b.attendance?.attendancePercentage ?? 0);
      } else {
        cmp = (a.attendance?.attendedSessions ?? 0) - (b.attendance?.attendedSessions ?? 0);
      }
      if (sortDir === 'desc') cmp = -cmp;
      if (cmp === 0 && sortBy !== 'name') {
        cmp = formatLastFirst(a.name).localeCompare(formatLastFirst(b.name));
      }
      return cmp;
    });

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-purple-600 dark:border-gray-700 dark:border-t-purple-400"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, user will be redirected by useEffect
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <CircuitHeader
        onBack={() => router.push('/trainer-home')}
        backText="Back"
        title="Clients"
        subtitle={`${clientsWithPackages.length} active clients`}
      />

      <div className="px-4 py-6">
        {/* Week selector — mirrors /attendance */}
        <div className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous week"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={openDatePicker}
              title="Pick a week"
              className="relative flex items-center gap-2 justify-center text-center group focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 rounded-md px-1"
            >
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors border-b border-dashed border-transparent group-hover:border-purple-400">
                {formatWeekRange(weekStart)}
              </span>
              {isCurrentWeek && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 whitespace-nowrap">
                  This Week
                </span>
              )}
              {/* Hidden input positioned beneath the button — pointer-events-none lets
                  the button receive the click, while keeping the native picker anchored
                  to the visible location when showPicker() fires. */}
              <input
                ref={dateInputRef}
                type="date"
                value={toDateString(weekStart)}
                max={toDateString(todayMonday)}
                onChange={handleDatePick}
                aria-label="Jump to a specific week"
                tabIndex={-1}
                className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
              />
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={!canGoForward}
              aria-label="Next week"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-800 flex-shrink-0"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Small inline spinner while refetching for a new week. */}
            {isRefetching && (
              <Loader2Icon
                aria-label="Loading week"
                className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin flex-shrink-0"
              />
            )}
          </div>

          {!isCurrentWeek && (
            <button
              type="button"
              onClick={goToday}
              className="w-full sm:w-auto sm:ml-3 inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 active:bg-purple-800 shadow-sm transition-colors"
            >
              Today
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Tab strip — Roster (table) | Attendance (cards) | Sessions (weekly stats) */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            {(['roster', 'attendance', 'sessions'] as ClientsTab[]).map((tab) => {
              const isActive = activeTab === tab;
              const label =
                tab === 'roster' ? 'Roster' :
                tab === 'attendance' ? 'Attendance' :
                'Sessions';
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'attendance' ? (
          <AttendanceTab weekStart={weekStart} />
        ) : activeTab === 'sessions' ? (
          <SessionsTab weekStart={weekStart} />
        ) : clientsWithPackages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No clients with packages</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Clients with active training packages will appear here</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No clients found</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Try adjusting your search terms</p>
          </div>
        ) : (
          <>
            {/* Search bar (Roster only) */}
            <div className="mb-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search clients by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none">
                  <th
                    onClick={() => handleSort('name')}
                    className="text-left px-4 py-3 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      Client Name
                      <span className={`text-[10px] ${sortBy === 'name' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-300 dark:text-gray-600'}`}>
                        {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('score')}
                    className="text-center px-4 py-3 w-28 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    <span className="inline-flex items-center gap-1 justify-center">
                      Score (%)
                      <span className={`text-[10px] ${sortBy === 'score' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-300 dark:text-gray-600'}`}>
                        {sortBy === 'score' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('attended')}
                    className="text-left px-4 py-3 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      Attendance
                      <span className={`text-[10px] ${sortBy === 'attended' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-300 dark:text-gray-600'}`}>
                        {sortBy === 'attended' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client, i) => {
                  const isTrainer = client.role === 'trainer';
                  const attendance = client.attendance;
                  const pct = attendance?.attendancePercentage ?? 0;
                  const attended = attendance?.attendedSessions ?? 0;
                  const expected = attendance?.expectedSessions ?? 0;
                  const heat = getHeatmapColor(pct);
                  const fillPct = expected > 0
                    ? Math.min(100, Math.round((attended / expected) * 100))
                    : 0;
                  const rowBg = i % 2 === 0
                    ? 'bg-white dark:bg-gray-800'
                    : 'bg-gray-50 dark:bg-gray-900/30';

                  return (
                    <tr
                      key={client.id}
                      onClick={() => router.push(`/clients/${client.id}?week=${toDateString(weekStart)}`)}
                      className={`${rowBg} hover:bg-purple-50 dark:hover:bg-purple-900/10 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 transition-colors`}
                    >
                      <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatLastFirst(client.name)}
                        {isTrainer && (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                            Trainer
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-2.5 text-center font-semibold tabular-nums"
                        style={{ color: heat }}
                      >
                        {pct}%
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-[180px] bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{ width: `${fillPct}%`, backgroundColor: heat }}
                            />
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums w-4 text-right">
                            {attended}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Inactive Clients Expandable Section (Roster tab only) */}
      {activeTab === 'roster' && (
      <div className="px-4 pb-6">
        <button
          onClick={() => setShowInactiveClients(!showInactiveClients)}
          className="w-full flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-400 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300">Show Inactive Clients</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Clients with cancelled or expired packages</p>
            </div>
          </div>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${
              showInactiveClients ? 'rotate-90' : ''
            }`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Inactive Clients List */}
        {showInactiveClients && (
          <div className="mt-4">
            {isLoadingInactive ? (
              <div className="flex items-center justify-center py-8">
                <Loader2Icon className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : !inactiveClientsData || inactiveClientsData.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-sm">No inactive clients found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inactiveClientsData
                  .filter(client =>
                    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    client.email.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((client) => {
                    const initials = getInitials(client.name);
                    const endDate = new Date(client.endDate);
                    const isRecentlyCancelled = (new Date().getTime() - endDate.getTime()) <= (30 * 24 * 60 * 60 * 1000); // Within 30 days
                    
                    return (
                      <button
                        key={client.id}
                        onClick={() => {
                          router.push(`/clients/${client.id}/packages`, {
                            state: { client }
                          });
                        }}
                        className="w-full text-left bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all opacity-75"
                      >
                        <div className="p-4">
                          <div className="flex items-center gap-4">
                            {/* Circled initials - grayed out */}
                            <div className="w-12 h-12 bg-gray-400 dark:bg-gray-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-lg">{initials}</span>
                            </div>

                            {/* Client info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-700 dark:text-gray-300">{client.name}</h3>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  isRecentlyCancelled 
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                }`}>
                                  {isRecentlyCancelled ? 'Recently Cancelled' : 'Inactive'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Last package: {client.packageName} • Ended {endDate.toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </p>
                            </div>

                            {/* Chevron */}
                            <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
      )}

    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <CircuitHeader
          onBack={() => {}}
          backText="Back"
          title="Clients"
          subtitle="Track client progress and insights"
        />
        <div className="flex items-center justify-center h-64">
          <Loader2Icon className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
        </div>
      </div>
    }>
      <ClientsPageContent />
    </Suspense>
  );
}