export default function PricingPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-white text-slate-900 p-6 md:p-10 print:p-4 print:bg-white print:min-h-0">
      {/* Header */}
      <header className="max-w-5xl mx-auto text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          G1 Fitness Membership Pricing
        </h1>
      </header>

      <main className="max-w-5xl mx-auto">
        {/* Benefits Strip */}
        <div className="mb-10 p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-3 gap-4 md:gap-6 justify-items-center">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"></path>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">Cardio + Strength</p>
                <p className="text-xs text-slate-500">Full-body intervals</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">High Intensity</p>
                <p className="text-xs text-slate-500">Burn fat, build endurance</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">50 Minutes</p>
                <p className="text-xs text-slate-500">Get in, get results</p>
              </div>
            </div>
          </div>
        </div>

        <section aria-label="Group Classes Pricing" className="mb-16">
          <div className="flex items-center justify-center mb-10">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent flex-1"></div>
            <h2 className="text-2xl font-bold px-6 text-slate-800">Group Classes</h2>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent flex-1"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 3x Per Week Plan */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-slate-50 p-6 border-b border-slate-200">
                <h3 className="text-2xl font-bold text-slate-900">3x Per Week Plan</h3>
              </div>
              <div className="p-6 space-y-4">
                {/* Month-to-Month - Anchor price */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-700">Month-to-Month</p>
                    <p className="text-xs text-slate-500">No commitment</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900">$129</p>
                    <p className="text-xs text-slate-500">/month</p>
                  </div>
                </div>

                {/* 6-Month */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-semibold text-slate-700">6-Month Commitment</p>
                    <p className="text-xs text-slate-500">$10 per session</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900">$119</p>
                    <p className="text-xs text-slate-500">/month</p>
                  </div>
                </div>

                {/* 12-Month - MOST POPULAR */}
                <div className="relative flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/50 border-2 border-amber-400 shadow-sm">
                  <div className="absolute -top-3 left-4 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                    MOST POPULAR
                  </div>
                  <div>
                    <p className="font-semibold text-amber-900">12-Month Commitment</p>
                    <p className="text-xs text-amber-700">$9 per session</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-amber-900">$109</p>
                    <p className="text-xs text-amber-700">/month</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Unlimited Plan */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-slate-50 p-6 border-b border-slate-200">
                <h3 className="text-2xl font-bold text-slate-900">Unlimited Plan</h3>
              </div>
              <div className="p-6 space-y-4">
                {/* Month-to-Month - Anchor price */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-700">Month-to-Month</p>
                    <p className="text-xs text-slate-500">No commitment</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900">$149</p>
                    <p className="text-xs text-slate-500">/month</p>
                  </div>
                </div>

                {/* 6-Month - MOST POPULAR (target) */}
                <div className="relative flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/50 border-2 border-amber-400 shadow-sm">
                  <div className="absolute -top-3 left-4 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                    MOST POPULAR
                  </div>
                  <div>
                    <p className="font-semibold text-amber-900">6-Month Commitment</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-amber-900">$139</p>
                    <p className="text-xs text-amber-700">/month</p>
                  </div>
                </div>

                {/* 12-Month - Available but not highlighted */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-semibold text-slate-700">12-Month Commitment</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900">$129</p>
                    <p className="text-xs text-slate-500">/month</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
