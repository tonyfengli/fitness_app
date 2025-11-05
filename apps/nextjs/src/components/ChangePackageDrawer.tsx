"use client";

import { useState, useEffect } from "react";
import { useQuery } from '@tanstack/react-query';
import { OptionsDrawer } from "~/components/workout/OptionsDrawer";
import { api } from "~/trpc/react";
import { Loader2Icon } from "@acme/ui-shared";

interface Package {
  id: string;
  name: string;
  sessionsPerWeek: number;
  monthlyPrice: string;
  isActive: boolean;
}

interface ChangePackageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  currentPackageId?: string;
  onPackageSelect: (packageId: string, transitionDate: Date, endDate: Date) => void;
}

export function ChangePackageDrawer({
  isOpen,
  onClose,
  clientId,
  clientName,
  currentPackageId,
  onPackageSelect,
}: ChangePackageDrawerProps) {
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [transitionDate, setTransitionDate] = useState<string>('');
  const [packageDuration, setPackageDuration] = useState<number>(1); // months
  const [step, setStep] = useState<'select' | 'dates'>('select');

  const trpc = api();

  // Get available training packages
  const { data: packages, isLoading } = useQuery({
    ...trpc.business.getTrainingPackages.queryOptions(),
    enabled: isOpen,
  });

  // Reset form when drawer opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPackageId('');
      setTransitionDate('');
      setPackageDuration(1);
      setStep('select');
    }
  }, [isOpen]);

  // Set default transition date to today
  useEffect(() => {
    if (isOpen && !transitionDate) {
      const today = new Date();
      setTransitionDate(today.toISOString().split('T')[0]);
    }
  }, [isOpen, transitionDate]);

  const selectedPackage = packages?.find(pkg => pkg.id === selectedPackageId);

  const handleContinue = () => {
    if (step === 'select' && selectedPackageId) {
      setStep('dates');
    } else if (step === 'dates') {
      const transition = new Date(transitionDate);
      const endDate = new Date(transition);
      endDate.setMonth(endDate.getMonth() + packageDuration);
      
      onPackageSelect(selectedPackageId, transition, endDate);
      onClose();
    }
  };

  const handleBack = () => {
    if (step === 'dates') {
      setStep('select');
    }
  };

  const availablePackages = packages?.filter(pkg => pkg.isActive && pkg.id !== currentPackageId) || [];

  const customContent = (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          {step === 'dates' && (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {step === 'select' ? 'Change Package' : 'Set Transition Date'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {step === 'select' ? `For ${clientName}` : 'When should the new package start?'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {step === 'select' && (
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2Icon className="w-8 h-8 animate-spin text-purple-600" />
                  <p className="text-gray-600 dark:text-gray-400">Loading packages...</p>
                </div>
              </div>
            ) : availablePackages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Available Packages</h3>
                <p className="text-gray-600 dark:text-gray-400">There are no other active packages to switch to.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-700 dark:text-gray-300 mb-4">Select a new training package:</p>
                {availablePackages.map((pkg) => (
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
                          <span>•</span>
                          <span>${pkg.monthlyPrice}/month</span>
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
            )}
          </div>
        )}

        {step === 'dates' && selectedPackage && (
          <div className="p-6 space-y-6">
            {/* Selected Package Summary */}
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                Selected Package
              </h3>
              <p className="text-purple-700 dark:text-purple-300">
                {selectedPackage.name} • {selectedPackage.sessionsPerWeek}x/week • ${selectedPackage.monthlyPrice}/month
              </p>
            </div>

            {/* Transition Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Transition Date
              </label>
              <input
                type="date"
                value={transitionDate}
                onChange={(e) => setTransitionDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                The new package will start on this date
              </p>
            </div>

            {/* Package Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Package Duration
              </label>
              <select
                value={packageDuration}
                onChange={(e) => setPackageDuration(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value={1}>1 month</option>
                <option value={2}>2 months</option>
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
              </select>
            </div>

            {/* End Date Preview */}
            {transitionDate && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Package will end on:</span>{' '}
                  {(() => {
                    const endDate = new Date(transitionDate);
                    endDate.setMonth(endDate.getMonth() + packageDuration);
                    return endDate.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    });
                  })()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={
              (step === 'select' && !selectedPackageId) ||
              (step === 'dates' && (!transitionDate || !packageDuration))
            }
            className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {step === 'select' ? 'Continue' : 'Change Package'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <OptionsDrawer
      isOpen={isOpen}
      onClose={onClose}
      customContent={customContent}
      fullScreen={true}
    />
  );
}