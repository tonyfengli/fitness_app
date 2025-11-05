'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/trpc/react';
import { CircuitHeader } from '~/components/CircuitHeader';
import { Loader2Icon } from '@acme/ui-shared';
import { formatLongDate } from '~/utils/weekUtils';

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
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Price: </span>
                              <span className="font-medium text-gray-900 dark:text-white">${pkg.monthlyPrice}</span>
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
                <button className="flex-1 bg-purple-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors">
                  Change Package
                </button>
                <button className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-3 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  Cancel Package
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
    </div>
  );
}