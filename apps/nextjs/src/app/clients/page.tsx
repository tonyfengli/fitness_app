'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/trpc/react';
import { CircuitHeader } from '~/components/CircuitHeader';
import { Loader2Icon } from '@acme/ui-shared';
import { processFilterSelection, formatLongDate, getMostRecentCompleteMonth, type WeekRange } from '~/utils/weekUtils';


// Get progress bar color based on percentage
function getProgressColor(percentage: number) {
  if (percentage >= 80) return 'bg-emerald-500';
  if (percentage >= 60) return 'bg-yellow-500';
  if (percentage >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

// Get initials from name
function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
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
  
  // Inactive clients expansion state
  const [showInactiveClients, setShowInactiveClients] = useState(false);

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

  // Calculate week count
  const weekCount = useMemo(() => {
    // For explicit week filters, use the expected count instead of calculation
    if (selectedFilter === 'Last 2 Weeks') return 2;
    if (selectedFilter === 'Last 4 Weeks') return 4;
    
    // For all other filters (months, custom ranges), use the calculated week count
    // Since all ranges are adjusted to complete weeks, this should be accurate
    const durationMs = dateRange.end.getTime() - dateRange.start.getTime();
    const durationDays = durationMs / (24 * 60 * 60 * 1000);
    return Math.round(durationDays / 7);
  }, [dateRange, selectedFilter]);

  // Fetch clients data with their training packages
  const { data: clientsData, isLoading, error } = useQuery({
    ...trpc.clients.getClientsWithPackages.queryOptions({
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      weekCount: weekCount,
    }),
  });

  // Fetch inactive clients data
  const { data: inactiveClientsData, isLoading: isLoadingInactive } = useQuery({
    ...trpc.clients.getClientsWithInactivePackages.queryOptions(),
    enabled: showInactiveClients, // Only fetch when expanded
  });


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50">
        <CircuitHeader
          onBack={() => router.push('/trainer-home')}
          backText="Back"
          title="Clients"
          subtitle="Track client progress and insights"
        />
        <div className="flex items-center justify-center h-64">
          <Loader2Icon className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
      </div>
    );
  }

  // All clients returned already have packages and attendance data
  const clientsWithPackages = clientsData || [];
  
  // Filter clients based on search query and sort by attendance percentage (lowest first)
  const filteredClients = clientsWithPackages
    .filter(client =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.attendance.attendancePercentage - b.attendance.attendancePercentage);

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50 flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50">
      <CircuitHeader
        onBack={() => router.push('/trainer-home')}
        backText="Back"
        title="Clients"
        subtitle={`${clientsWithPackages.length} active clients`}
      />

      <div className="px-4 py-6">
        {/* Search Bar */}
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

        {/* Simple Date Range Display */}
        <div className="mb-6 text-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {formatLongDate(dateRange.start)} to {formatLongDate(dateRange.end)}
          </div>
        </div>

        {clientsWithPackages.length === 0 ? (
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
          <div className="space-y-4">
            {filteredClients.map((client) => {
              const initials = getInitials(client.name);
              
              // Use real package data and attendance (all clients here have packages and attendance)
              const packageData = client.currentPackage!; // Non-null assertion safe here
              const attendanceData = client.attendance;
              const stats = {
                commitment: packageData.sessionsPerWeek,
                attendedSessions: attendanceData.attendedSessions,
                totalSessions: attendanceData.expectedSessions,
                attendancePercentage: attendanceData.attendancePercentage,
              };
              
              const progressColor = getProgressColor(stats.attendancePercentage);

              return (
                <button
                  key={client.id}
                  onClick={() => {
                    router.push(`/clients/${client.id}?filter=${encodeURIComponent(selectedFilter)}`);
                  }}
                  className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm transition-all duration-200 cursor-pointer hover:shadow-lg active:scale-[0.98] transform overflow-hidden group"
                >
                  <div className="p-5">
                    <div className="flex items-center gap-4">
                      {/* Circled initials */}
                      <div className="relative">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-md">
                          <span className="text-white font-bold text-xl">{initials}</span>
                        </div>
                        {/* Small commitment badge */}
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-0.5">
                          <div className="bg-gray-600 dark:bg-gray-400 text-white dark:text-gray-900 text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center">
                            {stats.commitment}x
                          </div>
                        </div>
                      </div>

                      {/* Client info */}
                      <div className="flex-1 text-left">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">{client.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-2">
                          {stats.attendedSessions} of {stats.totalSessions} sessions
                        </p>
                        {/* Progress bar */}
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-500 ${progressColor}`}
                            style={{ width: `${stats.attendancePercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Progress percentage and chevron */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${
                            stats.attendancePercentage >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                            stats.attendancePercentage >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                            stats.attendancePercentage >= 40 ? 'text-orange-600 dark:text-orange-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {stats.attendancePercentage}%
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Inactive Clients Expandable Section */}
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
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50">
        <CircuitHeader
          onBack={() => {}}
          backText="Back"
          title="Clients"
          subtitle="Track client progress and insights"
        />
        <div className="flex items-center justify-center h-64">
          <Loader2Icon className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
      </div>
    }>
      <ClientsPageContent />
    </Suspense>
  );
}