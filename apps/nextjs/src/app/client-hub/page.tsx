'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ClientHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

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
          router.push('/login');
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
        router.push('/login');
      }
    };

    fetchSession();
  }, [router]);

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
      {/* Top nav with back button */}
      <div className="p-6 pb-0">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/trainer-home')}
              className="group flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all duration-300"
            >
              <svg className="w-4 h-4 text-white/70 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors duration-300">
                Back
              </span>
            </button>

            <p className="text-base font-semibold text-white">
              Client Hub
            </p>

            <div className="w-[76px]" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-6 pb-6">
        <div className="space-y-4 max-w-md mx-auto w-full">
          {/* Clients Button */}
          <Link href="/clients" className="block">
            <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-8 hover:bg-white/20 hover:border-white/30 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

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

          {/* Attendance Button */}
          <Link href="/attendance" className="block">
            <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-8 hover:bg-white/20 hover:border-white/30 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500/30 to-orange-500/30 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-4 border border-white/20 group-hover:border-white/30 transition-all duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Attendance
                </h2>
                <p className="text-white/70 text-sm">
                  Track session attendance
                </p>
                <div className="mt-6 flex items-center justify-end">
                  <svg className="w-5 h-5 text-white/60 group-hover:text-white/80 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Messages Button (dummy) */}
          <button type="button" className="block w-full text-left">
            <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-8 hover:bg-white/20 hover:border-white/30 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-pink-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-rose-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-500/30 to-rose-500/30 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-4 border border-white/20 group-hover:border-white/30 transition-all duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Messages
                </h2>
                <p className="text-white/70 text-sm">
                  Coming soon
                </p>
                <div className="mt-6 flex items-center justify-end">
                  <svg className="w-5 h-5 text-white/60 group-hover:text-white/80 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
