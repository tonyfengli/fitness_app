'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/trpc/react';
import { CircuitHeader } from '~/components/CircuitHeader';
import { Loader2Icon } from '@acme/ui-shared';
import { processFilterSelection, formatLongDate, formatShortDate, getMostRecentCompleteMonth, type WeekRange } from '~/utils/weekUtils';
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

export default function ClientDetailPage({ params }: ClientDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = api();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get the most recent complete month as an additional filter option
  const mostRecentCompleteMonth = useMemo(() => getMostRecentCompleteMonth(), []);
  
  // Get filter from URL params, fallback to 'Last 2 Weeks'
  const filterFromUrl = searchParams.get('filter');
  const [selectedFilter, setSelectedFilter] = useState(filterFromUrl || 'Last 2 Weeks');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartMonth, setCustomStartMonth] = useState('');
  const [customEndMonth, setCustomEndMonth] = useState('');
  
  // State for the modal - separate from applied state
  const [modalFilter, setModalFilter] = useState('');
  const [modalStartMonth, setModalStartMonth] = useState('');
  const [modalEndMonth, setModalEndMonth] = useState('');
  const [filterType, setFilterType] = useState<'single' | 'range'>('single');
  
  // Settings drawer state
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  
  // Unwrap the params Promise using React.use()
  const { clientId } = React.use(params);

  // iOS scroll management for settings drawer
  useScrollManager({ 
    isActive: showSettingsDrawer, 
    priority: 1 
  });

  // Generate available historical months (up to 1 year back)
  const availableMonths = useMemo(() => {
    const months = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-11 (November = 10)
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Start from previous month (skip current month since it's not fully historical)
    // Go back 12 months from previous month
    for (let i = 1; i <= 12; i++) {
      let monthIndex = currentMonth - i;
      let year = currentYear;
      
      // Handle going back to previous year
      if (monthIndex < 0) {
        monthIndex = monthIndex + 12;
        year = currentYear - 1;
      }
      
      const monthName = monthNames[monthIndex];
      
      months.push({
        name: monthName,
        value: `${monthName} ${year}`,
        year: year,
        displayName: `${monthName} ${year}`
      });
    }
    
    // Reverse to show earliest to latest (oldest first)
    return months.reverse();
  }, []);

  // Calculate the adjusted date range for the selected filter
  const dateRange: WeekRange = useMemo(() => {
    const range = processFilterSelection(selectedFilter);
    return range;
  }, [selectedFilter]);

  // Calculate week count with proper logic for explicit week filters
  const weekCount = React.useMemo(() => {
    if (selectedFilter === '2 Weeks') return 2;
    if (selectedFilter === '4 Weeks') return 4;
    // For other filters, use rounded calculation since all ranges are adjusted to complete weeks
    return Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  }, [dateRange, selectedFilter]);

  // Fetch client data with attendance
  const { data: clientData, isLoading: clientLoading } = useQuery({
    ...trpc.clients.getClientsWithPackages.queryOptions({
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      weekCount: weekCount,
    }),
  });

  // Find the specific client
  const client = clientData?.find(c => c.id === clientId);
  
  // Get all packages for calendar display (if client has the new allPackages field)
  const allPackages = client?.allPackages || [];

  // Fetch client's detailed attendance history
  const { data: attendanceHistory, isLoading: historyLoading } = useQuery({
    ...trpc.clients.getClientAttendanceHistory.queryOptions({
      clientId: clientId,
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
    }),
  });

  // Debug logging for specific client
  React.useEffect(() => {
    if ((clientId === '4wnrsk1032vmhjxn5wl' || clientId === '4263bc69-f06c-4cf1-83ec-4756ea5bf94c') && client && client.currentPackage) {
      console.log(`🔍 [Client ${clientId}] Calendar Page Debug Info:`);
      console.log('📅 [Filter & Date Range]', {
        selectedFilter,
        filterDateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
          startFormatted: dateRange.start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          endFormatted: dateRange.end.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          wasAdjusted: dateRange.wasAdjusted
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
  }, [client, attendanceHistory, selectedFilter, dateRange, weekCount, clientId]);

  if (clientLoading || historyLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50">
        <CircuitHeader
          onBack={() => router.push('/clients')}
          backText="Back"
          title="Client Details"
          subtitle="Loading client information..."
        />
        <div className="flex items-center justify-center h-64">
          <Loader2Icon className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50">
      <CircuitHeader
        onBack={() => router.push(`/clients?filter=${encodeURIComponent(selectedFilter)}`)}
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
        {/* Time Filter */}
        <div className="mb-4 grid grid-cols-4 gap-1.5">
          {['Last 2 Weeks', 'Last 4 Weeks', mostRecentCompleteMonth].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-2 py-2 rounded-lg font-medium text-xs transition-all duration-200 ${
                selectedFilter === filter
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {filter}
            </button>
          ))}
          <button
            onClick={() => setShowCustomPicker(true)}
            className={`px-2 py-2 rounded-lg font-medium text-xs transition-all duration-200 ${
              !['Last 2 Weeks', 'Last 4 Weeks', mostRecentCompleteMonth].includes(selectedFilter)
                ? 'bg-purple-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Custom ▼
          </button>
        </div>

        {/* Date Range Display */}
        <div className="mb-6 text-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {formatLongDate(dateRange.start)} to {formatLongDate(dateRange.end)}
          </div>
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

                // Generate calendar months within the date range
                const startDate = new Date(dateRange.start);
                const endDate = new Date(dateRange.end);
                const months = [];
                
                let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                while (currentDate <= endDate) {
                  months.push(new Date(currentDate));
                  currentDate.setMonth(currentDate.getMonth() + 1);
                }

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
                    const isInRange = date >= dateRange.start && date <= dateRange.end;
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
                      isInRange,
                      sessions: sessionsOnDate,
                      isPackageStartDate,
                      isPackageEndDate,
                      packageEvents, // New field for multiple package events
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
                                day.isPackageStartDate || day.isPackageEndDate 
                                  ? 'border-purple-300 dark:border-purple-600' 
                                  : 'border-gray-100 dark:border-gray-700'
                              } ${
                                day.isCurrentMonth && day.isInRange
                                  ? 'bg-white dark:bg-gray-800'
                                  : 'bg-gray-50 dark:bg-gray-900'
                              } ${
                                day.sessions.length > 0 ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''
                              }`}
                              title={tooltipText}
                            >
                              {/* Day number */}
                              <div className={`text-sm font-medium ${
                                day.isCurrentMonth && day.isInRange
                                  ? 'text-gray-900 dark:text-white'
                                  : 'text-gray-400 dark:text-gray-600'
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

      {/* Custom Date Picker Modal */}
      {showCustomPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Custom Time Period</h3>
            
            {/* Filter Type Selection */}
            <div className="mb-6">
              <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <button
                  onClick={() => {
                    setFilterType('single');
                    setModalStartMonth('');
                    setModalEndMonth('');
                    setModalFilter('');
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    filterType === 'single'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Single Month
                </button>
                <button
                  onClick={() => {
                    setFilterType('range');
                    setModalFilter('');
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    filterType === 'range'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Date Range
                </button>
              </div>
            </div>

            {/* Single Month Selection */}
            {filterType === 'single' && (
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Select a historical month to analyze
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {availableMonths.map((month) => (
                    <button
                      key={`${month.name}-${month.year}`}
                      onClick={() => setModalFilter(month.value)}
                      className={`py-2.5 px-3 rounded-lg border transition-all text-sm font-medium ${
                        modalFilter === month.value
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-transparent hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-200 dark:hover:border-purple-700'
                      }`}
                    >
                      {month.displayName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date Range Selection */}
            {filterType === 'range' && (
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Select start and end months for comparison
                </p>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                      Start Month
                    </label>
                    <select
                      value={modalStartMonth}
                      onChange={(e) => {
                        setModalStartMonth(e.target.value);
                        // Reset end month if it's before the new start month
                        if (modalEndMonth) {
                          const startIndex = availableMonths.findIndex(m => m.value === e.target.value);
                          const endIndex = availableMonths.findIndex(m => m.value === modalEndMonth);
                          if (endIndex < startIndex) {
                            setModalEndMonth('');
                          }
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                    >
                      <option value="">Choose start month</option>
                      {availableMonths.map((month) => (
                        <option key={`start-${month.name}-${month.year}`} value={month.value}>
                          {month.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                      End Month
                    </label>
                    <select
                      value={modalEndMonth}
                      onChange={(e) => setModalEndMonth(e.target.value)}
                      disabled={!modalStartMonth}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Choose end month</option>
                      {availableMonths
                        .filter((month) => {
                          if (!modalStartMonth) return false;
                          const startMonthIndex = availableMonths.findIndex(m => m.value === modalStartMonth);
                          const currentMonthIndex = availableMonths.findIndex(m => m.value === month.value);
                          return currentMonthIndex >= startMonthIndex;
                        })
                        .map((month) => (
                          <option key={`end-${month.name}-${month.year}`} value={month.value}>
                            {month.displayName}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                
                {modalStartMonth && modalEndMonth && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>
                        Selected: {modalStartMonth} {modalStartMonth === modalEndMonth ? '' : `to ${modalEndMonth}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Preview & Actions */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCustomPicker(false);
                    setModalFilter('');
                    setModalStartMonth('');
                    setModalEndMonth('');
                    setFilterType('single');
                  }}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (filterType === 'single' && modalFilter) {
                      setSelectedFilter(modalFilter);
                    } else if (filterType === 'range' && modalStartMonth && modalEndMonth) {
                      const customFilter = modalEndMonth === modalStartMonth ? modalStartMonth : `${modalStartMonth} - ${modalEndMonth}`;
                      setSelectedFilter(customFilter);
                    }
                    setShowCustomPicker(false);
                    setModalFilter('');
                    setModalStartMonth('');
                    setModalEndMonth('');
                    setFilterType('single');
                  }}
                  disabled={
                    (filterType === 'single' && !modalFilter) ||
                    (filterType === 'range' && (!modalStartMonth || !modalEndMonth))
                  }
                  className="flex-1 px-4 py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 dark:disabled:bg-gray-600 transition-colors font-medium"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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