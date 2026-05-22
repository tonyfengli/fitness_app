'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { authClient } from '~/auth/client';

export default function TrainerHomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Fetch user session on component mount
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/get-session', {
          credentials: 'include',
          cache: 'no-store',
        });
        const sessionData = await response.json();
        if (sessionData?.user) {
          setUser(sessionData.user);
        } else {
          // If no session, redirect to login
          router.push('/login');
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
        router.push('/login');
      }
    };

    fetchSession();
  }, [router]);


  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authClient.signOut();
      await queryClient.invalidateQueries({ queryKey: ['auth-session'] });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Show loading state while checking authentication
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
          <p className="mt-4 text-white/80">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Cohesive top navigation bar */}
      <div className="p-6 pb-0">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-8">
          <div className="flex items-center justify-between">
            {/* User profile section */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-xl rounded-xl flex items-center justify-center shadow-lg border border-white/20">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                {/* Online indicator */}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900 shadow-lg">
                  <div className="w-full h-full bg-emerald-400 rounded-full animate-pulse"></div>
                </div>
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  {user?.name || user?.email || 'Trainer'}
                </p>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="group relative overflow-hidden px-5 py-2.5 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/0 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center space-x-2">
                {isLoggingOut ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="text-sm font-medium text-white/80">Signing out...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-white/70 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors duration-300">
                      Sign out
                    </span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main content - reduced spacing */}
      <div className="px-6 pb-6">
        <div className="space-y-4 max-w-md mx-auto w-full">
          {/* Sessions Button */}
          <Link href="/circuit-sessions" className="block">
            <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-8 hover:bg-white/20 hover:border-white/30 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]">
              {/* Background decoration */}
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              {/* Content */}
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500/30 to-purple-500/30 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-4 border border-white/20 group-hover:border-white/30 transition-all duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Sessions
                </h2>
                <p className="text-white/70 text-sm">
                  Manage circuit and training sessions
                </p>
                <div className="mt-6 flex items-center justify-end">
                  <svg className="w-5 h-5 text-white/60 group-hover:text-white/80 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Clients Button */}
          <Link href="/clients" className="block">
            <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-8 hover:bg-white/20 hover:border-white/30 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]">
              {/* Background decoration */}
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              {/* Content */}
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/30 to-teal-500/30 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-4 border border-white/20 group-hover:border-white/30 transition-all duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Clients
                </h2>
                <p className="text-white/70 text-sm">
                  Track client progress and insights
                </p>
                <div className="mt-6 flex items-center justify-end">
                  <svg className="w-5 h-5 text-white/60 group-hover:text-white/80 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}