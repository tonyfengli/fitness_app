'use client';

import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '~/trpc/react';
import { CircuitHeader } from '~/components/CircuitHeader';
import { Loader2Icon } from '@acme/ui-shared';
import { formatShortDate } from '~/utils/weekUtils';
import { OptionsDrawer } from '~/components/workout/OptionsDrawer';
import { useScrollManager } from '~/hooks/useScrollManager';

interface ClientDetailPageProps {
  params: Promise<{
    clientId: string;
  }>;
}

// Get initials from name
function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

// Get progress bar color based on percentage
function getProgressColor(percentage: number) {
  if (percentage >= 80) return 'bg-emerald-500';
  if (percentage >= 60) return 'bg-yellow-500';
  if (percentage >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

// Week helpers — Monday-based weeks. Mirrors /attendance and /clients list page.
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
  const d = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
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

function ClientDetailPageContent({ params }: ClientDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = api();
  const [searchQuery, setSearchQuery] = useState('');

  // Week-based filter — URL param `?week=YYYY-MM-DD` carries the Monday.
  const todayMonday = useMemo(() => getMonday(new Date()), []);
  const weekFromUrl = parseWeekParam(searchParams.get('week'));
  const [weekStart, setWeekStart] = useState<Date>(weekFromUrl ?? todayMonday);

  const isCurrentWeek = isSameDay(weekStart, todayMonday);
  const canGoForward = !isCurrentWeek;

  // Settings drawer state
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Unwrap the params Promise using React.use()
  const { clientId } = React.use(params);

  // iOS scroll management for settings drawer
  useScrollManager({
    isActive: showSettingsDrawer,
    priority: 1
  });

  // Keep URL in sync with the selected week.
  useEffect(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('week', toDateString(weekStart));
    router.replace(`/clients/${clientId}?${sp.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const goPrev = () => setWeekStart((d) => addDays(d, -7));
  const goNext = () => {
    if (canGoForward) setWeekStart((d) => addDays(d, 7));
  };
  const goToday = () => setWeekStart(todayMonday);

  // Date picker — any picked date snaps to its Monday; future weeks blocked via max.
  const dateInputRef = useRef<HTMLInputElement>(null);
  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        /* fall through */
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

  // Single-week range: Mon (00:00) → Sun (23:59:59). Used for stats + the
  // "selected week" highlight on the calendar.
  const dateRange = useMemo(() => {
    const start = new Date(weekStart);
    const end = addDays(weekStart, 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [weekStart]);

  // Wider range for the calendar — covers the full calendar month(s) that
  // contain the selected week so all attendance dots in the visible months
  // show up, even those outside the selected week.
  const calendarRange = useMemo(() => {
    const weekEnd = addDays(weekStart, 6);
    const start = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    const end = new Date(weekEnd.getFullYear(), weekEnd.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [weekStart]);

  // Always one week of expected sessions now.
  const weekCount = 1;

  // Fetch client data with attendance.
  // `placeholderData: keepPreviousData` keeps the old data visible while a
  // new query key (e.g. different week) refetches — so the page doesn't
  // blank out to a full-screen spinner on every week change.
  const { data: clientData, isLoading: clientLoading, isFetching: clientFetching } = useQuery({
    ...trpc.clients.getClientsWithPackages.queryOptions({
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      weekCount: weekCount,
    }),
    placeholderData: keepPreviousData,
  });

  // Find the specific client
  const client = clientData?.find(c => c.id === clientId);

  // Get all packages for calendar display (if client has the new allPackages field)
  const allPackages = client?.allPackages || [];

  // Fetch attendance history for the wider CALENDAR range, so every dot in the
  // visible month(s) renders — not just the selected-week subset.
  const { data: attendanceHistory, isLoading: historyLoading, isFetching: historyFetching } = useQuery({
    ...trpc.clients.getClientAttendanceHistory.queryOptions({
      clientId: clientId,
      startDate: calendarRange.start.toISOString(),
      endDate: calendarRange.end.toISOString(),
    }),
    placeholderData: keepPreviousData,
  });

  // True initial load = nothing to show yet. Subsequent week switches keep
  // the previous render visible and just flag a small inline spinner.
  const isInitialLoad = !client && (clientLoading || historyLoading);
  const isRefetching = !isInitialLoad && (clientFetching || historyFetching);

  // Debug logging for specific client
  React.useEffect(() => {
    if ((clientId === '4wnrsk1032vmhjxn5wl' || clientId === '4263bc69-f06c-4cf1-83ec-4756ea5bf94c') && client && client.currentPackage) {
      console.log(`🔍 [Client ${clientId}] Calendar Page Debug Info:`);
      console.log('📅 [Filter & Date Range]', {
        weekStart: toDateString(weekStart),
        filterDateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
          startFormatted: dateRange.start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          endFormatted: dateRange.end.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        },
        weekCount
      });
      
      if (client) {
        console.log('📦 [Package Data]', {
          name: client.name,
          id: client.id,
          package: {
            name: client.currentPackage.name,
            sessionsPerWeek: client.currentPackage.sessionsPerWeek,
            startDate: client.currentPackage.startDate,
            endDate: client.currentPackage.endDate,
            status: client.currentPackage.status,
            startDateFormatted: new Date(client.currentPackage.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            endDateFormatted: new Date(client.currentPackage.endDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          }
        });
        
        console.log('📊 [Commitment Calculation with Package Expiration]', {
          sessionsPerWeek: client.currentPackage.sessionsPerWeek,
          weekCount: weekCount,
          expectedSessions: client.attendance.expectedSessions,
          attendedSessions: client.attendance.attendedSessions,
          attendancePercentage: client.attendance.attendancePercentage,
          calculation: `${client.currentPackage.sessionsPerWeek} sessions/week × ${weekCount} weeks = ${client.attendance.expectedSessions} expected sessions`,
          packageConstraints: {
            packageStart: client.currentPackage.startDate,
            packageEnd: client.currentPackage.endDate,
            packageExpired: new Date(client.currentPackage.endDate) < dateRange.end,
            filterExtendsAfterPackage: dateRange.end > new Date(client.currentPackage.endDate),
            effectiveCalculationPeriod: {
              start: Math.max(dateRange.start.getTime(), new Date(client.currentPackage.startDate).getTime()),
              end: Math.min(dateRange.end.getTime(), new Date(client.currentPackage.endDate).getTime())
            }
          },
          classBreakdown: {
            totalCommittedInFilterPeriod: client.currentPackage.sessionsPerWeek * weekCount,
            actualCommittedAfterExpiration: client.attendance.expectedSessions,
            classesLostToExpiration: (client.currentPackage.sessionsPerWeek * weekCount) - client.attendance.expectedSessions,
            attendedClasses: client.attendance.attendedSessions,
            missedClasses: client.attendance.expectedSessions - client.attendance.attendedSessions
          }
        });
      }
      
      if (attendanceHistory) {
        const packageStartDate = new Date(client.currentPackage.startDate);
        const packageEndDate = new Date(client.currentPackage.endDate);
        
        const sessionsInFilterRange = attendanceHistory.filter(session => 
          session.scheduledAt && 
          session.scheduledAt >= dateRange.start && 
          session.scheduledAt <= dateRange.end
        );
        
        const sessionsInPackageRange = attendanceHistory.filter(session => 
          session.scheduledAt && 
          session.scheduledAt >= packageStartDate && 
          session.scheduledAt <= packageEndDate
        );
        
        const sessionsInEffectiveRange = attendanceHistory.filter(session => 
          session.scheduledAt && 
          new Date(session.scheduledAt).getTime() >= Math.max(dateRange.start.getTime(), packageStartDate.getTime()) && 
          new Date(session.scheduledAt).getTime() <= Math.min(dateRange.end.getTime(), packageEndDate.getTime())
        );
        
        const attendedInEffectiveRange = sessionsInEffectiveRange.filter(session => 
          session.status !== 'no_show' && session.status !== 'registered'
        );
        
        const sessionsAfterPackageExpiry = attendanceHistory.filter(session => 
          session.scheduledAt && 
          session.scheduledAt > packageEndDate &&
          session.scheduledAt >= dateRange.start && 
          session.scheduledAt <= dateRange.end
        );
        
        console.log('📝 [Attendance History with Package Expiration Analysis]', {
          totalSessionsInDatabase: attendanceHistory.length,
          sessionsInFilterRange: sessionsInFilterRange.length,
          sessionsInPackageRange: sessionsInPackageRange.length,
          sessionsInEffectiveRange: sessionsInEffectiveRange.length,
          attendedInEffectiveRange: attendedInEffectiveRange.length,
          sessionsAfterPackageExpiry: sessionsAfterPackageExpiry.length,
          packageExpirationAnalysis: {
            packageExpired: packageEndDate < dateRange.end,
            packageExpiresAt: packageEndDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            filterEndsAt: dateRange.end.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            daysAfterExpiryInFilter: packageEndDate < dateRange.end ? 
              Math.ceil((dateRange.end.getTime() - packageEndDate.getTime()) / (24 * 60 * 60 * 1000)) : 0
          },
          commitmentVsAttendance: {
            sessionsPerWeek: client.currentPackage.sessionsPerWeek,
            weeksInFilter: weekCount,
            theoreticalCommitment: client.currentPackage.sessionsPerWeek * weekCount,
            actualCommitment: client.attendance.expectedSessions,
            actualAttendance: client.attendance.attendedSessions,
            commitmentLostToExpiration: (client.currentPackage.sessionsPerWeek * weekCount) - client.attendance.expectedSessions
          }
        });
        
        // Group sessions by status and time period
        const sessionsByPeriod = {
          beforePackageStart: attendanceHistory.filter(s => s.scheduledAt && s.scheduledAt < packageStartDate),
          duringPackageAndFilter: sessionsInEffectiveRange,
          afterPackageExpiry: sessionsAfterPackageExpiry,
          outsideFilterRange: attendanceHistory.filter(s => 
            s.scheduledAt && 
            (s.scheduledAt < dateRange.start || s.scheduledAt > dateRange.end)
          )
        };
        
        console.log('📅 [Sessions by Time Period]', {
          beforePackageStart: {
            count: sessionsByPeriod.beforePackageStart.length,
            sessions: sessionsByPeriod.beforePackageStart.map(s => ({
              date: s.scheduledAt?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              name: s.sessionName,
              status: s.status,
              note: 'Before package started - not counted'
            }))
          },
          duringPackageAndFilter: {
            count: sessionsByPeriod.duringPackageAndFilter.length,
            attended: sessionsByPeriod.duringPackageAndFilter.filter(s => s.status !== 'no_show' && s.status !== 'registered').length,
            sessions: sessionsByPeriod.duringPackageAndFilter.map(s => ({
              date: s.scheduledAt?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              name: s.sessionName,
              status: s.status,
              countsTowardAttendance: s.status !== 'no_show' && s.status !== 'registered',
              note: 'During active package & filter period - COUNTED'
            }))
          },
          afterPackageExpiry: {
            count: sessionsByPeriod.afterPackageExpiry.length,
            sessions: sessionsByPeriod.afterPackageExpiry.map(s => ({
              date: s.scheduledAt?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              name: s.sessionName,
              status: s.status,
              note: 'After package expired - not counted toward commitment or attendance'
            }))
          }
        });
        
        attendanceHistory.forEach((session, index) => {
          const sessionDate = new Date(session.scheduledAt);
          
          console.log(`📅 [Session ${index + 1}] Detailed Analysis`, {
            date: session.scheduledAt?.toISOString(),
            dateFormatted: sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            name: session.sessionName,
            status: session.status,
            timing: {
              withinFilterRange: session.scheduledAt && 
                session.scheduledAt >= dateRange.start && 
                session.scheduledAt <= dateRange.end,
              withinPackageRange: session.scheduledAt &&
                sessionDate >= packageStartDate && 
                sessionDate <= packageEndDate,
              afterPackageExpiry: session.scheduledAt && sessionDate > packageEndDate,
              beforePackageStart: session.scheduledAt && sessionDate < packageStartDate
            },
            counting: {
              countsTowardAttendance: session.scheduledAt &&
                sessionDate >= packageStartDate && 
                sessionDate <= packageEndDate &&
                session.scheduledAt >= dateRange.start && 
                session.scheduledAt <= dateRange.end &&
                session.status !== 'no_show' && session.status !== 'registered',
              excludedReason: (() => {
                if (!session.scheduledAt) return 'No scheduled date';
                if (sessionDate < packageStartDate) return 'Before package started';
                if (sessionDate > packageEndDate) return 'After package expired';
                if (session.scheduledAt < dateRange.start) return 'Before filter range';
                if (session.scheduledAt > dateRange.end) return 'After filter range';
                if (session.status === 'no_show') return 'No show status';
                if (session.status === 'registered') return 'Only registered, not attended';
                return 'none - this session counts';
              })()
            }
          });
        });
      }
    }
  }, [client, attendanceHistory, weekStart, dateRange, weekCount, clientId]);

  if (isInitialLoad) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <CircuitHeader
          onBack={() => router.push('/clients')}
          backText="Back"
          title="Client Details"
          subtitle="Loading client information..."
        />
        <div className="flex items-center justify-center h-64">
          <Loader2Icon className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <CircuitHeader
          onBack={() => router.push('/clients')}
          backText="Back"
          title="Client Not Found"
          subtitle="The requested client could not be found"
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Client Not Found</h3>
            <p className="text-gray-500 dark:text-gray-400">The client you're looking for doesn't exist or you don't have permission to view them.</p>
          </div>
        </div>
      </div>
    );
  }

  const initials = getInitials(client.name);
  const packageData = client.currentPackage;
  const attendanceData = client.attendance;
  const progressColor = getProgressColor(attendanceData.attendancePercentage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <CircuitHeader
        onBack={() => router.push(`/clients?week=${toDateString(weekStart)}`)}
        backText="Back"
        title={client.name}
        subtitle={`${attendanceData.attendedSessions}/${attendanceData.expectedSessions} sessions • ${attendanceData.attendancePercentage}% attendance`}
        rightAction={
          <button 
            onClick={() => setShowSettingsDrawer(true)}
            className="p-1 -m-1 rounded-lg hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        }
      />


      <div className="px-4 py-6">
        {/* Week selector — mirrors /attendance and /clients list page */}
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

            {/* Small inline spinner shown while refetching — replaces the
                previous full-screen blank/spinner during week navigation. */}
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




        {/* Attendance Calendar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Attendance Calendar</h3>
            <div className="flex items-center gap-2">
              <div className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full text-sm font-medium">
                {packageData.sessionsPerWeek}x/week
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            {/* Calendar Grid */}
            {(() => {
                // Create a map of dates to sessions for quick lookup
                const sessionsByDate = new Map<string, typeof attendanceHistory[0][]>();
                if (attendanceHistory && attendanceHistory.length > 0) {
                  attendanceHistory.forEach(session => {
                    const dateKey = new Date(session.scheduledAt).toDateString();
                    if (!sessionsByDate.has(dateKey)) {
                      sessionsByDate.set(dateKey, []);
                    }
                    sessionsByDate.get(dateKey)!.push(session);
                  });
                }

                // Generate calendar months within the wider CALENDAR range so
                // we always show full month(s) regardless of which single week
                // is currently selected.
                const startDate = new Date(calendarRange.start);
                const endDate = new Date(calendarRange.end);
                const months = [];

                let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                while (currentDate <= endDate) {
                  months.push(new Date(currentDate));
                  currentDate.setMonth(currentDate.getMonth() + 1);
                }

                // The selected week (Mon–Sun) for highlighting.
                const selectedWeekStart = new Date(weekStart);
                selectedWeekStart.setHours(0, 0, 0, 0);
                const selectedWeekEnd = addDays(weekStart, 6);
                selectedWeekEnd.setHours(23, 59, 59, 999);

                return months.map(monthStart => {
                  const year = monthStart.getFullYear();
                  const month = monthStart.getMonth();
                  const monthName = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  
                  // Get first day of month and last day of month
                  const firstDay = new Date(year, month, 1);
                  const lastDay = new Date(year, month + 1, 0);
                  
                  // Get the day of week for first day (0 = Sunday, 1 = Monday, etc.)
                  const startDayOfWeek = firstDay.getDay();
                  
                  // Calculate days to show (including previous month padding)
                  const daysInMonth = lastDay.getDate();
                  const totalDays = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;
                  
                  const calendarDays = [];
                  for (let i = 0; i < totalDays; i++) {
                    const dayNumber = i - startDayOfWeek + 1;
                    const date = new Date(year, month, dayNumber);
                    const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
                    const isInSelectedWeek =
                      date.getTime() >= selectedWeekStart.getTime() &&
                      date.getTime() <= selectedWeekEnd.getTime();
                    const dateKey = date.toDateString();
                    const sessionsOnDate = sessionsByDate.get(dateKey) || [];
                    
                    // Check if this date is any package start or end date
                    const packageEvents = [];
                    
                    // For backward compatibility, check current package
                    const packageStartDate = new Date(packageData.startDate);
                    const packageEndDate = new Date(packageData.endDate);
                    const isPackageStartDate = date.toDateString() === packageStartDate.toDateString();
                    const isPackageEndDate = date.toDateString() === packageEndDate.toDateString();
                    
                    // Check all packages for transitions (if available)
                    if (allPackages.length > 0) {
                      allPackages.forEach((pkg, index) => {
                        const pkgStart = new Date(pkg.startDate!);
                        const pkgEnd = new Date(pkg.endDate!);
                        
                        if (date.toDateString() === pkgEnd.toDateString()) {
                          const nextPackage = allPackages[index + 1];
                          const isTransition = nextPackage && 
                            new Date(nextPackage.startDate!).toDateString() === pkgEnd.toDateString();
                          
                          if (isTransition) {
                            // For transitions, only add the transition event (not the start event)
                            packageEvents.push({
                              type: 'transition',
                              packageName: pkg.packageName!,
                              sessionsPerWeek: pkg.sessionsPerWeek!,
                              nextPackage: {
                                name: nextPackage.packageName!,
                                sessionsPerWeek: nextPackage.sessionsPerWeek!
                              }
                            });
                          } else {
                            // Only add end event if it's not a transition
                            packageEvents.push({
                              type: 'end',
                              packageName: pkg.packageName!,
                              sessionsPerWeek: pkg.sessionsPerWeek!,
                              isTransition: false,
                              nextPackage: null
                            });
                          }
                        } else if (date.toDateString() === pkgStart.toDateString()) {
                          // Only add start event if it's not part of a transition
                          const prevPackage = index > 0 ? allPackages[index - 1] : null;
                          const isPartOfTransition = prevPackage && 
                            new Date(prevPackage.endDate!).toDateString() === pkgStart.toDateString();
                          
                          if (!isPartOfTransition) {
                            packageEvents.push({
                              type: 'start',
                              packageName: pkg.packageName!,
                              sessionsPerWeek: pkg.sessionsPerWeek!,
                              isFirst: index === 0
                            });
                          }
                        }
                      });
                    }
                    
                    calendarDays.push({
                      date,
                      dayNumber: isCurrentMonth ? dayNumber : '',
                      isCurrentMonth,
                      isInSelectedWeek,
                      sessions: sessionsOnDate,
                      isPackageStartDate,
                      isPackageEndDate,
                      packageEvents,
                    });
                  }

                  return (
                    <div key={`${year}-${month}`} className="mb-8">
                      {/* Month header */}
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{monthName}</h4>
                      
                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {/* Day headers */}
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                            {day}
                          </div>
                        ))}
                        
                        {/* Calendar days */}
                        {calendarDays.map((day, index) => {
                          const hasAttendedSession = day.sessions.some(s => s.status !== 'no_show' && s.status !== 'registered');
                          const hasNoShow = day.sessions.some(s => s.status === 'no_show');
                          const hasMultipleSessions = day.sessions.length > 1;
                          
                          // Build tooltip text
                          let tooltipText = '';
                          if (day.sessions.length > 0) {
                            tooltipText = day.sessions.map(s => `${s.sessionName} - ${s.status}`).join('\n');
                          }
                          if (day.isPackageStartDate) {
                            tooltipText = tooltipText ? `${tooltipText}\n📦 Package Start` : '📦 Package Start';
                          }
                          if (day.isPackageEndDate) {
                            tooltipText = tooltipText ? `${tooltipText}\n📦 Package End` : '📦 Package End';
                          }
                          
                          return (
                            <div
                              key={index}
                              className={`relative p-2 min-h-[3rem] border ${
                                day.isInSelectedWeek && day.isCurrentMonth
                                  ? 'border-purple-400 dark:border-purple-500'
                                  : day.isPackageStartDate || day.isPackageEndDate
                                  ? 'border-purple-300 dark:border-purple-600'
                                  : 'border-gray-100 dark:border-gray-700'
                              } ${
                                !day.isCurrentMonth
                                  ? 'bg-gray-50 dark:bg-gray-900'
                                  : day.isInSelectedWeek
                                  ? 'bg-purple-50 dark:bg-purple-900/20'
                                  : 'bg-white dark:bg-gray-800'
                              } ${
                                day.sessions.length > 0 ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''
                              }`}
                              title={tooltipText}
                            >
                              {/* Day number */}
                              <div className={`text-sm font-medium ${
                                !day.isCurrentMonth
                                  ? 'text-gray-400 dark:text-gray-600'
                                  : day.isInSelectedWeek
                                  ? 'text-purple-900 dark:text-purple-100'
                                  : 'text-gray-900 dark:text-white'
                              }`}>
                                {day.dayNumber}
                              </div>
                              
                              {/* Package start/end indicators */}
                              {day.isCurrentMonth && day.packageEvents && day.packageEvents.length > 0 && (
                                <div className="absolute top-1 right-1">
                                  {day.packageEvents.map((event, idx) => {
                                    // Handle transitions - show the new package frequency
                                    if (event.type === 'transition') {
                                      return (
                                        <div key={idx} className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                                          {event.nextPackage.sessionsPerWeek}x
                                        </div>
                                      );
                                    }
                                    
                                    // Show package frequency for all starts
                                    if (event.type === 'start') {
                                      return (
                                        <div key={idx} className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                                          {event.sessionsPerWeek}x
                                        </div>
                                      );
                                    }
                                    
                                    // Only show end indicator if it's not a transition
                                    if (event.type === 'end') {
                                      return <div key={idx} className="w-2 h-2 bg-purple-700 rounded-full" title="Package End"></div>;
                                    }
                                    
                                    return null;
                                  })}
                                  
                                  {/* Fallback for backward compatibility */}
                                  {(!day.packageEvents || day.packageEvents.length === 0) && (
                                    <>
                                      {day.isPackageStartDate && (
                                        <div className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                                          {packageData.sessionsPerWeek}x
                                        </div>
                                      )}
                                      {day.isPackageEndDate && (
                                        <div className="w-2 h-2 bg-purple-700 rounded-full" title="Package End"></div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                              
                              {/* Session indicators */}
                              {day.isCurrentMonth && day.sessions.length > 0 && (
                                <div className="absolute bottom-1 left-1 right-1 flex justify-center gap-1">
                                  {hasMultipleSessions ? (
                                    // Multiple sessions - show count
                                    <div className={`w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center ${
                                      hasAttendedSession ? 'bg-emerald-500' : hasNoShow ? 'bg-red-500' : 'bg-gray-400'
                                    }`}>
                                      {day.sessions.length}
                                    </div>
                                  ) : (
                                    // Single session - show status dot
                                    <div className={`w-3 h-3 rounded-full ${
                                      day.sessions[0]!.status === 'completed' ? 'bg-emerald-500' :
                                      ['checked_in', 'ready', 'workout_ready'].includes(day.sessions[0]!.status) ? 'bg-blue-500' :
                                      day.sessions[0]!.status === 'no_show' ? 'bg-red-500' :
                                      'bg-gray-400'
                                    }`} />
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
              
            </div>
        </div>
      </div>

      {/* Settings Drawer */}
      <OptionsDrawer
        isOpen={showSettingsDrawer}
        onClose={() => setShowSettingsDrawer(false)}
        title="Client Settings"
        items={[
          {
            id: 'manage-packages',
            label: 'Manage Packages',
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            ),
            onClick: () => {
              // For now, just navigate normally - we'll optimize later
              router.push(`/clients/${clientId}/packages`);
            }
          }
        ]}
      />
    </div>
  );
}

export default function ClientDetailPage({ params }: ClientDetailPageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <CircuitHeader
          onBack={() => {}}
          backText="Back"
          title="Client Details"
          subtitle="Loading client information..."
        />
        <div className="flex items-center justify-center h-64">
          <Loader2Icon className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
        </div>
      </div>
    }>
      <ClientDetailPageContent params={params} />
    </Suspense>
  );
}