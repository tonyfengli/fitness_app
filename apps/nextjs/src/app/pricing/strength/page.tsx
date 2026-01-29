export default function StrengthPricingPage() {
  return (
    <div className="min-h-screen w-full bg-white text-slate-900 p-6 md:p-8 print:p-6 print:bg-white print:min-h-0 flex flex-col items-center justify-center">
      {/* Header */}
      <header className="text-center mb-4 print:mb-3 w-full max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 print:text-3xl">
          G1 Strength Training Pricing
        </h1>
      </header>

      <main className="w-full max-w-4xl">
        {/* Benefits Strip */}
        <div className="mb-6 print:mb-4 p-4 print:p-3 rounded-2xl border border-slate-200 bg-white shadow-sm print:shadow-none">
          <div className="grid grid-cols-3 gap-4 md:gap-8 justify-items-center">
            {/* Build Bone Density */}
            <div className="flex items-center gap-2 print:gap-2">
              <div className="flex-shrink-0 w-9 h-9 print:w-8 print:h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 print:w-4 print:h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm print:text-xs text-slate-800">Build Bone Density</p>
                <p className="text-xs print:text-[10px] text-slate-500">Stronger bones for life</p>
              </div>
            </div>
            {/* Boost Metabolism */}
            <div className="flex items-center gap-2 print:gap-2">
              <div className="flex-shrink-0 w-9 h-9 print:w-8 print:h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 print:w-4 print:h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"></path>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm print:text-xs text-slate-800">Boost Metabolism</p>
                <p className="text-xs print:text-[10px] text-slate-500">Burn fat even at rest</p>
              </div>
            </div>
            {/* Build Muscle */}
            <div className="flex items-center gap-2 print:gap-2">
              <div className="flex-shrink-0 w-9 h-9 print:w-8 print:h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 print:w-4 print:h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm print:text-xs text-slate-800">Build Muscle</p>
                <p className="text-xs print:text-[10px] text-slate-500">Functional strength for everyday</p>
              </div>
            </div>
          </div>
        </div>

        <section aria-label="Strength Training Pricing">
          <div className="flex items-center justify-center mb-4 print:mb-3">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent flex-1"></div>
            <h2 className="text-xl font-bold px-6 text-slate-800 print:text-lg">Strength Training</h2>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent flex-1"></div>
          </div>

          <div className="grid grid-cols-2 gap-6 print:gap-4">
            {/* Strength Add-On */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none overflow-hidden">
              <div className="p-4 print:p-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900 print:text-lg">Strength Add-On</h3>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded print:text-[9px]">2x/week</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">For group class members</p>
              </div>
              <div className="p-4 print:p-3 space-y-3 print:space-y-2">
                {/* Single pricing option - highlighted as the only option */}
                <div className="flex items-center justify-between p-3 print:p-2.5 rounded-lg bg-amber-50 border-l-4 border-l-amber-500 border-y border-r border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm print:text-xs">Monthly Add-On</p>
                    <p className="text-[10px] text-slate-600">Requires group class membership</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900 print:text-lg">$80</p>
                    <p className="text-[10px] text-slate-600">/month</p>
                  </div>
                </div>

                {/* Requirements */}
                <div className="pt-2 space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-slate-600 print:text-[10px]">
                    <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Requires group class membership</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600 print:text-[10px]">
                    <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>Full access: Group classes + strength</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Strength Training Only */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none overflow-hidden">
              <div className="p-4 print:p-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900 print:text-lg">Strength Only</h3>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded print:text-[9px]">2x/week</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Strength training exclusively</p>
              </div>
              <div className="p-4 print:p-3 space-y-3 print:space-y-2">
                {/* 4-Month - MOST POPULAR (lowest price first) */}
                <div className="flex items-center justify-between p-3 print:p-2.5 rounded-lg bg-amber-50 border-l-4 border-l-amber-500 border-y border-r border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 text-sm print:text-xs">4-Month Commitment</p>
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-amber-500 text-white rounded print:text-[8px]">
                        POPULAR
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900 print:text-lg">$160</p>
                    <p className="text-[10px] text-slate-600">/month</p>
                  </div>
                </div>

                {/* Month-to-Month */}
                <div className="flex items-center justify-between p-3 print:p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-700 text-sm print:text-xs">Month-to-Month</p>
                    <p className="text-[10px] text-slate-500">No commitment</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900 print:text-lg">$180</p>
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
