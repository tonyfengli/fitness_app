'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '~/trpc/react';
import { CircuitHeader } from '~/components/CircuitHeader';
import { Loader2Icon } from '@acme/ui-shared';
import { formatLongDate } from '~/utils/weekUtils';
import { OptionsDrawer } from '~/components/workout/OptionsDrawer';

interface PackageManagementPageProps {
  params: Promise<{
    clientId: string;
  }>;
}

// Helper function to get package status badge
function getPackageStatusBadge(startDate: string, endDate: string) {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (now < start) {
    return { label: 'Upcoming', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' };
  } else if (now >= start && now <= end) {
    return { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' };
  } else {
    return { label: 'Expired', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' };
  }
}

// Helper function to calculate days remaining
function getDaysRemaining(endDate: string) {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Helper function to calculate progress percentage
function getPackageProgress(startDate: string, endDate: string) {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (now < start) return 0;
  if (now > end) return 100;
  
  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  return Math.round((elapsed / total) * 100);
}

export default function PackageManagementPage({ params }: PackageManagementPageProps) {
  const router = useRouter();
  const { clientId } = React.use(params);
  const trpc = api();
  
  // Drawer state
  const [showChangePackageDrawer, setShowChangePackageDrawer] = useState(false);
  
  // Cancel dialog state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  
  // Change package form state
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [transitionDate, setTransitionDate] = useState<string>('');

  // Get available training packages
  const { data: availablePackages } = useQuery({
    ...trpc.business.getTrainingPackages.queryOptions(),
    enabled: showChangePackageDrawer,
  });

  // Generate Monday options for the selector
  const generateMondayOptions = () => {
    const options = [];
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Find this week's Monday
    const thisWeekMonday = new Date(today);
    const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // Sunday = 6 days from Monday
    thisWeekMonday.setDate(today.getDate() - daysFromMonday);
    
    // Generate past Mondays (8 weeks back)
    for (let i = 8; i >= 1; i--) {
      const monday = new Date(thisWeekMonday);
      monday.setDate(thisWeekMonday.getDate() - (i * 7));
      const dateStr = monday.toISOString().split('T')[0];
      const isPast = monday < today;
      
      options.push({
        value: dateStr,
        label: i === 1 ? 'Last Monday' : `${i} weeks ago`,
        date: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        isPast: true,
        isRecent: i <= 2
      });
    }
    
    // Add this week's Monday
    const thisMonday = new Date(thisWeekMonday);
    const thisMondayStr = thisMonday.toISOString().split('T')[0];
    const isThisMondayPast = thisMonday < today;
    
    options.push({
      value: thisMondayStr,
      label: isThisMondayPast ? 'This Monday (past)' : 'This Monday',
      date: thisMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      isPast: isThisMondayPast,
      isToday: currentDayOfWeek === 1 && 
        thisMonday.toDateString() === today.toDateString()
    });
    
    // Generate future Mondays (12 weeks forward)
    for (let i = 1; i <= 12; i++) {
      const monday = new Date(thisWeekMonday);
      monday.setDate(thisWeekMonday.getDate() + (i * 7));
      const dateStr = monday.toISOString().split('T')[0];
      
      options.push({
        value: dateStr,
        label: i === 1 ? 'Next Monday' : `${i} weeks ahead`,
        date: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        isPast: false,
        isRecommended: i === 1 || i === 2 // Next 2 Mondays are recommended
      });
    }
    
    return options;
  };
  
  const mondayOptions = useMemo(() => generateMondayOptions(), []);
  
  // Reset form when drawer opens/closes
  useEffect(() => {
    if (showChangePackageDrawer) {
      // Set default to next Monday - calculate it directly
      const today = new Date();
      const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysUntilNextMonday = currentDayOfWeek === 0 ? 1 : (8 - currentDayOfWeek) % 7;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + daysUntilNextMonday);
      setTransitionDate(nextMonday.toISOString().split('T')[0]);
    } else {
      // Reset form when drawer closes
      setSelectedPackageId('');
      setTransitionDate('');
    }
  }, [showChangePackageDrawer]);
  
  // Try to get client data from route state first
  const [clientFromState, setClientFromState] = useState<any>(null);
  const [shouldFallbackToAPI, setShouldFallbackToAPI] = useState(false);
  const [stateChecked, setStateChecked] = useState(false);
  
  useEffect(() => {
    // Check if we have client data from route state
    if (typeof window !== 'undefined' && window.history.state?.state?.client) {
      setClientFromState(window.history.state.state.client);
      setShouldFallbackToAPI(false);
    } else {
      // No route state data, need to fallback to API
      setShouldFallbackToAPI(true);
    }
    setStateChecked(true);
  }, []);
  
  // Memoize dates to prevent recreating on every render
  const { startDate, endDate } = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 14); // 2 weeks back
    const end = new Date();
    end.setDate(end.getDate() + 14); // 2 weeks forward
    return { startDate: start, endDate: end };
  }, []);
  
  const queryOptions = trpc.clients.getClientsWithPackages.queryOptions({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    weekCount: 4
  });
  
  const { data: clientData, isLoading: isLoadingFromAPI, error: apiError, status: queryStatus } = useQuery({
    ...queryOptions,
    enabled: shouldFallbackToAPI && stateChecked, // Only fetch if we need fallback and have checked state
  });

  // Change package mutation
  const changePackageMutation = useMutation(
    trpc.clients.changeUserPackage.mutationOptions({
      onSuccess: () => {
        // Refetch client data to show updated packages
        window.location.reload(); // Simple reload to show updated data
      },
      onError: (error: any) => {
        alert(`Failed to change package: ${error.message || 'Unknown error'}`);
      },
    })
  );

  // Cancel package mutation
  const cancelPackageMutation = useMutation(
    trpc.clients.cancelUserPackage.mutationOptions({
      onSuccess: () => {
        setShowCancelDialog(false);
        window.location.reload(); // Simple reload to show updated data
      },
      onError: (error: any) => {
        alert(`Failed to cancel package: ${error.message || 'Unknown error'}`);
      },
    })
  );
  
  // Handle form submission
  const handleApplyPackageChange = () => {
    if (!selectedPackageId || !transitionDate || !currentPackage) return;
    
    const transition = new Date(transitionDate);
    // Use the current package's end date
    const endDate = new Date(currentPackage.endDate);
    
    changePackageMutation.mutate({
      userId: clientId,
      newPackageId: selectedPackageId,
      transitionDate: transition,
      newEndDate: endDate,
    });
    
    setShowChangePackageDrawer(false);
  };

  // Handle form cancellation
  const handleCancelPackageChange = () => {
    setShowChangePackageDrawer(false);
  };

  // Handle package cancellation
  const handleCancelPackage = () => {
    cancelPackageMutation.mutate({ userId: clientId });
  };

  // Use client from state if available, otherwise from API
  const client = clientFromState || clientData?.find(c => c.id === clientId);
  const isLoading = !stateChecked || (!clientFromState && shouldFallbackToAPI && isLoadingFromAPI);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2Icon className="w-8 h-8 animate-spin text-purple-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading package information...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50">
        <CircuitHeader
          onBack={() => router.push(`/clients/${clientId}`)}
          backText="Back to Client"
          title="Package Management"
          subtitle="Client not found"
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

  // Get current package
  const currentPackage = client.currentPackage;
  
  // Get all packages (from allPackages if available, otherwise just current)
  const allPackages = (client as any).allPackages || (currentPackage ? [currentPackage] : []);
  
  // Sort packages by start date
  const sortedPackages = allPackages.sort((a: any, b: any) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-blue-50">
      <CircuitHeader
        onBack={() => router.push(`/clients/${clientId}`)}
        backText="Back to Client"
        title="Package Management"
        subtitle={client.name}
      />

      <div className="px-4 py-6 space-y-6">
        {/* Package History - Always shown */}
        {sortedPackages.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Packages</h2>
              <p className="text-gray-600 dark:text-gray-400">All packages and transitions</p>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {sortedPackages.map((pkg: any, index: number) => {
                  const status = getPackageStatusBadge(pkg.startDate, pkg.endDate);
                  const isCurrentPackage = pkg.id === currentPackage?.id;
                  
                  return (
                    <div 
                      key={pkg.id || index}
                      className={`border rounded-lg p-4 transition-all ${
                        isCurrentPackage 
                          ? 'border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20' 
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{pkg.packageName || pkg.name}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                              {status.label}
                            </span>
                            {isCurrentPackage && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Sessions: </span>
                              <span className="font-medium text-gray-900 dark:text-white">{pkg.sessionsPerWeek}x/week</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-600 dark:text-gray-400">Duration: </span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {formatLongDate(new Date(pkg.startDate))} → {formatLongDate(new Date(pkg.endDate))}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="px-6 pb-6">
              <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-gray-700">
                <button 
                  onClick={() => setShowChangePackageDrawer(true)}
                  disabled={changePackageMutation.isPending}
                  className="flex-1 bg-purple-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {changePackageMutation.isPending ? 'Changing...' : 'Change Package'}
                </button>
                <button 
                  onClick={() => setShowCancelDialog(true)}
                  disabled={cancelPackageMutation.isPending}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-3 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {cancelPackageMutation.isPending ? 'Cancelling...' : 'Cancel Package'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No Package State */}
        {!currentPackage && allPackages.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Active Package</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">This client doesn't have any training packages yet.</p>
            <button className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors">
              Create First Package
            </button>
          </div>
        )}
      </div>

      {/* Change Package Drawer */}
      <OptionsDrawer
        isOpen={showChangePackageDrawer}
        onClose={handleCancelPackageChange}
        customContent={
          <div className="h-full max-h-[70vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Change Package</h2>
              <button
                onClick={handleCancelPackageChange}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Package Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Select New Package
                </label>
                <div className="space-y-3">
                  {availablePackages?.filter(pkg => pkg.isActive && pkg.id !== currentPackage?.id).map((pkg) => (
                    <div
                      key={pkg.id}
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedPackageId === pkg.id
                          ? 'border-purple-500 bg-purple-50 dark:border-purple-400 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{pkg.name}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                            <span>{pkg.sessionsPerWeek}x per week</span>
                          </div>
                        </div>
                        {selectedPackageId === pkg.id && (
                          <div className="ml-3">
                            <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transition Date - Monday Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Transition Date (Mondays Only)
                </label>
                <div className={`relative transition-opacity ${
                  !selectedPackageId ? 'opacity-50' : ''
                }`}>
                  <select
                    value={transitionDate}
                    onChange={(e) => setTransitionDate(e.target.value)}
                    disabled={!selectedPackageId}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>Select a Monday...</option>
                    
                    {/* Past Mondays Section */}
                    <optgroup label="Past Mondays">
                      {mondayOptions.filter(opt => opt.isPast && opt.label !== 'This Monday (past)').map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} • {option.date}
                        </option>
                      ))}
                    </optgroup>
                    
                    {/* Current Week Monday */}
                    {mondayOptions.find(opt => opt.label.includes('This Monday')) && (
                      <optgroup label="This Week">
                        {mondayOptions
                          .filter(opt => opt.label.includes('This Monday'))
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label} • {option.date}
                              {option.isToday ? ' (today)' : ''}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    
                    {/* Future Mondays Section */}
                    <optgroup label="Future Mondays">
                      {mondayOptions.filter(opt => !opt.isPast && !opt.label.includes('This Monday')).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} • {option.date}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Transition Summary */}
              {selectedPackageId && transitionDate && currentPackage && (() => {
                const selectedOption = mondayOptions.find(opt => opt.value === transitionDate);
                const selectedPackageData = availablePackages?.find(pkg => pkg.id === selectedPackageId);
                return (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100">Transition Summary</h4>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-purple-700 dark:text-purple-300">New Package:</span>
                        <span className="font-medium text-purple-900 dark:text-purple-100">
                          {selectedPackageData?.name}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-purple-700 dark:text-purple-300">Starts:</span>
                        <span className="font-medium text-purple-900 dark:text-purple-100">
                          {selectedOption?.label} ({selectedOption?.date})
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-purple-700 dark:text-purple-300">Ends:</span>
                        <span className="font-medium text-purple-900 dark:text-purple-100">
                          {new Date(currentPackage.endDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer with Cancel/Apply buttons */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex gap-3">
                <button
                  onClick={handleCancelPackageChange}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyPackageChange}
                  disabled={!selectedPackageId || !transitionDate || !currentPackage || changePackageMutation.isPending}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {changePackageMutation.isPending ? 'Applying...' : 'Apply Changes'}
                </button>
              </div>
            </div>
          </div>
        }
      />

      {/* Cancel Package Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-full p-4 text-center">
            <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setShowCancelDialog(false)}></div>
            
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-auto">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Cancel Package?
              </h3>
              
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to cancel {client?.name}'s training package(s)? This will end all active packages at the end of this week and cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  disabled={cancelPackageMutation.isPending}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  No, Keep Package
                </button>
                <button
                  onClick={handleCancelPackage}
                  disabled={cancelPackageMutation.isPending}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {cancelPackageMutation.isPending ? 'Cancelling...' : 'Yes, Cancel Package'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}