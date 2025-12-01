export default function PricingPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-white text-slate-900 p-6 md:p-10 print:p-4 print:bg-white print:min-h-0">
      {/* Header */}
      <header className="max-w-6xl mx-auto text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          G1 Fitness Membership Pricing
        </h1>
        <p className="text-lg md:text-xl text-slate-600 mt-2 font-medium">Group Classes</p>
      </header>

      {/* New Members Section */}
      <main className="max-w-6xl mx-auto">
        <section aria-label="New Members Pricing" className="mb-16">
          <div className="flex items-center justify-center mb-8">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent flex-1"></div>
            <h2 className="text-2xl font-bold px-6 text-slate-800">New Members</h2>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent flex-1"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* 2x per week */}
            <div className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all duration-300 hover:border-slate-300">
              <div className="p-8">
                <h3 className="text-xl font-bold text-slate-800 mb-6">2x Per Week</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-baseline">
                      <span className="text-5xl font-black text-slate-900">$128</span>
                      <span className="text-lg font-medium text-slate-500 ml-2">/ month</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <p className="text-base font-medium text-slate-700 flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      8 sessions per month
                    </p>
                    <p className="text-sm text-slate-500 pl-7">$16 per session average</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3x per week */}
            <div className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all duration-300 hover:border-slate-300">
              <div className="p-8">
                <h3 className="text-xl font-bold text-slate-800 mb-6">3x Per Week</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-baseline">
                      <span className="text-5xl font-black text-slate-900">$144</span>
                      <span className="text-lg font-medium text-slate-500 ml-2">/ month</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <p className="text-base font-medium text-slate-700 flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      12 sessions per month
                    </p>
                    <p className="text-sm text-slate-500 pl-7">$12 per session average</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Unlimited */}
            <div className="group relative rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-white to-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md">
                BEST VALUE
              </div>
              <div className="p-8">
                <h3 className="text-xl font-bold text-amber-900 mb-6">Unlimited</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-baseline">
                      <span className="text-5xl font-black text-amber-900">$180</span>
                      <span className="text-lg font-medium text-amber-700 ml-2">/ month</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-amber-100">
                    <p className="text-base font-medium text-amber-800 flex items-center">
                      <svg className="w-5 h-5 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      Unlimited sessions
                    </p>
                    <p className="text-sm text-amber-700 pl-7 font-medium">Train every day if you want!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional New Member Info */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 relative max-w-4xl mx-auto">
            <div className="absolute top-4 right-4 text-xs text-slate-400 italic font-medium bg-white px-2 py-1 rounded-full border border-slate-200">
              Internal Note
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2z"></path>
                  </svg>
                  Free Trial Class
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed">1 free trial class for all new members</p>
                <p className="text-xs text-slate-500 mt-1 italic">Can be extended to 1 week if needed to close</p>
              </div>
              
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Long-Term Commitment Discounts
                </h4>
                <p className="text-sm text-slate-700">% Discount: TBD</p>
                <p className="text-xs text-slate-500 mt-1 italic">Special rates for extended commitments coming soon</p>
              </div>
            </div>
          </div>
        </section>

        {/* Existing Members Section */}
        <section aria-label="Existing Members Pricing" className="mb-16">
          <div className="flex items-center justify-center mb-8">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent flex-1"></div>
            <h2 className="text-2xl font-bold px-6 text-slate-800">Existing H4H Members</h2>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent flex-1"></div>
          </div>
          
          <div className="rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-8 mb-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-200 rounded-full mb-4">
                <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900">Your Legacy Rates Are Protected</h3>
              <p className="text-slate-600 mt-2 text-lg">All current H4H members maintain their existing rates forever</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-slate-200">
                <h4 className="font-bold text-slate-800 text-lg mb-3">Cornerstone</h4>
                <div className="space-y-2">
                  <p className="text-4xl font-black text-slate-900">$96<span className="text-lg font-normal text-slate-500">/month</span></p>
                  <p className="text-sm text-slate-600 font-medium">2x per week</p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-slate-200 relative">
                <div className="absolute -top-3 -right-3 bg-gradient-to-br from-green-500 to-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md transform rotate-12 z-10">
                  FREE UPGRADE
                </div>
                <h4 className="font-bold text-slate-800 text-lg mb-3">Kingdom</h4>
                <div className="space-y-2">
                  <p className="text-4xl font-black text-slate-900">$120<span className="text-lg font-normal text-slate-500">/month</span></p>
                  <p className="text-sm text-slate-400 line-through">3x per week</p>
                  <p className="text-sm font-bold text-green-700 bg-green-50 rounded px-2 py-1 inline-block">Unlimited sessions</p>
                </div>
              </div>
            </div>
          </div>

          {/* Special Promotion */}
          <div className="relative rounded-3xl border-2 border-red-300 bg-gradient-to-br from-red-50 via-white to-white shadow-xl p-8 transform hover:scale-[1.01] transition-transform duration-300">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full text-sm font-black bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg">
              LIMITED TIME OFFER
            </div>
            <div className="text-center">
              <h3 className="text-3xl font-black text-red-900 mb-4">Special Launch Promotion</h3>
              <div className="inline-block bg-white rounded-2xl p-6 shadow-inner border border-red-200">
                <div className="text-6xl font-black text-red-700">$100
                  <span className="text-2xl font-bold text-red-600 block mt-2">per month for 3 months</span>
                </div>
              </div>
              <p className="text-xl text-red-800 font-bold mt-4 mb-6">Unlimited Sessions</p>
              <div className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-full font-bold">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Must commit before January 5, 2026
              </div>
            </div>
          </div>
        </section>

        {/* Referral Program Section */}
        <section aria-label="Referral Program" className="mb-16">
          <div className="flex items-center justify-center mb-8">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent flex-1"></div>
            <h2 className="text-2xl font-bold px-6 text-slate-800">Referral Program</h2>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent flex-1"></div>
          </div>
          
          <div className="max-w-3xl mx-auto">
            <div className="relative rounded-3xl bg-gradient-to-br from-amber-50 via-white to-white border-2 border-amber-300 p-8 shadow-lg overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-amber-200 rounded-full blur-3xl opacity-30"></div>
              <div className="relative text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-amber-900 mb-6">Earn Rewards for Sharing G1 Fitness</h3>
                <div className="bg-white rounded-2xl p-6 inline-block shadow-sm border border-amber-200">
                  <p className="text-lg text-amber-800 font-medium mb-3">Current H4H Members:</p>
                  <div className="text-4xl font-black text-amber-900">50% OFF</div>
                  <p className="text-lg text-amber-700 mt-2">one month of membership</p>
                  <p className="text-sm text-amber-600 mt-3 font-medium">for each new member you refer</p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}