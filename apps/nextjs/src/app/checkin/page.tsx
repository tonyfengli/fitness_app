'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '~/trpc/react';

export default function CheckInPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [sessionName, setSessionName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [savedPhoneNumber, setSavedPhoneNumber] = useState<string | null>(null);
  const [savedUserName, setSavedUserName] = useState<string | null>(null);
  const [isReturningUser, setIsReturningUser] = useState(false);

  // Use the correct pattern - api() returns the trpc client
  const trpc = api();

  // Load saved user data on page load
  useEffect(() => {
    const savedPhone = localStorage.getItem('checkin_phone');
    const savedName = localStorage.getItem('checkin_name');
    
    if (savedPhone && savedName) {
      setSavedPhoneNumber(savedPhone);
      setSavedUserName(savedName);
      setIsReturningUser(true);
    }
  }, []);

  // Add TRPC mutation hook - using the pattern from circuit-sessions
  
  const checkInMutation = useMutation(
    trpc.trainingSession.checkInPublic.mutationOptions({
      onSuccess: (data) => {
        if (data.success) {
          const name = data.userName || 'User';
          setUserName(name);
          setSessionName(data.sessionName || '');
          setIsCheckedIn(true);
          
          // Save to localStorage for future visits
          if (data.phoneNumber) {
            localStorage.setItem('checkin_phone', data.phoneNumber);
            localStorage.setItem('checkin_name', name);
          }
        } else {
          // Handle backend errors (like no in-progress session)
          setErrorMessage(data.message || 'Check-in failed');
        }
      },
      onError: (error: any) => {
        setErrorMessage(error.message || 'Something went wrong');
      },
    })
  );


  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length <= 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  // Temporarily removed - will implement new approach

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    // Validate phone number (must have 10 digits)
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit phone number');
      return;
    }

    // Call the TRPC endpoint
    checkInMutation.mutate({
      phoneNumber: phoneNumber,
      // businessId will use the default from the backend
    });
  };

  const handleQuickCheckIn = () => {
    setErrorMessage('');
    if (savedPhoneNumber) {
      checkInMutation.mutate({
        phoneNumber: savedPhoneNumber,
        // businessId will use the default from the backend
      });
    }
  };

  const handleClearSavedInfo = () => {
    // Clear localStorage
    localStorage.removeItem('checkin_phone');
    localStorage.removeItem('checkin_name');
    
    // Reset state
    setIsReturningUser(false);
    setSavedPhoneNumber(null);
    setSavedUserName(null);
    setPhoneNumber('');
    setErrorMessage('');
  };

  if (isCheckedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          {/* Success Icon */}
          <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            You're Checked In{userName && `, ${userName}`}!
          </h1>
          
          {sessionName && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 mb-6">
              <p className="font-semibold text-blue-800 dark:text-blue-300">
                {sessionName}
              </p>
            </div>
          )}
          
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            Get ready for an amazing workout session
          </p>
        </div>
      </div>
    );
  }

  // Returning user flow - show welcome back with one-click check-in
  if (isReturningUser && savedUserName) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 dark:from-gray-900 dark:to-purple-900/20 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-2xl dark:shadow-purple-900/20 p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome Back, {savedUserName}!
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Ready to check in to today's session?
            </p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
              <p className="text-sm text-red-600 dark:text-red-400 text-center">
                {errorMessage}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleQuickCheckIn}
              disabled={checkInMutation.isPending}
              className={`w-full py-4 px-6 rounded-2xl font-semibold text-lg transition-all transform ${
                checkInMutation.isPending
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 dark:from-purple-600 dark:to-pink-600 text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] dark:shadow-purple-900/50'
              }`}
            >
              {checkInMutation.isPending ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Checking in...
                </span>
              ) : (
                'Check In Now'
              )}
            </button>

            <button
              onClick={handleClearSavedInfo}
              className="w-full py-3 px-6 rounded-2xl font-medium text-gray-600 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
            >
              Clear Saved Info
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 dark:from-gray-900 dark:to-purple-900/20 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl dark:shadow-2xl dark:shadow-purple-900/20 p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Check In to Session
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Enter your phone number
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <input
                type="tel"
                id="phone"
                value={phoneNumber}
                onChange={handlePhoneChange}
                placeholder="(555) 555-5555"
                className="block w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-purple-500 dark:focus:border-purple-500 transition-colors"
                required
                autoComplete="tel"
                inputMode="numeric"
                maxLength={14}
                autoFocus
              />
            </div>
          </div>

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-600 dark:text-red-400 text-center">
                {errorMessage}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={phoneNumber.replace(/\D/g, '').length !== 10}
            className={`w-full py-4 px-6 rounded-2xl font-semibold text-lg transition-all transform ${
              phoneNumber.replace(/\D/g, '').length !== 10
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 dark:from-purple-600 dark:to-pink-600 text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] dark:shadow-purple-900/50'
            }`}
          >
            {false ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking in...
              </span>
            ) : (
              'Check In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}