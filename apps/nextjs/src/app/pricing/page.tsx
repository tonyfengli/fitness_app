export default function PricingPage() {
  return (
    <div className="min-h-screen w-full bg-white text-slate-900 p-6 md:p-8 print:p-6 print:bg-white print:min-h-0 flex flex-col items-center justify-center">
      {/* Header */}
      <header className="text-center mb-4 print:mb-3 w-full max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 print:text-3xl">
          G1 Fitness Membership Pricing
        </h1>
      </header>

      <main className="w-full max-w-4xl">
        {/* Benefits Strip */}
        <div className="mb-6 print:mb-4 p-4 print:p-3 rounded-2xl border border-slate-200 bg-white shadow-sm print:shadow-none">
          <div className="grid grid-cols-3 gap-4 md:gap-8 justify-items-center">
            {/* Burn Fat */}
            <div className="flex items-center gap-2 print:gap-2">
              <div className="flex-shrink-0 w-9 h-9 print:w-8 print:h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 print:w-4 print:h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"></path>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm print:text-xs text-slate-800">Burn Fat</p>
                <p className="text-xs print:text-[10px] text-slate-500">Torch calories during + after</p>
              </div>
            </div>
            {/* Build Endurance */}
            <div className="flex items-center gap-2 print:gap-2">
              <div className="flex-shrink-0 w-9 h-9 print:w-8 print:h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 print:w-4 print:h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm print:text-xs text-slate-800">Build Endurance</p>
                <p className="text-xs print:text-[10px] text-slate-500">Boost cardio in less time</p>
              </div>
            </div>
            {/* Build Strength */}
            <div className="flex items-center gap-2 print:gap-2">
              <div className="flex-shrink-0 w-9 h-9 print:w-8 print:h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 print:w-4 print:h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm print:text-xs text-slate-800">Build Strength</p>
                <p className="text-xs print:text-[10px] text-slate-500">Power up every muscle</p>
              </div>
            </div>
          </div>
        </div>

        <section aria-label="Group Classes Pricing">
          <div className="flex items-center justify-center mb-4 print:mb-3">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent flex-1"></div>
            <h2 className="text-xl font-bold px-6 text-slate-800 print:text-lg">Group Classes</h2>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent flex-1"></div>
          </div>

          <div className="grid grid-cols-2 gap-6 print:gap-4">
            {/* 3x Per Week Plan */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none overflow-hidden">
              <div className="p-4 print:p-3 border-b border-slate-200">
                <h3 className="text-xl font-bold text-slate-900 print:text-lg">3x Per Week Plan</h3>
              </div>
              <div className="p-4 print:p-3 space-y-3 print:space-y-2">
                {/* 12-Month - MOST POPULAR */}
                <div className="flex items-center justify-between p-3 print:p-2.5 rounded-lg bg-amber-50 border-l-4 border-l-amber-500 border-y border-r border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 text-sm print:text-xs">12-Month Commitment</p>
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-amber-500 text-white rounded print:text-[8px]">
                        POPULAR
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600">$9 per session</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900 print:text-lg">$109</p>
                    <p className="text-[10px] text-slate-600">/month</p>
                  </div>
                </div>

                {/* 6-Month */}
                <div className="flex items-center justify-between p-3 print:p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-700 text-sm print:text-xs">6-Month Commitment</p>
                    <p className="text-[10px] text-slate-500">$10 per session</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900 print:text-lg">$119</p>
                    <p className="text-[10px] text-slate-500">/month</p>
                  </div>
                </div>

                {/* Month-to-Month */}
                <div className="flex items-center justify-between p-3 print:p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-700 text-sm print:text-xs">Month-to-Month</p>
                    <p className="text-[10px] text-slate-500">No commitment</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900 print:text-lg">$129</p>
                    <p className="text-[10px] text-slate-500">/month</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Unlimited Plan */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none overflow-hidden">
              <div className="p-4 print:p-3 border-b border-slate-200">
                <h3 className="text-xl font-bold text-slate-900 print:text-lg">Unlimited Plan</h3>
              </div>
              <div className="p-4 print:p-3 space-y-3 print:space-y-2">
                {/* 12-Month - MOST POPULAR */}
                <div className="flex items-center justify-between p-3 print:p-2.5 rounded-lg bg-amber-50 border-l-4 border-l-amber-500 border-y border-r border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 text-sm print:text-xs">12-Month Commitment</p>
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-amber-500 text-white rounded print:text-[8px]">
                        POPULAR
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900 print:text-lg">$129</p>
                    <p className="text-[10px] text-slate-600">/month</p>
                  </div>
                </div>

                {/* 6-Month */}
                <div className="flex items-center justify-between p-3 print:p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-700 text-sm print:text-xs">6-Month Commitment</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900 print:text-lg">$139</p>
                    <p className="text-[10px] text-slate-500">/month</p>
                  </div>
                </div>

                {/* Month-to-Month */}
                <div className="flex items-center justify-between p-3 print:p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-700 text-sm print:text-xs">Month-to-Month</p>
                    <p className="text-[10px] text-slate-500">No commitment</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900 print:text-lg">$149</p>
                    <p className="text-[10px] text-slate-500">/month</p>
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
