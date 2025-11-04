'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/trpc/react';
import { CircuitHeader } from '~/components/CircuitHeader';
import { Loader2Icon } from '@acme/ui-shared';
import { processFilterSelection, formatLongDate, type WeekRange } from '~/utils/weekUtils';


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

export default function ClientsPage() {
  const router = useRouter();
  const trpc = api();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('2 Weeks');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartMonth, setCustomStartMonth] = useState('');
  const [customEndMonth, setCustomEndMonth] = useState('');

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
    
    console.log('Current date:', currentDate, 'Month index:', currentMonth, 'Year:', currentYear);
    
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
      
      console.log(`Month ${i}: ${monthName} ${year} (monthIndex: ${monthIndex})`);
      
      months.push({
        name: monthName,
        value: `${monthName} ${year}`,
        year: year,
        displayName: `${monthName} ${year}`
      });
    }
    
    console.log('Generated months:', months);
    
    // Reverse to show earliest to latest (oldest first)
    return months.reverse();
  }, []);

  // Calculate the adjusted date range for the selected filter
  const dateRange: WeekRange = useMemo(() => {
    const range = processFilterSelection(selectedFilter);
    console.log('Filter processed:', {
      selectedFilter,
      originalStart: range.originalStart,
      originalEnd: range.originalEnd,
      adjustedStart: range.start,
      adjustedEnd: range.end,
      wasAdjusted: range.wasAdjusted,
      weekCount: Math.ceil((range.end.getTime() - range.start.getTime()) / (7 * 24 * 60 * 60 * 1000))
    });
    return range;
  }, [selectedFilter]);

  // Fetch clients data with their training packages
  const { data: clientsData, isLoading } = useQuery({
    ...trpc.clients.getClientsWithPackages.queryOptions(),
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

  // Only include clients with active packages
  const clientsWithPackages = (clientsData || []).filter(client => client.currentPackage !== null);
  
  // Filter clients based on search query
  const filteredClients = clientsWithPackages.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              
              // Use real package data (all clients here have packages)
              const packageData = client.currentPackage!; // Non-null assertion safe here
              const stats = {
                commitment: packageData.sessionsPerWeek,
                attendedSessions: 0, // TODO: Calculate real attendance
                totalSessions: 0,    // TODO: Calculate based on time period
                attendancePercentage: 0, // TODO: Calculate real percentage
              };
              
              const progressColor = getProgressColor(stats.attendancePercentage);

              return (
                <button
                  key={client.id}
                  onClick={() => {
                    // TODO: Navigate to individual client page
                    console.log('Navigate to client:', client.id);
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