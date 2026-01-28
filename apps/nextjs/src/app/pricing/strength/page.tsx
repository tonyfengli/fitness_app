export default function StrengthPricingPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-white text-slate-900 p-6 md:p-10 print:p-4 print:bg-white print:min-h-0">
      {/* Header */}
      <header className="max-w-5xl mx-auto text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          G1 Strength Training Pricing
        </h1>
      </header>

      <main className="max-w-5xl mx-auto">
        {/* Benefits Strip */}
        <div className="mb-10 p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-3 gap-4 md:gap-6 justify-items-center">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">Small Groups</p>
                <p className="text-xs text-slate-500">Max 6 per session</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">Progress Driven</p>
                <p className="text-xs text-slate-500">Structured programming</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">Expert Coaching</p>
                <p className="text-xs text-slate-500">Form & technique</p>
              </div>
            </div>
          </div>
        </div>

        <section aria-label="Strength Training Pricing" className="mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Strength Add-On */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-slate-50 p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900">Strength Add-On</h3>
                  <span className="px-3 py-1 text-xs font-semibold bg-slate-200 text-slate-700 rounded-full">2x/week</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">For group class members</p>
              </div>
              <div className="p-6 space-y-4">
                {/* Single pricing option */}
                <div className="relative flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/50 border-2 border-amber-400 shadow-sm">
                  <div>
                    <p className="font-semibold text-amber-900">Monthly Add-On</p>
                    <p className="text-xs text-amber-700">Requires group class membership</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-amber-900">$80</p>
                    <p className="text-xs text-amber-700">/month</p>
                  </div>
                </div>

                {/* Requirements */}
                <div className="pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Requires group class membership</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Full access: Group classes + strength sessions</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Strength Training Only */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-slate-50 p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900">Strength Training Only</h3>
                  <span className="px-3 py-1 text-xs font-semibold bg-slate-200 text-slate-700 rounded-full">2x/week</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">Strength training exclusively</p>
              </div>
              <div className="p-6 space-y-4">
                {/* Month-to-Month - Anchor price */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-700">Month-to-Month</p>
                    <p className="text-xs text-slate-500">No commitment</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900">$180</p>
                    <p className="text-xs text-slate-500">/month</p>
                  </div>
                </div>

                {/* 4-Month - MOST POPULAR */}
                <div className="relative flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/50 border-2 border-amber-400 shadow-sm">
                  <div className="absolute -top-3 left-4 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                    MOST POPULAR
                  </div>
                  <div>
                    <p className="font-semibold text-amber-900">4-Month Commitment</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-amber-900">$160</p>
                    <p className="text-xs text-amber-700">/month</p>
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
