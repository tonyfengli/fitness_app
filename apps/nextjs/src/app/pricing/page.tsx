export default function PricingPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-slate-50 text-slate-900 p-6 md:p-10 print:p-4 print:bg-white print:min-h-0">
      {/* Header (primary brand heading) */}
      <header className="max-w-5xl mx-auto text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Heart for the House Fitness</h1>
        <p className="text-lg md:text-xl text-slate-700 mt-1">October–December 2025</p>
      </header>

      {/* Pricing-first cards (directly under header) */}
      <main className="max-w-5xl mx-auto mb-10">
        <section aria-label="Pricing Plans" className="">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            {/* Foundation Builder */}
            <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="p-6">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="text-xl" aria-hidden>🧱</span>
                  <h2 className="text-lg font-semibold">Foundation Builder</h2>
                </div>

                <div className="mt-4">
                  <div className="text-6xl font-extrabold tracking-tight">$16
                    <span className="text-lg font-medium text-slate-500"> / session</span>
                  </div>
                  <p className="mt-2 text-slate-700">1 session per week</p>
                  <p className="mt-1 text-sm text-slate-500">$16/week → $64/month</p>
                </div>
              </div>
            </div>

            {/* Cornerstone Builder */}
            <div className="relative rounded-2xl border border-blue-200 bg-white shadow-sm ring-1 ring-blue-100">
              <div className="p-6">
                <div className="flex items-center gap-2 text-blue-700">
                  <span className="text-xl" aria-hidden>🪨</span>
                  <h2 className="text-lg font-semibold">Cornerstone Builder</h2>
                </div>

                <div className="mt-4">
                  <div className="text-6xl font-extrabold tracking-tight">$12
                    <span className="text-lg font-medium text-slate-500"> / session</span>
                  </div>
                  <p className="mt-2 text-slate-800">2 sessions per week</p>
                  <p className="mt-1 text-sm text-slate-500">$24/week → $96/month</p>
                </div>
              </div>
            </div>

            {/* Kingdom Builder */}
            <div className="relative rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-white shadow-lg ring-2 ring-amber-200 ring-offset-2">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md">Best Value</div>
              <div className="p-6">
                <div className="flex items-center gap-2 text-amber-700">
                  <span className="text-2xl" aria-hidden>👑</span>
                  <h2 className="text-xl font-bold">Kingdom Builder</h2>
                </div>

                <div className="mt-4">
                  <div className="text-6xl font-extrabold tracking-tight text-amber-700">$10
                    <span className="text-lg font-medium text-slate-600"> / session</span>
                  </div>
                  <p className="mt-2 text-slate-800 font-semibold">3 sessions per week</p>
                  <p className="mt-1 text-sm text-slate-600 font-medium">$30/week → $120/month</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Program Narrative Section with Mission Callout as headline */}
      <div className="max-w-3xl mx-auto mb-10 text-center">
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-4 text-blue-900">
          Every session contributes 100% to the Anaheim Church Building
        </h2>
        
        {/* Matching Donation Notice */}
        <div className="mb-6">
          <p className="text-base md:text-lg text-slate-800 font-medium">
            <span className="text-blue-700">✨</span> We'll match contributions dollar-for-dollar up to $15,000, doubling your impact! <span className="text-blue-700">✨</span>
          </p>
        </div>
        
        <p className="text-slate-700 text-base md:text-lg leading-relaxed">
          A focused 3-month program blending weights and cardio, designed to help you burn fat, feel stronger, and look leaner. Held in a private boutique studio, each session offers an intimate environment open to all fitness levels, led by Freedomhouse coaches. More than a workout, it's a chance to connect in faith and fellowship while building both body and spirit.
        </p>
      </div>

      {/* Schedule + Location (hierarchy #3) */}
      <div className="max-w-5xl mx-auto mb-6 print:mb-0">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="p-8 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="text-xl" aria-hidden>🕔</div>
                <h3 className="font-semibold text-lg">Class Schedule</h3>
              </div>
              <div className="space-y-4 pl-8">
                <div>
                  <div className="text-slate-900 font-semibold text-lg">5:00 – 6:00 AM</div>
                  <div className="text-slate-600">Monday • Wednesday • Friday</div>
                </div>
                <div>
                  <div className="text-slate-900 font-semibold text-lg">5:00 – 6:00 PM</div>
                  <div className="text-slate-600">Monday through Friday (All weekdays)</div>
                </div>
              </div>
            </div>
            <div className="p-8 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="text-xl" aria-hidden>📍</div>
                <h3 className="font-semibold text-lg">Studio Location</h3>
              </div>
              <div className="pl-8">
                <div className="text-slate-900 leading-relaxed">
                  3111 W. Lincoln Ave<br />
                  Anaheim, CA 92801
                </div>
                <div className="mt-3">
                  <a href="https://maps.google.com/?q=3111+W+Lincoln+Ave+Anaheim+CA+92801" 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1">
                    View on Google Maps
                    <span aria-hidden>→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}