'use client';

import React from 'react';
import Link from 'next/link';

export default function TrainerHomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Mobile-optimized header */}
      <div className="p-6 pb-0">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome Back
          </h1>
          <p className="text-purple-200 text-sm">
            Choose your focus for today
          </p>
        </div>
      </div>

      {/* Main content - full height mobile layout */}
      <div className="px-6 pb-6 flex flex-col justify-center" style={{ minHeight: 'calc(100vh - 140px)' }}>
        <div className="space-y-4 max-w-md mx-auto w-full">
          {/* Sessions Button */}
          <Link href="/circuit-sessions" className="block">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 p-8 shadow-2xl transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
              {/* Background decoration */}
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>
              
              {/* Content */}
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Sessions
                </h2>
                <p className="text-blue-100 text-sm">
                  Manage circuit and training sessions
                </p>
                <div className="mt-6 flex items-center text-white/80 text-sm">
                  <span>2 active today</span>
                  <svg className="w-5 h-5 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Clients Button */}
          <Link href="/clients" className="block">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 p-8 shadow-2xl transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
              {/* Background decoration */}
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl"></div>
              
              {/* Content */}
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Clients
                </h2>
                <p className="text-emerald-100 text-sm">
                  Track client progress and insights
                </p>
                <div className="mt-6 flex items-center text-white/80 text-sm">
                  <span>5 active clients</span>
                  <svg className="w-5 h-5 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Mobile-optimized footer */}
        <div className="mt-auto pt-8">
          <div className="text-center text-purple-300 text-xs">
            <p>Fitness Trainer App</p>
          </div>
        </div>
      </div>
    </div>
  );
}