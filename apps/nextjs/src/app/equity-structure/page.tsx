"use client";

import React, { useState } from 'react';

export default function EquityStructurePage() {
  // State for equity pool allocations
  const [foundersBasePool, setFoundersBasePool] = useState(15);
  const [sweatEquityPool, setSweatEquityPool] = useState(35);
  const cashInvestmentPool = 100 - foundersBasePool - sweatEquityPool;

  // State for inputs - store as strings to handle formatting
  const [totalCapitalNeeded, setTotalCapitalNeeded] = useState(0);
  const [poolInvestmentAmount, setPoolInvestmentAmount] = useState(0);
  const [totalCapitalInput, setTotalCapitalInput] = useState('');
  const [poolInvestmentInput, setPoolInvestmentInput] = useState('');
  const [sweatEquityPercent, setSweatEquityPercent] = useState(3.5);
  const [profitPayout, setProfitPayout] = useState(40);
  const [simulationYears, setSimulationYears] = useState(5);
  const [preferSweatEquity, setPreferSweatEquity] = useState(true); // true = sweat equity, false = cash compensation
  
  // Financial projection state
  const [projectionStep, setProjectionStep] = useState(1); // 1-4 (steps + results)
  const [projectionYears, setProjectionYears] = useState(5);
  const [monthlyProfits, setMonthlyProfits] = useState<number[]>([2000, 4000, 6000, 8000, 10000]); // Monthly profits
  const [yearlyDistributions, setYearlyDistributions] = useState<number[]>([0, 50, 70, 100, 100]); // percentage distributed vs reinvested

  // Calculations
  const perFounderEquity = foundersBasePool / 5;
  const poolOwnership = totalCapitalNeeded > 0 ? (poolInvestmentAmount / totalCapitalNeeded) * 100 : 0;
  const actualEquityFromCash = (poolOwnership / 100) * cashInvestmentPool;
  const totalEquity = perFounderEquity + (preferSweatEquity ? sweatEquityPool / 5 : 0) + actualEquityFromCash;

  // ROI calculation
  const estimatedAnnualProfit = 50000;
  const growthRate = 1.15;
  let totalPayout = 0;
  
  for (let i = 1; i <= simulationYears; i++) {
    const yearProfit = estimatedAnnualProfit * Math.pow(growthRate, i - 1);
    const yearPayout = yearProfit * (profitPayout / 100) * (totalEquity / 100);
    totalPayout += yearPayout;
  }
  
  const roi = poolInvestmentAmount > 0 ? Math.round((totalPayout / poolInvestmentAmount) * 100) : 0;

  // Sweat equity calculations
  const maxSweatEquity = Math.min(sweatEquityPool, 15); // Can't allocate more than available or 15%

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // Parse number from formatted string
  const parseNumber = (str: string) => {
    return parseInt(str.replace(/,/g, '')) || 0;
  };

  // Handle input changes for capital needed
  const handleTotalCapitalChange = (value: string) => {
    console.log('handleTotalCapitalChange called with:', value);
    console.log('Current totalCapitalInput:', totalCapitalInput);
    // Allow user to type, update display immediately
    setTotalCapitalInput(value);
    // Parse and update numeric value for calculations
    const digitsOnly = value.replace(/\D/g, '');
    console.log('digitsOnly:', digitsOnly);
    setTotalCapitalNeeded(parseInt(digitsOnly) || 0);
  };

  // Handle input changes for investment amount
  const handlePoolInvestmentChange = (value: string) => {
    console.log('handlePoolInvestmentChange called with:', value);
    console.log('Current poolInvestmentInput:', poolInvestmentInput);
    // Allow user to type, update display immediately
    setPoolInvestmentInput(value);
    // Parse and update numeric value for calculations
    const digitsOnly = value.replace(/\D/g, '');
    console.log('digitsOnly:', digitsOnly);
    setPoolInvestmentAmount(parseInt(digitsOnly) || 0);
  };

  // Format inputs on blur
  const handleTotalCapitalBlur = () => {
    setTotalCapitalInput(formatNumber(totalCapitalNeeded));
  };

  const handlePoolInvestmentBlur = () => {
    setPoolInvestmentInput(formatNumber(poolInvestmentAmount));
  };

  // Update monthly profits when years change
  const updateProjectionYears = (years: number) => {
    setProjectionYears(years);
    const newProfits = [];
    const newDistributions = [];
    for (let i = 0; i < years; i++) {
      const defaultProfits = [2000, 4000, 6000, 8000, 10000];
      // Use existing value if it exists and we're within the current array length,
      // otherwise use default pattern or continue the 2k increment pattern
      if (i < monthlyProfits.length && monthlyProfits[i] !== undefined) {
        newProfits.push(monthlyProfits[i]);
      } else if (i < defaultProfits.length) {
        newProfits.push(defaultProfits[i]);
      } else {
        // Stay at 10k for all years beyond year 5
        newProfits.push(10000);
      }
      
      const defaultDistributions = [0, 50, 70, 100, 100];
      if (i < yearlyDistributions.length && yearlyDistributions[i] !== undefined) {
        newDistributions.push(yearlyDistributions[i]);
      } else if (i < defaultDistributions.length) {
        newDistributions.push(defaultDistributions[i]);
      } else {
        newDistributions.push(100);
      }
    }
    setMonthlyProfits(newProfits);
    setYearlyDistributions(newDistributions);
  };

  // Financial calculations
  const calculateProjections = () => {
    let totalPayoutToEquity = 0;
    let totalCashReturned = 0;
    
    for (let i = 0; i < projectionYears; i++) {
      const monthlyProfit = monthlyProfits[i] || 0;
      const yearProfit = monthlyProfit * 12; // Convert monthly to annual
      const distributionRate = yearlyDistributions[i] || 0;
      const distributedProfit = yearProfit * (distributionRate / 100);
      
      // Your share based on total equity
      const yourShare = distributedProfit * (totalEquity / 100);
      totalPayoutToEquity += yourShare;
      
      // Cash investment returns (separate calculation)
      if (poolInvestmentAmount > 0) {
        const cashPoolShare = distributedProfit * (actualEquityFromCash / 100);
        totalCashReturned += cashPoolShare;
      }
    }
    
    return {
      totalPayoutToEquity,
      totalCashReturned,
      roi: poolInvestmentAmount > 0 ? ((totalCashReturned / poolInvestmentAmount) * 100) : 0
    };
  };

  // Handle pool slider changes
  const handleFoundersChange = (value: number) => {
    if (value + sweatEquityPool > 100) {
      setSweatEquityPool(100 - value);
    }
    setFoundersBasePool(value);
  };

  const handleSweatChange = (value: number) => {
    if (value + foundersBasePool > 100) {
      setFoundersBasePool(100 - value);
    }
    setSweatEquityPool(value);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx global>{`
        /* Custom Slider Styles */
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
          width: 100%;
          height: 100%;
        }

        /* Track - Base styling */
        input[type="range"]::-webkit-slider-track {
          background: #e5e7eb;
          height: 8px;
          border-radius: 999px;
          border: none;
          outline: none;
        }

        input[type="range"]::-moz-range-track {
          background: #e5e7eb;
          height: 8px;
          border-radius: 999px;
          border: none;
          outline: none;
        }

        /* Custom track backgrounds with pseudo-elements */
        input[type="range"] {
          background: #e5e7eb;
          border-radius: 999px;
          height: 8px;
          outline: none;
        }

        .slider-blue {
          background: linear-gradient(to right, #3b82f6 0%, #3b82f6 var(--value), #e5e7eb var(--value), #e5e7eb 100%);
        }

        .slider-green {
          background: linear-gradient(to right, #10b981 0%, #10b981 var(--value), #e5e7eb var(--value), #e5e7eb 100%);
        }

        .slider-amber {
          background: linear-gradient(to right, #f59e0b 0%, #f59e0b var(--value), #e5e7eb var(--value), #e5e7eb 100%);
        }

        /* Thumb */
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: white;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          border: 3px solid currentColor;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
          margin-top: -8px;
        }

        input[type="range"]::-moz-range-thumb {
          appearance: none;
          background: white;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          border: 3px solid currentColor;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
          border: none;
        }

        input[type="range"]:hover::-webkit-slider-thumb {
          transform: scale(1.1);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        input[type="range"]:hover::-moz-range-thumb {
          transform: scale(1.1);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        /* Color specific thumbs */
        .slider-blue {
          color: #3b82f6;
        }

        .slider-green {
          color: #10b981;
        }

        .slider-amber {
          color: #f59e0b;
        }

        /* Input fields */
        input[type="text"]:focus,
        input[type="number"]:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        /* Smooth number transitions */
        .transition-number {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>


      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Calculator Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Visual Equity Split Display */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Equity Distribution</h2>
              
              {/* Circle Pie Chart Visualization */}
              <div className="mb-8 flex justify-center">
                <div className="relative">
                  <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
                    {/* Background circle */}
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="#f3f4f6"
                      strokeWidth="40"
                    />
                    {/* Founders Base Pool */}
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="40"
                      strokeDasharray={`${foundersBasePool * 5.03} 503`}
                      strokeDashoffset="0"
                      className="transition-all duration-700 ease-out"
                    />
                    {/* Sweat Equity Pool */}
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="40"
                      strokeDasharray={`${sweatEquityPool * 5.03} 503`}
                      strokeDashoffset={`-${foundersBasePool * 5.03}`}
                      className="transition-all duration-700 ease-out"
                    />
                    {/* Cash Investment Pool */}
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="40"
                      strokeDasharray={`${cashInvestmentPool * 5.03} 503`}
                      strokeDashoffset={`-${(foundersBasePool + sweatEquityPool) * 5.03}`}
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-800">100%</p>
                      <p className="text-xs text-gray-500">Equity</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pool Controls */}
              <div className="space-y-6">
                {/* Founders Base Pool */}
                <div className="bg-white p-6 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <h3 className="font-semibold text-gray-800">Founders Base Pool</h3>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 transition-number">
                      {foundersBasePool}%
                    </div>
                  </div>
                  <div className="relative h-12">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={foundersBasePool}
                      onChange={(e) => handleFoundersChange(parseInt(e.target.value))}
                      className="slider-blue"
                      style={{ '--value': `${foundersBasePool * 2}%` } as React.CSSProperties}
                    />
                  </div>
                  <div className="text-sm text-gray-500 mt-2 space-y-1">
                    <p className="font-medium">Each of 5 founders gets {perFounderEquity.toFixed(1)}% guaranteed equity</p>
                    <p>Founder will put in starting amount as the "buy-in"</p>
                  </div>
                </div>

                {/* Sweat Equity Pool */}
                <div className="bg-white p-6 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                      <h3 className="font-semibold text-gray-800">Sweat Equity Pool</h3>
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 transition-number">
                      {sweatEquityPool}%
                    </div>
                  </div>
                  <div className="relative h-12">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={sweatEquityPool}
                      onChange={(e) => handleSweatChange(parseInt(e.target.value))}
                      className="slider-green"
                      style={{ '--value': `${sweatEquityPool * 2}%` } as React.CSSProperties}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Performance-based equity for active contributors
                  </p>
                </div>

                {/* Cash Investment Pool */}
                <div className="bg-white p-6 rounded-xl shadow-sm opacity-75">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-amber-500 rounded"></div>
                      <h3 className="font-semibold text-gray-800">Cash Investment Pool</h3>
                    </div>
                    <div className="text-2xl font-bold text-amber-600 transition-number">
                      {cashInvestmentPool}%
                    </div>
                  </div>
                  <div className="relative h-12">
                    <div className="absolute inset-0 bg-gray-100 rounded-full"></div>
                    <div 
                      className="absolute inset-y-0 left-0 bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${cashInvestmentPool}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Automatically calculated (100% - Founders - Sweat)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Investment Calculator Section */}
          <div className="p-8 border-t bg-amber-50">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <span className="text-2xl">💰</span>
                Investment Calculator
              </h3>
              
              <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl shadow-lg p-8 space-y-8">
                  <div>
                    <label className="block text-lg font-semibold text-gray-800 mb-3">
                      Total Capital Needed for Cash Pool
                    </label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-xl z-10 pointer-events-none">$</span>
                      <input
                        type="text"
                        value={totalCapitalInput}
                        onChange={(e) => handleTotalCapitalChange(e.target.value)}
                        onBlur={handleTotalCapitalBlur}
                        className="relative z-20 w-full pl-10 pr-4 py-4 border-2 border-amber-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-300 text-2xl font-bold text-gray-800 bg-amber-50 hover:bg-amber-100"
                        placeholder="Enter amount"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"></div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200"></div>
                    <div className="relative flex justify-center">
                      <div className="bg-white px-4 py-2 rounded-full border-2 border-amber-200">
                        <span className="text-amber-600 font-medium">÷</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-lg font-semibold text-gray-800 mb-3">
                      Your Investment Amount
                    </label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-xl z-10 pointer-events-none">$</span>
                      <input
                        type="text"
                        value={poolInvestmentInput}
                        onChange={(e) => handlePoolInvestmentChange(e.target.value)}
                        onBlur={handlePoolInvestmentBlur}
                        className="relative z-20 w-full pl-10 pr-4 py-4 border-2 border-emerald-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all duration-300 text-2xl font-bold text-gray-800 bg-emerald-50 hover:bg-emerald-100"
                        placeholder="Enter amount"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Compensation Choice */}
          <div className="p-8 bg-gradient-to-br from-blue-50 to-green-50">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-3">
                  Choose Your Path
                </h3>
                <p className="text-gray-600">
                  Would you prefer cash compensation or sweat equity?
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8">
                {/* Toggle Switch */}
                <div className="flex items-center justify-center mb-8">
                  <div className="flex items-center gap-6">
                    {/* Cash Option */}
                    <div className={`text-center ${!preferSweatEquity ? 'opacity-100' : 'opacity-50'} transition-opacity`}>
                      <div className="text-2xl mb-1">💵</div>
                      <p className="font-medium text-gray-700">Cash</p>
                    </div>

                    {/* Toggle Switch */}
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={preferSweatEquity}
                        onChange={(e) => setPreferSweatEquity(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        onClick={() => setPreferSweatEquity(!preferSweatEquity)}
                        className={`w-16 h-8 rounded-full cursor-pointer transition-all duration-300 ${
                          preferSweatEquity ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 transform translate-y-1 ${
                            preferSweatEquity ? 'translate-x-9' : 'translate-x-1'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Equity Option */}
                    <div className={`text-center ${preferSweatEquity ? 'opacity-100' : 'opacity-50'} transition-opacity`}>
                      <div className="text-2xl mb-1">🚀</div>
                      <p className="font-medium text-gray-700">Equity</p>
                    </div>
                  </div>
                </div>

                {/* Selected Choice Display */}
                <div className="text-center p-6 rounded-xl bg-gradient-to-r from-blue-50 to-emerald-50">
                  <h4 className="text-lg font-bold text-gray-800 mb-2">
                    You chose: {preferSweatEquity ? '🚀 Sweat Equity' : '💵 Cash Compensation'}
                  </h4>
                  <p className="text-gray-600">
                    {preferSweatEquity 
                      ? `You'll earn ${(sweatEquityPool / 5).toFixed(1)}% additional equity through performance`
                      : "You'll receive cash compensation instead of performance equity"
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Equity Builder */}
          <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Your Personal Equity Breakdown</h3>
                <p className="text-gray-600">See how your total ownership is calculated across all equity sources</p>
              </div>
              
              {/* Total Equity Display */}
              <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                <div className="text-center">
                  <div className="inline-flex items-center gap-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full px-8 py-4 mb-4">
                    <span className="text-lg font-medium text-gray-700">Your Total Equity</span>
                    <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                      {totalEquity.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-gray-500">Combined from all equity sources below</p>
                </div>
              </div>

              {/* Simple Equity Breakdown */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="font-medium text-gray-700">Founder Base</span>
                    </div>
                    <span className="text-lg font-bold text-blue-600">{perFounderEquity.toFixed(1)}%</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                      <span className="font-medium text-gray-700">
                        {preferSweatEquity ? 'Sweat Equity' : 'Cash (No Equity)'}
                      </span>
                    </div>
                    <span className="text-lg font-bold text-emerald-600">
                      {preferSweatEquity ? (sweatEquityPool / 5).toFixed(1) : '0.0'}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                      <span className="font-medium text-gray-700">Investment</span>
                    </div>
                    <span className="text-lg font-bold text-amber-600">{actualEquityFromCash.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Projections Flow */}
          <div className="p-8 bg-gradient-to-br from-indigo-50 to-purple-50">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-3 flex items-center justify-center gap-2">
                  <span className="text-2xl">📊</span>
                  Financial Projections
                </h3>
                <p className="text-gray-600">
                  Project your returns over time with detailed year-by-year analysis
                </p>
              </div>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="max-w-md mx-auto">
                  <div className="relative flex items-center justify-between">
                    {/* Background line */}
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-0.5 bg-gray-200"></div>
                    </div>
                    
                    {/* Progress line */}
                    <div className="absolute inset-0 flex items-center">
                      <div 
                        className="h-0.5 bg-indigo-600 transition-all duration-500"
                        style={{ width: `${((projectionStep - 1) / 2) * 100}%` }}
                      ></div>
                    </div>
                    
                    {/* Step circles */}
                    {[1, 2, 3].map((step) => (
                      <div key={step} className="relative">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 border-2 ${
                          step <= projectionStep 
                            ? 'bg-indigo-600 text-white border-indigo-600' 
                            : 'bg-white text-gray-400 border-gray-200'
                        }`}>
                          {step}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step Content */}
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="relative min-h-96">
                  {/* Step 1: Number of Years */}
                  <div className={`${projectionStep === 1 ? 'block' : 'hidden'} p-8 space-y-8`}>
                    <div className="text-center">
                      <h4 className="text-xl font-bold text-gray-800 mb-4">How many years do you want to estimate?</h4>
                      <div className="max-w-md mx-auto">
                        <div className="text-6xl font-bold text-indigo-600 mb-6">{projectionYears}</div>
                        <input
                          type="range"
                          min="3"
                          max="15"
                          value={projectionYears}
                          onChange={(e) => updateProjectionYears(parseInt(e.target.value))}
                          className="w-full mb-6 slider-blue"
                          style={{ '--value': `${((projectionYears - 3) / 12) * 100}%` } as React.CSSProperties}
                        />
                        <div className="flex justify-between text-sm text-gray-500 mb-8">
                          <span>3 years</span>
                          <span>15 years</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <button
                        onClick={() => setProjectionStep(2)}
                        className="bg-indigo-600 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  {/* Step 2: Monthly Profits */}
                  <div className={`${projectionStep === 2 ? 'block' : 'hidden'} p-8 space-y-8`}>
                    <div>
                      <h4 className="text-xl font-bold text-gray-800 mb-6 text-center">Estimated monthly profits</h4>
                      <div className="space-y-2">
                        {Array.from({ length: projectionYears }, (_, i) => (
                          <div key={i} className="flex items-center gap-4 p-2">
                            <span className="font-medium text-gray-700 w-16">Year {i + 1}:</span>
                            <div className="flex-1 relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                              <input
                                type="text"
                                value={formatNumber(monthlyProfits[i] || 0)}
                                onChange={(e) => {
                                  const newProfits = [...monthlyProfits];
                                  newProfits[i] = parseNumber(e.target.value);
                                  setMonthlyProfits(newProfits);
                                }}
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-indigo-500"
                                placeholder="0"
                              />
                            </div>
                            <span className="text-sm text-gray-500">/month</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <button
                        onClick={() => setProjectionStep(1)}
                        className="bg-gray-500 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-gray-600 transition-colors shadow-lg"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setProjectionStep(3)}
                        className="bg-indigo-600 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  {/* Step 3: Distribution Rates */}
                  <div className={`${projectionStep === 3 ? 'block' : 'hidden'} p-8 space-y-8`}>
                    <div>
                      <h4 className="text-xl font-bold text-gray-800 mb-6 text-center">How much profit to distribute vs reinvest?</h4>
                      <div className="space-y-3">
                        {Array.from({ length: projectionYears }, (_, i) => (
                          <div key={i} className="flex items-center gap-4 p-2">
                            <span className="font-medium text-gray-700 w-16">Year {i + 1}:</span>
                            <div className="flex-1">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={yearlyDistributions[i] || 0}
                                onChange={(e) => {
                                  const newDistributions = [...yearlyDistributions];
                                  newDistributions[i] = parseInt(e.target.value);
                                  setYearlyDistributions(newDistributions);
                                }}
                                className="w-full slider-green"
                                style={{ '--value': `${yearlyDistributions[i] || 0}%` } as React.CSSProperties}
                              />
                            </div>
                            <span className="font-bold text-green-600 w-16">{yearlyDistributions[i] || 0}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <button
                        onClick={() => setProjectionStep(2)}
                        className="bg-gray-500 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-gray-600 transition-colors shadow-lg"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setProjectionStep(4)}
                        className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg"
                      >
                        See Results
                      </button>
                    </div>
                  </div>

                  {/* Step 4: Results */}
                  <div className={`${projectionStep === 4 ? 'block' : 'hidden'} p-8 space-y-8`}>
                    <div>
                      <div className="text-center mb-8">
                        <h4 className="text-xl font-bold text-gray-800 mb-6">Your {projectionYears}-Year Founder Journey</h4>
                        {(() => {
                          // Calculate total equity gains across all years
                          let totalEquityGains = 0;
                          for (let i = 0; i < projectionYears; i++) {
                            const monthlyProfit = monthlyProfits[i] || 0;
                            const annualProfit = monthlyProfit * 12;
                            const distributionRate = yearlyDistributions[i] || 0;
                            const distributedProfit = annualProfit * (distributionRate / 100);
                            const yourEquityShare = distributedProfit * (totalEquity / 100);
                            totalEquityGains += yourEquityShare;
                          }
                          
                          // Calculate total cash compensation if cash option is selected
                          const estimatedAnnualSalary = 60000; // Estimated annual salary
                          const totalCashCompensation = !preferSweatEquity ? estimatedAnnualSalary * projectionYears : 0;
                          
                          return (
                            <div className="max-w-2xl mx-auto mb-8">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* What You're Putting In */}
                                <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-100 rounded-2xl p-6">
                                  <div className="text-center">
                                    <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                      <span className="text-white text-xl">📤</span>
                                    </div>
                                    <h5 className="text-lg font-bold text-red-800 mb-3">Your Investment</h5>
                                    <div className="space-y-2">
                                      <div className="bg-white/60 rounded-lg p-3">
                                        <p className="text-sm text-red-600 font-medium">Time Commitment</p>
                                        <p className="text-lg font-bold text-red-800">{projectionYears} years of work</p>
                                      </div>
                                      {poolInvestmentAmount > 0 && (
                                        <div className="bg-white/60 rounded-lg p-3">
                                          <p className="text-sm text-red-600 font-medium">Cash Investment</p>
                                          <p className="text-lg font-bold text-red-800">${formatNumber(poolInvestmentAmount)}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* What You're Getting */}
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6">
                                  <div className="text-center">
                                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                      <span className="text-white text-xl">📈</span>
                                    </div>
                                    <h5 className="text-lg font-bold text-green-800 mb-3">Your Returns</h5>
                                    <div className="space-y-2">
                                      <div className="bg-white/60 rounded-lg p-3">
                                        <p className="text-sm text-green-600 font-medium">Average Yearly Returns</p>
                                        <p className="text-2xl font-bold text-green-800">${formatNumber(Math.round(totalEquityGains / projectionYears))}</p>
                                      </div>
                                      {!preferSweatEquity && (
                                        <div className="bg-white/60 rounded-lg p-3">
                                          <p className="text-sm text-green-600 font-medium">Cash Compensation</p>
                                          <p className="text-lg font-bold text-green-800">Separate payment</p>
                                        </div>
                                      )}
                                      <div className="bg-white/80 rounded-lg p-2 mt-3">
                                        <p className="text-xs text-green-600">Total over {projectionYears} years</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Founder Journey Table */}
                      <div className="space-y-4">
                        <h5 className="text-lg font-semibold text-gray-800 mb-4">Year-by-Year Breakdown</h5>
                        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                          <table className="w-full min-w-[600px]">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Year</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Monthly</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Annual</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Distributed</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Your Share</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {Array.from({ length: projectionYears }, (_, i) => {
                                const yearNum = i + 1;
                                const monthlyProfit = monthlyProfits[i] || 0;
                                const annualProfit = monthlyProfit * 12;
                                const distributionRate = yearlyDistributions[i] || 0;
                                const distributedProfit = annualProfit * (distributionRate / 100);
                                const yourEquityShare = distributedProfit * (totalEquity / 100);
                                
                                return (
                                  <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{yearNum}</td>
                                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">${formatNumber(monthlyProfit)}</td>
                                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">${formatNumber(annualProfit)}</td>
                                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">${formatNumber(Math.round(distributedProfit))}</td>
                                    <td className="px-4 py-3 font-semibold text-green-600 whitespace-nowrap">${formatNumber(Math.round(yourEquityShare))}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={() => setProjectionStep(3)}
                        className="bg-gray-500 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-gray-600 transition-colors shadow-lg"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setProjectionStep(1)}
                        className="bg-indigo-600 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg"
                      >
                        ↻
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}