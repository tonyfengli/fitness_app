'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/trpc/react';
import { CircuitHeader } from '~/components/CircuitHeader';
import { Loader2Icon } from '@acme/ui-shared';
import { processFilterSelection, formatLongDate, formatShortDate, type WeekRange } from '~/utils/weekUtils';

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
  const trpc = api();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('2 Weeks');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartMonth, setCustomStartMonth] = useState('');
  const [customEndMonth, setCustomEndMonth] = useState('');
  
  // Unwrap the params Promise using React.use()
  const { clientId } = React.use(params);

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
    
    // Go back 12 months from current month
    for (let i = 0; i < 12; i++) {
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
    if (clientId === '4wnrsk1032vmhjxn5wl') {
      console.log('🔍 [Client 4wnrsk1032vmhjxn5wl] Calendar Page Debug Info:');
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
        
        console.log('📊 [Commitment Calculation]', {
          sessionsPerWeek: client.currentPackage.sessionsPerWeek,
          weekCount: weekCount,
          expectedSessions: client.attendance.expectedSessions,
          attendedSessions: client.attendance.attendedSessions,
          attendancePercentage: client.attendance.attendancePercentage,
          calculation: `${client.currentPackage.sessionsPerWeek} sessions/week × ${weekCount} weeks = ${client.attendance.expectedSessions} expected sessions`
        });
      }
      
      if (attendanceHistory) {
        console.log('📝 [Attendance History]', {
          totalSessions: attendanceHistory.length,
          sessionsInDateRange: attendanceHistory.filter(session => 
            session.scheduledAt && 
            session.scheduledAt >= dateRange.start && 
            session.scheduledAt <= dateRange.end
          ).length
        });
        
        attendanceHistory.forEach((session, index) => {
          const sessionDate = new Date(session.scheduledAt);
          const packageStartDate = client ? new Date(client.currentPackage.startDate) : null;
          const packageEndDate = client ? new Date(client.currentPackage.endDate) : null;
          
          console.log(`📅 [Session ${index + 1}]`, {
            date: session.scheduledAt?.toISOString(),
            dateFormatted: sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            name: session.sessionName,
            status: session.status,
            withinFilterRange: session.scheduledAt && 
              session.scheduledAt >= dateRange.start && 
              session.scheduledAt <= dateRange.end,
            withinPackageRange: packageStartDate && packageEndDate &&
              sessionDate >= packageStartDate && 
              sessionDate <= packageEndDate,
            afterPackageStart: packageStartDate && sessionDate >= packageStartDate,
            beforePackageEnd: packageEndDate && sessionDate <= packageEndDate
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
          backText="Back to Clients"
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
          backText="Back to Clients"
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
        onBack={() => router.push('/clients')}
        backText="Back to Clients"
        title={client.name}
        subtitle={`${packageData.name} • ${attendanceData.attendancePercentage}% attendance`}
      />

      <div className="px-4 py-6">
        {/* Time Filter */}
        <div className="mb-4 grid grid-cols-5 gap-1.5">
          {['October', 'November', '2 Weeks', '4 Weeks'].map((filter) => (
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
              !['October', 'November', '2 Weeks', '4 Weeks'].includes(selectedFilter)
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
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Attendance Calendar</h3>
          
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
                    
                    // Check if this date is the package start or end date
                    const packageStartDate = new Date(packageData.startDate);
                    const packageEndDate = new Date(packageData.endDate);
                    const isPackageStartDate = date.toDateString() === packageStartDate.toDateString();
                    const isPackageEndDate = date.toDateString() === packageEndDate.toDateString();
                    
                    calendarDays.push({
                      date,
                      dayNumber: isCurrentMonth ? dayNumber : '',
                      isCurrentMonth,
                      isInRange,
                      sessions: sessionsOnDate,
                      isPackageStartDate,
                      isPackageEndDate,
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
                              {day.isCurrentMonth && (day.isPackageStartDate || day.isPackageEndDate) && (
                                <div className="absolute top-1 right-1">
                                  {day.isPackageStartDate && (
                                    <div className="w-2 h-2 bg-purple-500 rounded-full" title="Package Start"></div>
                                  )}
                                  {day.isPackageEndDate && (
                                    <div className="w-2 h-2 bg-purple-700 rounded-full" title="Package End"></div>
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
              
              {/* Calendar Legend */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Legend</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Attended</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">No Show</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">2</div>
                    <span className="text-gray-600 dark:text-gray-400">Multiple Sessions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Package Start</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-700"></div>
                    <span className="text-gray-600 dark:text-gray-400">Package End</span>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>

      {/* Custom Date Picker Modal */}
      {showCustomPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Select Time Period</h3>
            
            {/* Single Month Selection */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Month (Historical)</p>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {availableMonths.map((month) => (
                  <button
                    key={`${month.name}-${month.year}`}
                    onClick={() => {
                      setSelectedFilter(month.value);
                      setShowCustomPicker(false);
                    }}
                    className="py-2.5 px-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-200 dark:hover:border-purple-700 border border-transparent transition-all text-gray-700 dark:text-gray-300 font-medium text-sm"
                  >
                    {month.displayName}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Select Date Range</p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    From
                  </label>
                  <select
                    value={customStartMonth}
                    onChange={(e) => setCustomStartMonth(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                  >
                    <option value="">Select start month</option>
                    {availableMonths.map((month) => (
                      <option key={`start-${month.name}-${month.year}`} value={month.value}>
                        {month.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    To
                  </label>
                  <select
                    value={customEndMonth}
                    onChange={(e) => setCustomEndMonth(e.target.value)}
                    disabled={!customStartMonth}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select end month</option>
                    {availableMonths
                      .filter((month) => {
                        if (!customStartMonth) return false;
                        // Find the start month in available months
                        const startMonthIndex = availableMonths.findIndex(m => m.value === customStartMonth);
                        const currentMonthIndex = availableMonths.findIndex(m => m.value === month.value);
                        // Only show months that are >= start month (later in the array since we reversed it)
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
              
              {customStartMonth && customEndMonth && (
                <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 mb-4">
                  <span className="text-sm text-purple-700 dark:text-purple-300">
                    Range: {customStartMonth} - {customEndMonth}
                  </span>
                  <button
                    onClick={() => {
                      const customFilter = customEndMonth === customStartMonth ? customStartMonth : `${customStartMonth} - ${customEndMonth}`;
                      setSelectedFilter(customFilter);
                      setShowCustomPicker(false);
                      setCustomStartMonth('');
                      setCustomEndMonth('');
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    Apply Range
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <button
              onClick={() => {
                setShowCustomPicker(false);
                setCustomStartMonth('');
                setCustomEndMonth('');
              }}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}