"use client";

import React, { useState, useEffect, useRef } from 'react';

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
  const [buyInAmount, setBuyInAmount] = useState<number | string | undefined>(0);
  const [buyInAmountInput, setBuyInAmountInput] = useState('');
  
  // Financial projection state
  const [projectionStep, setProjectionStep] = useState(1); // 1-4 (steps + results)
  const [projectionYears] = useState(5); // Fixed at 5 years
  const [monthlyProfits, setMonthlyProfits] = useState<(number | string | undefined)[]>([2000, 4000, 6000, 8000, 10000]); // Monthly profits
  const [yearlyDistributions, setYearlyDistributions] = useState<number[]>([50, 60, 70, 80, 80]); // percentage distributed vs reinvested
  const [isAdvancedMode, setIsAdvancedMode] = useState(true);
  
  // Advanced mode state
  const [groupClassPrices, setGroupClassPrices] = useState<(number | string | undefined)[]>([]);
  const [groupClassClients, setGroupClassClients] = useState<(number | string | undefined)[]>([]);
  const [semiPrivatePrices, setSemiPrivatePrices] = useState<(number | string | undefined)[]>([]);
  const [semiPrivateClients, setSemiPrivateClients] = useState<(number | string | undefined)[]>([]);
  const [operatingModes, setOperatingModes] = useState<boolean[]>([]); // true = studio, false = expansion per year
  const [operatingCosts, setOperatingCosts] = useState<(number | string | undefined)[]>([]);
  const [paidAdsCosts, setPaidAdsCosts] = useState<(number | string | undefined)[]>([]);
  const [groupCoachingCosts, setGroupCoachingCosts] = useState<number[]>([]);
  const [expandedCalculations, setExpandedCalculations] = useState<boolean[]>([]);
  const [expandedReviews, setExpandedReviews] = useState<boolean[]>([]);
  const [trainerSplits, setTrainerSplits] = useState<number[]>([50, 50, 50, 50, 50]); // percentage to trainer (business gets remainder)
  const [customWeeklySessions, setCustomWeeklySessions] = useState<(number | string | undefined)[]>([]); // custom weekly sessions for coaching cost calculation
  const [customCoachingRates, setCustomCoachingRates] = useState<(number | string | undefined)[]>([]); // custom coaching cost per session
  const [kyleSessions, setKyleSessions] = useState<(number | string | undefined)[]>([]); // Kyle weekly sessions
  const [kyleRates, setKyleRates] = useState<(number | string | undefined)[]>([]); // Kyle cost per session
  const [tonySessions, setTonySessions] = useState<(number | string | undefined)[]>([]); // Tony weekly sessions
  const [tonyRates, setTonyRates] = useState<(number | string | undefined)[]>([]); // Tony cost per session
  
  // Ref for auto-scrolling to Financial Projections section
  const financialProjectionsRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Auto-scroll to Financial Projections section when step changes (but not on initial load)
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    
    if (financialProjectionsRef.current && isAdvancedMode) {
      financialProjectionsRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, [projectionStep, isAdvancedMode]);

  // Update group coaching costs when group class clients change
  useEffect(() => {
    const newGroupCoachingCosts = [...groupCoachingCosts];
    let hasChanges = false;
    
    for (let i = 0; i < projectionYears; i++) {
      const calculatedCost = calculateGroupCoachingCost(Number(groupClassClients[i]) || 0, i);
      
      // Only update if user hasn't manually overridden this year's cost OR if it's currently 0  
      if (newGroupCoachingCosts[i] === undefined || newGroupCoachingCosts[i] === 0) {
        newGroupCoachingCosts[i] = calculatedCost;
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      setGroupCoachingCosts(newGroupCoachingCosts);
    }
  }, [groupClassClients, projectionYears]);

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
  
  const totalInvestment = poolInvestmentAmount + (Number(buyInAmount) || 0);
  const roi = totalInvestment > 0 ? Math.round((totalPayout / totalInvestment) * 100) : 0;

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
  
  // Format value for display in inputs (handles empty strings)
  const formatInputValue = (value: number | string | undefined, defaultValue?: number) => {
    if (value === '' || value === undefined) return '';
    if (typeof value === 'string') return value;
    return formatNumber(value);
  };

  // Calculate group coaching cost based on client count
  const calculateGroupCoachingCost = (clientCount: number, yearIndex?: number) => {
    let weeklySessions;
    
    // Use custom weekly sessions if available
    if (yearIndex !== undefined && customWeeklySessions[yearIndex] !== undefined && customWeeklySessions[yearIndex] !== '' && Number(customWeeklySessions[yearIndex]) > 0) {
      weeklySessions = Number(customWeeklySessions[yearIndex]);
    } else {
      if (clientCount === 0) weeklySessions = 0;
      else if (clientCount <= 20) weeklySessions = 7;
      else if (clientCount <= 30) weeklySessions = 10;
      else if (clientCount <= 50) weeklySessions = 15;
      else if (clientCount <= 70) weeklySessions = 22;
      else if (clientCount <= 90) weeklySessions = 28;
      else if (clientCount <= 120) weeklySessions = 35;
      else weeklySessions = 40;
    }
    
    // Get the cost per session (default $30 or custom if set)
    const costPerSession = (yearIndex !== undefined && customCoachingRates[yearIndex] !== undefined && customCoachingRates[yearIndex] !== '' && Number(customCoachingRates[yearIndex]) > 0) 
      ? Number(customCoachingRates[yearIndex]) 
      : 30;
    
    // Convert to monthly: weeklySessions * 4.33 weeks/month * costPerSession
    return Math.round(weeklySessions * 4.33 * costPerSession);
  };

  // Get calculation details for display
  const getCalculationDetails = (clientCount: number, yearIndex?: number) => {
    let weeklySessions;
    
    // Use custom weekly sessions if available
    if (yearIndex !== undefined && customWeeklySessions[yearIndex] !== undefined && customWeeklySessions[yearIndex] !== '' && Number(customWeeklySessions[yearIndex]) > 0) {
      weeklySessions = Number(customWeeklySessions[yearIndex]);
    } else {
      // Default calculation based on client count
      if (clientCount === 0) { weeklySessions = 0; }
      else if (clientCount <= 20) { weeklySessions = 7; }
      else if (clientCount <= 30) { weeklySessions = 10; }
      else if (clientCount <= 50) { weeklySessions = 15; }
      else if (clientCount <= 70) { weeklySessions = 22; }
      else if (clientCount <= 90) { weeklySessions = 28; }
      else if (clientCount <= 120) { weeklySessions = 35; }
      else { weeklySessions = 40; }
    }
    
    // Get the cost per session (default $30 or custom if set)
    const costPerSession = (yearIndex !== undefined && customCoachingRates[yearIndex] !== undefined && customCoachingRates[yearIndex] !== '' && Number(customCoachingRates[yearIndex]) > 0) 
      ? Number(customCoachingRates[yearIndex]) 
      : 30;
    
    const monthlySessionsRaw = weeklySessions * 4.33;
    const monthlySessions = Math.round(monthlySessionsRaw);
    const totalCost = Math.round(weeklySessions * 4.33 * costPerSession);
    
    return {
      clientCount,
      weeklySessions,
      monthlySessionsRaw,
      monthlySessions,
      costPerSession,
      totalCost
    };
  };

  // Handle input changes for capital needed
  const handleTotalCapitalChange = (value: string) => {
    // Allow user to type, update display immediately
    setTotalCapitalInput(value);
    // Parse and update numeric value for calculations
    const digitsOnly = value.replace(/\D/g, '');
    setTotalCapitalNeeded(parseInt(digitsOnly) || 0);
  };

  // Handle input changes for investment amount
  const handlePoolInvestmentChange = (value: string) => {
    // Allow user to type, update display immediately
    setPoolInvestmentInput(value);
    // Parse and update numeric value for calculations
    const digitsOnly = value.replace(/\D/g, '');
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
      
      const defaultDistributions = [50, 60, 70, 80, 80];
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
      roi: (poolInvestmentAmount + (Number(buyInAmount) || 0)) > 0 ? ((totalCashReturned / (poolInvestmentAmount + (Number(buyInAmount) || 0))) * 100) : 0
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


      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Calculator Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Visual Equity Split Display */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <div className="max-w-6xl mx-auto">
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
                  <div className="text-sm text-gray-500 mt-2">
                    <p className="font-medium">Each of 5 founders gets {perFounderEquity.toFixed(1)}% guaranteed equity</p>
                  </div>
                  
                  {/* Buy-in Amount Input */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Buy-in Amount per Founder</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input
                        type="text"
                        value={formatInputValue(buyInAmount, 0)}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            setBuyInAmount('');
                          } else {
                            setBuyInAmount(parseNumber(value));
                          }
                        }}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1 mt-2">
                      <p className="text-xs text-gray-500">Total buy-in from all founders: ${formatNumber((Number(buyInAmount) || 0) * 5)}</p>
                      {Number(buyInAmount) > 0 && perFounderEquity > 0 && (
                        <p className="text-xs font-medium text-gray-700">
                          ${formatNumber(Math.round(Number(buyInAmount) / perFounderEquity))} per 1% equity
                        </p>
                      )}
                    </div>
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
          <div className="p-8 border-t bg-gray-50">
            <div className="max-w-6xl mx-auto">
              <h3 className="text-xl font-semibold text-gray-800 mb-6">
                Investment Calculator
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Capital Needed
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="text"
                      value={totalCapitalInput}
                      onChange={(e) => handleTotalCapitalChange(e.target.value)}
                      onBlur={handleTotalCapitalBlur}
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="Enter amount"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Investment Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="text"
                      value={poolInvestmentInput}
                      onChange={(e) => handlePoolInvestmentChange(e.target.value)}
                      onBlur={handlePoolInvestmentBlur}
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="Enter amount"
                    />
                  </div>
                </div>
              </div>
              
              {/* Investment Metrics */}
              {totalCapitalNeeded > 0 && (
                <div className="mt-6">
                  <div className="bg-white p-4 rounded-lg border border-gray-200 max-w-xs">
                    <p className="text-xs font-medium text-gray-500 uppercase">Price per 1% Equity</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      ${formatNumber(Math.round(totalCapitalNeeded / cashInvestmentPool))}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>


          {/* Personal Equity Builder */}
          <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Your Personal Equity Breakdown</h3>
              </div>
              
              {/* Total Equity Display */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-center mb-6">
                  <span className="text-lg font-medium text-gray-700">Your Total Equity</span>
                  <div className="text-4xl font-bold text-blue-600 mt-2">
                    {totalEquity.toFixed(1)}%
                  </div>
                </div>

                {/* Simple Equity Breakdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">Founder Base</span>
                    </div>
                    <span className="text-sm font-medium text-blue-600">{perFounderEquity.toFixed(1)}%</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">
                        {preferSweatEquity ? 'Sweat Equity' : 'Cash (No Equity)'}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-emerald-600">
                      {preferSweatEquity ? (sweatEquityPool / 5).toFixed(1) : '0.0'}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">Investment</span>
                    </div>
                    <span className="text-sm font-medium text-amber-600">{actualEquityFromCash.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Projections Flow */}
          <div ref={financialProjectionsRef} className="p-8 bg-gradient-to-br from-indigo-50 to-purple-50">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-3 flex items-center justify-center gap-2">
                  <span className="text-2xl">📊</span>
                  Financial Projections
                </h3>
              </div>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="max-w-2xl mx-auto">
                  <div className="relative flex items-center justify-between">
                    {/* Background line */}
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-0.5 bg-gray-200"></div>
                    </div>
                    
                    {/* Progress line */}
                    <div className="absolute inset-0 flex items-center">
                      <div 
                        className="h-0.5 bg-indigo-600 transition-all duration-500"
                        style={{ 
                          width: isAdvancedMode 
                            ? `${((projectionStep - 1) / 6) * 100}%` 
                            : `${((projectionStep - 1) / 2) * 100}%` 
                        }}
                      ></div>
                    </div>
                    
                    {/* Step circles */}
                    {(isAdvancedMode ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3]).map((step) => (
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

                  {/* Step 1: Monthly Profits (Simple Mode Only) */}
                  <div className={`${projectionStep === 1 && !isAdvancedMode ? 'block' : 'hidden'} p-8 space-y-8`}>
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
                                value={monthlyProfits[i] !== undefined ? formatInputValue(monthlyProfits[i]) : ''}
                                onChange={(e) => {
                                  const newProfits = [...monthlyProfits];
                                  while (newProfits.length <= i) newProfits.push(undefined);
                                  newProfits[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
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
                    <div className="flex justify-center">
                      <button
                        onClick={() => setProjectionStep(2)}
                        className="bg-indigo-600 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  {/* Step 2 (Simple Mode) or Step 5 (Advanced Mode): Distribution Rates */}
                  <div className={`${(projectionStep === 2 && !isAdvancedMode) || (projectionStep === 5 && isAdvancedMode) ? 'block' : 'hidden'} p-8 space-y-8`}>
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
                        onClick={() => setProjectionStep(isAdvancedMode ? 4 : 1)}
                        className="bg-gray-500 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-gray-600 transition-colors shadow-lg"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setProjectionStep(isAdvancedMode ? 6 : 3)}
                        className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg"
                      >
                        Review
                      </button>
                    </div>
                  </div>

                  {/* Advanced Mode Steps 2-6 (Placeholders) */}
                  {isAdvancedMode && (
                    <>
                      {/* Step 1: Group Classes */}
                      <div className={`${projectionStep === 1 ? 'block' : 'hidden'} p-8 space-y-8`}>
                        <div>
                          <h4 className="text-xl font-bold text-gray-800 mb-2 text-center">Group Classes</h4>
                          <p className="text-gray-600 text-center mb-6 text-sm">Set pricing and member capacity for your group fitness classes</p>
                          
                          <div className="space-y-3">
                            {Array.from({ length: projectionYears }, (_, i) => {
                              // Initialize arrays if needed
                              if (groupClassPrices.length <= i) {
                                const newPrices = [...groupClassPrices];
                                const newClients = [...groupClassClients];
                                
                                // Default pricing: Year 1 ($120), Year 2-3 ($130), Year 4-5 ($140)
                                const defaultPrices = [120, 130, 130, 140, 140];
                                // Default clients: 30, 50, 70, 90, 100
                                const defaultClients = [30, 50, 70, 90, 100];
                                
                                while (newPrices.length <= i) {
                                  const yearIndex = newPrices.length;
                                  newPrices.push(defaultPrices[yearIndex] || 140);
                                }
                                while (newClients.length <= i) {
                                  const yearIndex = newClients.length;
                                  newClients.push(defaultClients[yearIndex] || 100);
                                }
                                setGroupClassPrices(newPrices);
                                setGroupClassClients(newClients);
                              }
                              
                              const monthlyRevenue = (Number(groupClassPrices[i]) || 0) * (Number(groupClassClients[i]) || 0);
                              
                              // Get coaching cost details for this year
                              const coachingCost = calculateGroupCoachingCost(Number(groupClassClients[i]) || 0, i);
                              const coachingDetails = getCalculationDetails(Number(groupClassClients[i]) || 0, i);
                              const isCoachingExpanded = expandedCalculations[i] || false;

                              return (
                                <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2 border border-gray-200">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-gray-700">Year {i + 1}</div>
                                    {monthlyRevenue > 0 && (
                                      <div className="text-sm font-semibold text-green-600">
                                        ${formatNumber(monthlyRevenue)}/mo
                                      </div>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium text-gray-600">Monthly Price</label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                        <input
                                          type="text"
                                          value={groupClassPrices[i] !== undefined ? formatInputValue(groupClassPrices[i]) : '150'}
                                          onChange={(e) => {
                                            const newPrices = [...groupClassPrices];
                                            while (newPrices.length <= i) newPrices.push(undefined);
                                            newPrices[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                            setGroupClassPrices(newPrices);
                                          }}
                                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500"
                                          placeholder="150"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium text-gray-600">Clients</label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">#</span>
                                        <input
                                          type="text"
                                          value={groupClassClients[i] !== undefined ? formatInputValue(groupClassClients[i]) : '100'}
                                          onChange={(e) => {
                                            const newClients = [...groupClassClients];
                                            while (newClients.length <= i) newClients.push(undefined);
                                            newClients[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                            setGroupClassClients(newClients);
                                          }}
                                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500"
                                          placeholder="50"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Group Coaching Cost - Larger & More Prominent */}
                                  <button
                                    onClick={() => {
                                      const newExpanded = [...expandedCalculations];
                                      newExpanded[i] = !isCoachingExpanded;
                                      setExpandedCalculations(newExpanded);
                                    }}
                                    className="w-full flex items-center justify-between pt-2 mt-2 border-t-2 border-gray-200 hover:bg-gray-50 transition-colors rounded px-2 py-2 -mx-1"
                                  >
                                    <span className="text-sm font-medium text-gray-600">Coaching Cost:</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-base text-gray-800 font-bold">${formatNumber(coachingCost)}</span>
                                      <svg 
                                        className={`w-4 h-4 transition-transform text-gray-500 ${isCoachingExpanded ? 'rotate-180' : ''}`}
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </button>
                                  
                                  {/* Calculation Details - Redesigned */}
                                  {isCoachingExpanded && (
                                    <div className="mt-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                                      <div className="space-y-4">
                                        {/* Input Section */}
                                        <div className="grid grid-cols-2 gap-3">
                                          {/* Weekly Sessions Input */}
                                          <div className="bg-white rounded-lg p-3 border border-blue-100">
                                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                              Weekly Sessions
                                            </label>
                                            <div className="relative">
                                              <input
                                                type="text"
                                                value={customWeeklySessions[i] !== undefined ? customWeeklySessions[i] : coachingDetails.weeklySessions}
                                                onChange={(e) => {
                                                  const newSessions = [...customWeeklySessions];
                                                  while (newSessions.length <= i) newSessions.push(undefined);
                                                  newSessions[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                                  setCustomWeeklySessions(newSessions);
                                                  // Force recalculation of group coaching cost
                                                  const newCosts = [...groupCoachingCosts];
                                                  newCosts[i] = calculateGroupCoachingCost(Number(groupClassClients[i]) || 0, i);
                                                  setGroupCoachingCosts(newCosts);
                                                }}
                                                className="w-full px-3 py-2 text-sm font-medium border border-gray-200 rounded-md focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none transition-colors"
                                                placeholder={coachingDetails.weeklySessions.toString()}
                                              />
                                              <div className="absolute -right-2 -top-2 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                                #
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {/* Cost per Session Input */}
                                          <div className="bg-white rounded-lg p-3 border border-blue-100">
                                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                              Rate per Session
                                            </label>
                                            <div className="relative">
                                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                              <input
                                                type="text"
                                                value={customCoachingRates[i] !== undefined ? customCoachingRates[i] : coachingDetails.costPerSession}
                                                onChange={(e) => {
                                                  const newRates = [...customCoachingRates];
                                                  while (newRates.length <= i) newRates.push(undefined);
                                                  newRates[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                                  setCustomCoachingRates(newRates);
                                                  // Force recalculation of group coaching cost
                                                  const newCosts = [...groupCoachingCosts];
                                                  newCosts[i] = calculateGroupCoachingCost(Number(groupClassClients[i]) || 0, i);
                                                  setGroupCoachingCosts(newCosts);
                                                }}
                                                className="w-full pl-8 pr-3 py-2 text-sm font-medium border border-gray-200 rounded-md focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none transition-colors"
                                                placeholder="30"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Calculation Breakdown */}
                                        <div className="bg-white/70 backdrop-blur rounded-lg p-3 space-y-2">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">Monthly Sessions</span>
                                            <span className="text-base font-medium text-gray-900">
                                              {Math.round((customWeeklySessions[i] !== undefined && customWeeklySessions[i] !== '' ? Number(customWeeklySessions[i]) : coachingDetails.weeklySessions) * 4.33)}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">Monthly Cost</span>
                                            <span className="text-base font-medium text-gray-900">
                                              {Math.round((customWeeklySessions[i] !== undefined && customWeeklySessions[i] !== '' ? Number(customWeeklySessions[i]) : coachingDetails.weeklySessions) * 4.33)} × ${customCoachingRates[i] !== undefined && customCoachingRates[i] !== '' ? customCoachingRates[i] : coachingDetails.costPerSession}
                                            </span>
                                          </div>
                                          <div className="pt-2 border-t border-gray-200">
                                            <div className="flex items-center justify-between">
                                              <span className="text-base font-medium text-gray-700">Total Monthly</span>
                                              <span className="text-xl font-bold text-blue-600">
                                                ${formatNumber(calculateGroupCoachingCost(Number(groupClassClients[i]) || 0, i))}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <button
                            onClick={() => setProjectionStep(2)}
                            className="bg-indigo-600 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg"
                          >
                            →
                          </button>
                        </div>
                      </div>

                      {/* Step 3: Semi-Private Classes (moved from step 2) */}
                      <div className={`${projectionStep === 3 && isAdvancedMode ? 'block' : 'hidden'} p-8 space-y-8`}>
                        <div>
                          <h4 className="text-xl font-bold text-gray-800 mb-2 text-center">Semi-Private Classes</h4>
                          <p className="text-gray-600 text-center mb-6 text-sm">Set pricing and client capacity for your semi-private training sessions</p>
                          
                          <div className="space-y-3">
                            {Array.from({ length: projectionYears }, (_, i) => {
                              // Initialize arrays if needed
                              if (semiPrivatePrices.length <= i) {
                                const newPrices = [...semiPrivatePrices];
                                const newClients = [...semiPrivateClients];
                                const newSplits = [...trainerSplits];
                                
                                // Default pricing: $300 for all years
                                // Default clients: Start at 10, increase by 5 per year (10, 15, 20, 25, 30)
                                const defaultPrice = 300;
                                const defaultClients = [10, 15, 20, 25, 30];
                                
                                while (newPrices.length <= i) {
                                  newPrices.push(defaultPrice);
                                }
                                while (newClients.length <= i) {
                                  const yearIndex = newClients.length;
                                  newClients.push(defaultClients[yearIndex] || (10 + yearIndex * 5));
                                }
                                while (newSplits.length <= i) newSplits.push(50);
                                setSemiPrivatePrices(newPrices);
                                setSemiPrivateClients(newClients);
                                setTrainerSplits(newSplits);
                              }
                              
                              const monthlyRevenue = (Number(semiPrivatePrices[i]) || 0) * (Number(semiPrivateClients[i]) || 0);
                              const trainerSplit = trainerSplits[i] !== undefined ? trainerSplits[i] : 50;
                              
                              return (
                                <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2 border border-gray-200">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-gray-700">Year {i + 1}</div>
                                    {monthlyRevenue > 0 && (
                                      <div className="text-sm font-semibold text-green-600">
                                        ${formatNumber(monthlyRevenue)}/mo
                                      </div>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[0.64rem] font-medium text-gray-600">Monthly Price</label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                        <input
                                          type="text"
                                          value={semiPrivatePrices[i] !== undefined ? formatInputValue(semiPrivatePrices[i]) : ''}
                                          onChange={(e) => {
                                            const newPrices = [...semiPrivatePrices];
                                            while (newPrices.length <= i) newPrices.push(undefined);
                                            newPrices[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                            setSemiPrivatePrices(newPrices);
                                          }}
                                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500"
                                          placeholder="300"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium text-gray-600">Clients</label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">#</span>
                                        <input
                                          type="text"
                                          value={semiPrivateClients[i] !== undefined ? formatInputValue(semiPrivateClients[i]) : ''}
                                          onChange={(e) => {
                                            const newClients = [...semiPrivateClients];
                                            while (newClients.length <= i) newClients.push(undefined);
                                            newClients[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                            setSemiPrivateClients(newClients);
                                          }}
                                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500"
                                          placeholder="20"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium text-gray-600">% to Trainer</label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                        <input
                                          type="text"
                                          value={trainerSplit}
                                          onChange={(e) => {
                                            // Allow only digits and limit to 3 characters max
                                            const rawValue = e.target.value.replace(/\D/g, '').slice(0, 3);
                                            
                                            const newSplits = [...trainerSplits];
                                            while (newSplits.length <= i) newSplits.push(50);
                                            
                                            if (rawValue === '') {
                                              // Allow empty input
                                              newSplits[i] = '';
                                            } else {
                                              const value = parseInt(rawValue);
                                              const clampedValue = Math.min(100, Math.max(0, value));
                                              newSplits[i] = clampedValue;
                                            }
                                            setTrainerSplits(newSplits);
                                          }}
                                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500"
                                          placeholder="50"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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
                            className="bg-indigo-600 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg"
                          >
                            →
                          </button>
                        </div>
                      </div>

                      {/* Step 4: Kyle & Tony Contribution */}
                      <div className={`${projectionStep === 4 && isAdvancedMode ? 'block' : 'hidden'} p-8 space-y-8`}>
                        <div>
                          <h4 className="text-xl font-bold text-gray-800 mb-2 text-center">Contribution from Owner Trainers</h4>
                          <p className="text-gray-600 text-center mb-6 text-sm">Tony & Kyle teaching classes instead of hiring external coaches</p>
                          
                          <div className="space-y-3">
                            {Array.from({ length: projectionYears }, (_, i) => {
                              // Initialize arrays if needed
                              if (kyleSessions.length <= i) {
                                const newKyleSessions = [...kyleSessions];
                                const newKyleRates = [...kyleRates];
                                const newTonySessions = [...tonySessions];
                                const newTonyRates = [...tonyRates];
                                
                                // Defaults: Kyle 3 sessions @ $30, Tony 3 sessions @ $30
                                while (newKyleSessions.length <= i) newKyleSessions.push(3);
                                while (newKyleRates.length <= i) newKyleRates.push(30);
                                while (newTonySessions.length <= i) newTonySessions.push(3);
                                while (newTonyRates.length <= i) newTonyRates.push(30);
                                
                                setKyleSessions(newKyleSessions);
                                setKyleRates(newKyleRates);
                                setTonySessions(newTonySessions);
                                setTonyRates(newTonyRates);
                              }
                              
                              const kyleWeeklySessions = Number(kyleSessions[i]) || 3;
                              const kyleRatePerSession = Number(kyleRates[i]) || 30;
                              const kyleMonthlyContribution = Math.round(kyleWeeklySessions * 4.33 * kyleRatePerSession);
                              
                              const tonyWeeklySessions = Number(tonySessions[i]) || 3;
                              const tonyRatePerSession = Number(tonyRates[i]) || 30;
                              const tonyMonthlyContribution = Math.round(tonyWeeklySessions * 4.33 * tonyRatePerSession);
                              
                              const totalMonthlyContribution = kyleMonthlyContribution + tonyMonthlyContribution;
                              
                              return (
                                <div key={i} className="p-4 bg-gray-50 rounded-lg space-y-4 border border-gray-200">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-gray-700">Year {i + 1}</div>
                                    {totalMonthlyContribution > 0 && (
                                      <div className="text-sm font-semibold text-green-600">
                                        ${formatNumber(totalMonthlyContribution)}/mo saved
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Kyle Section */}
                                  <div className="space-y-2">
                                    <div className="text-sm font-medium text-gray-700">Kyle</div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-600">Weekly Sessions</label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">#</span>
                                          <input
                                            type="text"
                                            value={kyleSessions[i] !== undefined ? formatInputValue(kyleSessions[i]) : '3'}
                                            onChange={(e) => {
                                              const newSessions = [...kyleSessions];
                                              while (newSessions.length <= i) newSessions.push(undefined);
                                              newSessions[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                              setKyleSessions(newSessions);
                                            }}
                                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500"
                                            placeholder="3"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-600">Cost per Session</label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                          <input
                                            type="text"
                                            value={kyleRates[i] !== undefined ? formatInputValue(kyleRates[i]) : '30'}
                                            onChange={(e) => {
                                              const newRates = [...kyleRates];
                                              while (newRates.length <= i) newRates.push(undefined);
                                              newRates[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                              setKyleRates(newRates);
                                            }}
                                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500"
                                            placeholder="30"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    {kyleMonthlyContribution > 0 && (
                                      <div className="text-xs text-gray-500">
                                        ${formatNumber(kyleMonthlyContribution)}/mo ({kyleWeeklySessions} × 4.33 × ${kyleRatePerSession})
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Tony Section */}
                                  <div className="space-y-2">
                                    <div className="text-sm font-medium text-gray-700">Tony</div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-600">Weekly Sessions</label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">#</span>
                                          <input
                                            type="text"
                                            value={tonySessions[i] !== undefined ? formatInputValue(tonySessions[i]) : '3'}
                                            onChange={(e) => {
                                              const newSessions = [...tonySessions];
                                              while (newSessions.length <= i) newSessions.push(undefined);
                                              newSessions[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                              setTonySessions(newSessions);
                                            }}
                                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500"
                                            placeholder="3"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-600">Cost per Session</label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                          <input
                                            type="text"
                                            value={tonyRates[i] !== undefined ? formatInputValue(tonyRates[i]) : '30'}
                                            onChange={(e) => {
                                              const newRates = [...tonyRates];
                                              while (newRates.length <= i) newRates.push(undefined);
                                              newRates[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                              setTonyRates(newRates);
                                            }}
                                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500"
                                            placeholder="30"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    {tonyMonthlyContribution > 0 && (
                                      <div className="text-xs text-gray-500">
                                        ${formatNumber(tonyMonthlyContribution)}/mo ({tonyWeeklySessions} × 4.33 × ${tonyRatePerSession})
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Total Display */}
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="flex justify-between font-medium text-gray-700">
                                      <span>Total monthly savings</span>
                                      <span className="text-green-600">${formatNumber(totalMonthlyContribution)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <button
                            onClick={() => setProjectionStep(3)}
                            className="bg-gray-500 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-gray-600 transition-colors shadow-lg"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => setProjectionStep(5)}
                            className="bg-indigo-600 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg"
                          >
                            →
                          </button>
                        </div>
                      </div>

                      {/* Step 2: Operating Costs (moved from step 3) */}
                      <div className={`${projectionStep === 2 && isAdvancedMode ? 'block' : 'hidden'} p-8 space-y-8`}>
                        <div>
                          <h4 className="text-xl font-bold text-gray-800 mb-2 text-center">Operating Costs</h4>
                          <p className="text-gray-600 text-center mb-4 text-sm">Configure your monthly operating expenses</p>
                          
                          
                          <div className="space-y-3">
                            {Array.from({ length: projectionYears }, (_, i) => {
                              // Initialize arrays if needed
                              if (operatingCosts.length <= i) {
                                const newOperatingCosts = [...operatingCosts];
                                const newPaidAdsCosts = [...paidAdsCosts];
                                const newOperatingModes = [...operatingModes];
                                const newGroupCoachingCosts = [...groupCoachingCosts];
                                const newExpandedCalculations = [...expandedCalculations];
                                // Default operating modes: Year 1 studio, Year 2-5 expansion
                                const defaultModes = [true, false, false, false, false]; // true = studio, false = expansion
                                // Default operating costs based on mode: studio = 500, expansion = 4000
                                const defaultOperatingCosts = [500, 4000, 4000, 4000, 4000];
                                // Default paid ads: Year 1 ($100), Year 2-3 ($300), Year 4-5 ($500)
                                const defaultPaidAds = [100, 300, 300, 500, 500];
                                
                                while (newOperatingCosts.length <= i) {
                                  const yearIndex = newOperatingCosts.length;
                                  newOperatingCosts.push(defaultOperatingCosts[yearIndex] || 4000);
                                }
                                while (newPaidAdsCosts.length <= i) {
                                  const yearIndex = newPaidAdsCosts.length;
                                  newPaidAdsCosts.push(defaultPaidAds[yearIndex] || 500);
                                }
                                while (newOperatingModes.length <= i) {
                                  const yearIndex = newOperatingModes.length;
                                  newOperatingModes.push(defaultModes[yearIndex] !== undefined ? defaultModes[yearIndex] : false);
                                }
                                while (newExpandedCalculations.length <= i) newExpandedCalculations.push(false);
                                while (newGroupCoachingCosts.length <= i) {
                                  const calculatedCost = calculateGroupCoachingCost(Number(groupClassClients[i]) || 0, i);
                                  newGroupCoachingCosts.push(calculatedCost);
                                }
                                setOperatingCosts(newOperatingCosts);
                                setPaidAdsCosts(newPaidAdsCosts);
                                setOperatingModes(newOperatingModes);
                                setGroupCoachingCosts(newGroupCoachingCosts);
                                setExpandedCalculations(newExpandedCalculations);
                              }
                              
                              const isStudioMode = operatingModes[i] !== false;
                              
                              // Use stored group coaching cost or calculate default
                              const defaultGroupCoachingCost = calculateGroupCoachingCost(Number(groupClassClients[i]) || 0, i);
                              
                              // Check if stored value matches calculated value or if we need to update
                              let groupCoachingCost;
                              if (groupCoachingCosts[i] !== undefined && groupCoachingCosts[i] > 0) {
                                // If stored value doesn't match calculated value, use calculated value and update state
                                if (groupCoachingCosts[i] !== defaultGroupCoachingCost) {
                                  groupCoachingCost = defaultGroupCoachingCost;
                                  // Update the stored value to match calculated value
                                  const newCosts = [...groupCoachingCosts];
                                  newCosts[i] = defaultGroupCoachingCost;
                                  setGroupCoachingCosts(newCosts);
                                } else {
                                  groupCoachingCost = groupCoachingCosts[i];
                                }
                              } else {
                                groupCoachingCost = defaultGroupCoachingCost;
                                // Auto-set the calculated value in state so it shows in input
                                if (defaultGroupCoachingCost > 0) {
                                  const newCosts = [...groupCoachingCosts];
                                  newCosts[i] = defaultGroupCoachingCost;
                                  setGroupCoachingCosts(newCosts);
                                }
                              }
                              const calculationDetails = getCalculationDetails(Number(groupClassClients[i]) || 0, i);
                              const isExpanded = expandedCalculations[i] || false;
                              const totalMonthlyCost = (Number(operatingCosts[i]) || 0) + groupCoachingCost + (Number(paidAdsCosts[i]) || 0);
                              
                              return (
                                <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2 border border-gray-200">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-gray-700">Year {i + 1}</div>
                                    <div className="bg-gray-100 p-0.5 rounded">
                                      <button
                                        onClick={() => {
                                          const newModes = [...operatingModes];
                                          const newCosts = [...operatingCosts];
                                          newModes[i] = true;
                                          newCosts[i] = 500;
                                          setOperatingModes(newModes);
                                          setOperatingCosts(newCosts);
                                        }}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                          isStudioMode 
                                            ? 'bg-white text-gray-800 shadow-sm' 
                                            : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                      >
                                        Studio
                                      </button>
                                      <button
                                        onClick={() => {
                                          const newModes = [...operatingModes];
                                          const newCosts = [...operatingCosts];
                                          newModes[i] = false;
                                          newCosts[i] = 4000;
                                          setOperatingModes(newModes);
                                          setOperatingCosts(newCosts);
                                        }}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                          !isStudioMode 
                                            ? 'bg-white text-gray-800 shadow-sm' 
                                            : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                      >
                                        Expansion
                                      </button>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    {/* Group Coaching - Full Width */}
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium text-gray-600">Group Coaching</label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                        <input
                                          type="text"
                                          value={formatNumber(groupCoachingCost)}
                                          readOnly
                                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                                          placeholder="0"
                                        />
                                      </div>
                                    </div>
                                    
                                    {/* Operating & Paid Ads - Same Line */}
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-600">Operating</label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                          <input
                                            type="text"
                                            value={operatingCosts[i] !== undefined ? formatInputValue(operatingCosts[i]) : ''}
                                            onChange={(e) => {
                                              const newCosts = [...operatingCosts];
                                              while (newCosts.length <= i) newCosts.push(undefined);
                                              newCosts[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                              setOperatingCosts(newCosts);
                                            }}
                                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500"
                                            placeholder={isStudioMode ? "500" : "4000"}
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-600">Paid Ads</label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                          <input
                                            type="text"
                                            value={paidAdsCosts[i] !== undefined ? formatInputValue(paidAdsCosts[i]) : ''}
                                            onChange={(e) => {
                                              const newCosts = [...paidAdsCosts];
                                              while (newCosts.length <= i) newCosts.push(undefined);
                                              newCosts[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                              setPaidAdsCosts(newCosts);
                                            }}
                                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500"
                                            placeholder="1000"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Total Cost Summary at Bottom */}
                                  {totalMonthlyCost > 0 && (
                                    <div className="mt-3 pt-2 border-t border-gray-200">
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-700">Total Monthly Cost:</span>
                                        <span className="text-lg font-bold text-gray-800">${formatNumber(totalMonthlyCost)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
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

                      {/* Step 6: Review & Projections */}
                      <div className={`${projectionStep === 6 && isAdvancedMode ? 'block' : 'hidden'} p-8 space-y-8`}>
                        <div>
                          <div className="text-center mb-8">
                            <h4 className="text-xl font-bold text-gray-800 mb-2">Financial Review & Projections</h4>
                            <p className="text-gray-600 text-sm">Review your 5-year financial projections and monthly profit breakdown</p>
                          </div>


                          {/* Year-by-Year Breakdown */}
                          <div className="space-y-4">
                            {Array.from({ length: projectionYears }, (_, i) => {
                              // Revenue Calculations
                              const groupRevenue = (Number(groupClassPrices[i]) || 0) * (Number(groupClassClients[i]) || 0);
                              const semiPrivateRevenue = (Number(semiPrivatePrices[i]) || 0) * (Number(semiPrivateClients[i]) || 0);
                              const totalRevenue = groupRevenue + semiPrivateRevenue;
                              
                              // Cost Calculations
                              const operatingCost = Number(operatingCosts[i]) || 0;
                              const paidAdsCost = Number(paidAdsCosts[i]) || 0;
                              const groupCoachingCost = calculateGroupCoachingCost(Number(groupClassClients[i]) || 0, i);
                              const trainerCost = semiPrivateRevenue * ((trainerSplits[i] || 50) / 100);
                              const kyleContribution = Math.round((Number(kyleSessions[i]) || 3) * 4.33 * (Number(kyleRates[i]) || 30));
                              const tonyContribution = Math.round((Number(tonySessions[i]) || 3) * 4.33 * (Number(tonyRates[i]) || 30));
                              const totalOwnerTrainerContribution = kyleContribution + tonyContribution;
                              const totalCosts = operatingCost + paidAdsCost + groupCoachingCost + trainerCost - totalOwnerTrainerContribution; // Owner trainers reduce costs
                              
                              // Profit Calculation
                              const monthlyProfit = totalRevenue - totalCosts;
                              const profitMargin = totalRevenue > 0 ? (monthlyProfit / totalRevenue) * 100 : 0;
                              
                              // Initialize expanded state if needed
                              if (expandedReviews.length <= i) {
                                const newExpanded = [...expandedReviews];
                                while (newExpanded.length <= i) newExpanded.push(false);
                                setExpandedReviews(newExpanded);
                              }
                              
                              const isExpanded = expandedReviews[i] || false;
                              const distributionRate = yearlyDistributions[i] || 0;
                              const monthlyReinvested = monthlyProfit * ((100 - distributionRate) / 100);
                              const monthlyDistributed = monthlyProfit * (distributionRate / 100);
                              const monthlyGodsCut = monthlyDistributed * 0.17;
                              const monthlyNetProfit = monthlyDistributed - monthlyGodsCut;
                              
                              return (
                                <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                      <h5 className="text-lg font-semibold text-gray-800">Year {i + 1}</h5>
                                      <button
                                        onClick={() => {
                                          const newExpanded = [...expandedReviews];
                                          newExpanded[i] = !isExpanded;
                                          setExpandedReviews(newExpanded);
                                        }}
                                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                      >
                                        <svg 
                                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                          fill="none" 
                                          stroke="currentColor" 
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                        {isExpanded ? 'Show less' : 'Show details'}
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {/* Compact View */}
                                  {!isExpanded && (
                                    <div className="space-y-3">
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Total Revenue</span>
                                        <span className="text-sm font-medium">${formatNumber(Math.round(totalRevenue))}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">- Total Costs</span>
                                        <span className="text-sm font-medium">-${formatNumber(Math.round(totalCosts))}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">- Reinvestment ({100 - distributionRate}%)</span>
                                        <span className="text-sm font-medium">-${formatNumber(Math.round(monthlyReinvested))}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">- God's Cut</span>
                                        <span className="text-sm font-medium text-green-600">-${formatNumber(Math.round(monthlyGodsCut))}</span>
                                      </div>
                                      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                                        <span className="font-medium text-gray-900">Net Monthly Profit</span>
                                        <span className="text-xl font-bold text-purple-600">${formatNumber(Math.round(monthlyNetProfit))}</span>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Expanded View */}
                                  {isExpanded && (
                                    <>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Revenue Breakdown */}
                                    <div>
                                      <h6 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        Revenue Breakdown
                                      </h6>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Group Classes</span>
                                          <span className="font-medium">${formatNumber(groupRevenue)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Semi-Private</span>
                                          <span className="font-medium">${formatNumber(Math.round(semiPrivateRevenue))}</span>
                                        </div>
                                        <div className="flex justify-between border-t pt-2 font-medium">
                                          <span>Total Revenue</span>
                                          <span className="text-green-600">${formatNumber(Math.round(totalRevenue))}</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Cost Breakdown */}
                                    <div>
                                      <h6 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                        Cost Breakdown
                                      </h6>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Operating ({operatingModes[i] !== false ? 'Studio' : 'Expansion'})</span>
                                          <span className="font-medium">${formatNumber(operatingCost)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Group Coaching</span>
                                          <span className="font-medium">${formatNumber(groupCoachingCost)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Paid Ads</span>
                                          <span className="font-medium">${formatNumber(paidAdsCost)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Semi-Private Trainer ({trainerSplits[i] || 50}%)</span>
                                          <span className="font-medium">${formatNumber(Math.round(trainerCost))}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Owner Trainer Savings</span>
                                          <span className="font-medium text-green-600">-${formatNumber(totalOwnerTrainerContribution)}</span>
                                        </div>
                                        <div className="flex justify-between border-t pt-2 font-medium">
                                          <span>Total Costs</span>
                                          <span className="text-red-600">${formatNumber(Math.round(totalCosts))}</span>
                                        </div>
                                      </div>
                                    </div>
                                      </div>
                                      
                                      {/* Profit Summary - Only shown in expanded view */}
                                      <div className="mt-4 pt-4 border-t border-gray-100">
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Gross Monthly Profit</span>
                                        <span className="text-gray-600">${formatNumber(Math.round(monthlyProfit))}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">- Reinvestment ({100 - distributionRate}%)</span>
                                        <span className="text-gray-600">-${formatNumber(Math.round(monthlyReinvested))}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">- God's Cut</span>
                                        <span className="font-medium text-green-600">-${formatNumber(Math.round(monthlyGodsCut))}</span>
                                      </div>
                                      <div className="flex justify-between border-t pt-2 font-medium">
                                        <span>Net Monthly Profit</span>
                                        <span className="text-purple-600">${formatNumber(Math.round(monthlyNetProfit))}</span>
                                      </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <button
                            onClick={() => setProjectionStep(5)}
                            className="bg-gray-500 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-gray-600 transition-colors shadow-lg"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => setProjectionStep(7)}
                            className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg"
                          >
                            See Results
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Results Page */}
                  <div className={`${(projectionStep === 3 && !isAdvancedMode) || (projectionStep === 7 && isAdvancedMode) ? 'block' : 'hidden'} p-8 space-y-8`}>
                    <div>
                      <div className="text-center mb-8">
                        <h4 className="text-xl font-bold text-gray-800 mb-6">Your {projectionYears}-Year Founder Journey</h4>
                        {(() => {
                          // Calculate monthly profits for all years first
                          const calculatedMonthlyProfits = [];
                          for (let i = 0; i < projectionYears; i++) {
                            if (isAdvancedMode) {
                              // Advanced mode: calculate profit from detailed inputs
                              const groupRevenue = (Number(groupClassPrices[i]) || 0) * (Number(groupClassClients[i]) || 0);
                              const semiPrivateRevenue = (Number(semiPrivatePrices[i]) || 0) * (Number(semiPrivateClients[i]) || 0);
                              const totalRevenue = groupRevenue + semiPrivateRevenue;
                              
                              const operatingCost = Number(operatingCosts[i]) || 0;
                              const paidAdsCost = Number(paidAdsCosts[i]) || 0;
                              const groupCoachingCost = calculateGroupCoachingCost(Number(groupClassClients[i]) || 0, i);
                              const trainerCost = semiPrivateRevenue * ((trainerSplits[i] || 50) / 100);
                              const kyleContribution = Math.round((Number(kyleSessions[i]) || 3) * 4.33 * (Number(kyleRates[i]) || 30));
                              const tonyContribution = Math.round((Number(tonySessions[i]) || 3) * 4.33 * (Number(tonyRates[i]) || 30));
                              const totalOwnerTrainerContribution = kyleContribution + tonyContribution;
                              const totalCosts = operatingCost + paidAdsCost + groupCoachingCost + trainerCost - totalOwnerTrainerContribution; // Owner trainers reduce costs
                              
                              calculatedMonthlyProfits.push(totalRevenue - totalCosts);
                            } else {
                              // Simple mode: use user-entered monthly profits
                              calculatedMonthlyProfits.push(Number(monthlyProfits[i]) || 0);
                            }
                          }
                          
                          // Calculate total equity gains across all years
                          let totalEquityGains = 0;
                          for (let i = 0; i < projectionYears; i++) {
                            const monthlyProfit = calculatedMonthlyProfits[i];
                            const annualProfit = monthlyProfit * 12;
                            const distributionRate = yearlyDistributions[i] || 0;
                            const distributedProfit = annualProfit * (distributionRate / 100);
                            const godsCut = distributedProfit * 0.17; // 17% of distributed profits
                            const remainingProfit = distributedProfit - godsCut;
                            const yourEquityShare = remainingProfit * (totalEquity / 100);
                            totalEquityGains += yourEquityShare;
                          }
                          
                          // Calculate semi-private training gains (direct income to founder)
                          let totalSemiPrivateGains = 0;
                          if (isAdvancedMode) {
                            for (let i = 0; i < projectionYears; i++) {
                              const semiPrivateRevenue = (Number(semiPrivatePrices[i]) || 0) * (Number(semiPrivateClients[i]) || 0);
                              const founderShare = semiPrivateRevenue * ((trainerSplits[i] || 50) / 100);
                              const annualGains = founderShare * 12;
                              totalSemiPrivateGains += annualGains;
                            }
                          }
                          
                          // Calculate total cash compensation if cash option is selected
                          const estimatedAnnualSalary = 60000; // Estimated annual salary
                          const totalCashCompensation = !preferSweatEquity ? estimatedAnnualSalary * projectionYears : 0;
                          
                          return (
                            <>
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
                                        {Number(buyInAmount) > 0 && (
                                          <div className="bg-white/60 rounded-lg p-3">
                                            <p className="text-sm text-red-600 font-medium">Founder Buy-in</p>
                                            <p className="text-lg font-bold text-red-800">${formatNumber(Number(buyInAmount) || 0)}</p>
                                          </div>
                                        )}
                                        {poolInvestmentAmount > 0 && (
                                          <div className="bg-white/60 rounded-lg p-3">
                                            <p className="text-sm text-red-600 font-medium">Additional Investment</p>
                                            <p className="text-lg font-bold text-red-800">${formatNumber(poolInvestmentAmount)}</p>
                                          </div>
                                        )}
                                        {(Number(buyInAmount) > 0 || poolInvestmentAmount > 0) && (
                                          <div className="bg-white/80 rounded-lg p-2 border-t border-red-200">
                                            <p className="text-sm font-semibold text-red-700">Total Cash: ${formatNumber((Number(buyInAmount) || 0) + poolInvestmentAmount)}</p>
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


                              {/* Founder Journey Timeline */}
                              <div className="space-y-6">
                                
                                {/* Desktop Timeline View */}
                                <div className="hidden md:block space-y-4">
                                  {Array.from({ length: projectionYears }, (_, i) => {
                                    const yearNum = i + 1;
                                    const monthlyProfit = calculatedMonthlyProfits[i] || 0;
                                    const annualProfit = monthlyProfit * 12;
                                    const distributionRate = yearlyDistributions[i] || 0;
                                    const distributedProfit = annualProfit * (distributionRate / 100);
                                    const godsCut = distributedProfit * 0.17;
                                    const remainingProfit = distributedProfit - godsCut;
                                    const yourEquityShare = remainingProfit * (totalEquity / 100);
                                    
                                    let groupCoachingAnnual = 0;
                                    let semiPrivateAnnual = 0;
                                    if (isAdvancedMode) {
                                      const groupCoachingMonthly = calculateGroupCoachingCost(Number(groupClassClients[i]) || 0, i);
                                      groupCoachingAnnual = groupCoachingMonthly * 12;
                                      
                                      const semiPrivateRevenue = (Number(semiPrivatePrices[i]) || 0) * (Number(semiPrivateClients[i]) || 0);
                                      const founderShare = semiPrivateRevenue * ((trainerSplits[i] || 50) / 100);
                                      semiPrivateAnnual = founderShare * 12;
                                    }
                                    
                                    const totalIncome = yourEquityShare;
                                    const totalWorkCommitment = isAdvancedMode ? groupCoachingAnnual + semiPrivateAnnual : 0;
                                    
                                    return (
                                      <div key={i} className="group hover:scale-[1.02] transition-transform duration-200">
                                        <div className="bg-white border-2 border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
                                          <div className="flex items-center justify-between">
                                            {/* Year Badge */}
                                            <div className="flex items-center gap-4">
                                              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                                                Y{yearNum}
                                              </div>
                                              <div>
                                                <div className="text-sm text-gray-500">Year {yearNum}</div>
                                                <div className="text-xs text-gray-400">{distributionRate}% distribution</div>
                                              </div>
                                            </div>
                                            
                                            {/* Main Metrics */}
                                            <div className="flex items-center gap-8">
                                              {/* Equity Share */}
                                              <div className="text-right">
                                                <div className="text-sm text-gray-500 mb-1">Equity Returns</div>
                                                <div className="text-2xl font-bold text-green-600">
                                                  ${formatNumber(Math.round(yourEquityShare))}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                  from ${formatNumber(Math.round(distributedProfit))} profit
                                                </div>
                                              </div>
                                              
                                              {/* Work Commitment (Advanced Mode) */}
                                              {isAdvancedMode && totalWorkCommitment > 0 && (
                                                <div className="border-l-2 border-gray-100 pl-8">
                                                  <div className="text-sm text-gray-500 mb-1">Work Commitment</div>
                                                  <div className="space-y-1">
                                                    {groupCoachingAnnual > 0 && (
                                                      <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                                        <span className="text-sm font-medium text-red-600">
                                                          ${formatNumber(Math.round(groupCoachingAnnual))}
                                                        </span>
                                                        <span className="text-xs text-gray-500">coaching</span>
                                                      </div>
                                                    )}
                                                    {semiPrivateAnnual > 0 && (
                                                      <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                                        <span className="text-sm font-medium text-red-600">
                                                          ${formatNumber(Math.round(semiPrivateAnnual))}
                                                        </span>
                                                        <span className="text-xs text-gray-500">training</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                              
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  
                                  {/* Summary Card */}
                                  <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border-2 border-indigo-100">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h6 className="text-lg font-bold text-gray-800 mb-1">{projectionYears}-Year Summary</h6>
                                        <p className="text-sm text-gray-600">Total expected returns from your {totalEquity.toFixed(1)}% equity</p>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-3xl font-bold text-indigo-600">
                                          ${formatNumber(Math.round(totalEquityGains))}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                          ~${formatNumber(Math.round(totalEquityGains / projectionYears))}/year
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-3">
                                  {Array.from({ length: projectionYears }, (_, i) => {
                                    const yearNum = i + 1;
                                    const monthlyProfit = calculatedMonthlyProfits[i] || 0;
                                    const annualProfit = monthlyProfit * 12;
                                    const distributionRate = yearlyDistributions[i] || 0;
                                    const distributedProfit = annualProfit * (distributionRate / 100);
                                    const godsCut = distributedProfit * 0.17;
                                    const remainingProfit = distributedProfit - godsCut;
                                    const yourEquityShare = remainingProfit * (totalEquity / 100);
                                    
                                    let groupCoachingAnnual = 0;
                                    let semiPrivateAnnual = 0;
                                    if (isAdvancedMode) {
                                      const groupCoachingMonthly = calculateGroupCoachingCost(Number(groupClassClients[i]) || 0, i);
                                      groupCoachingAnnual = groupCoachingMonthly * 12;
                                      
                                      const semiPrivateRevenue = (Number(semiPrivatePrices[i]) || 0) * (Number(semiPrivateClients[i]) || 0);
                                      const founderShare = semiPrivateRevenue * ((trainerSplits[i] || 50) / 100);
                                      semiPrivateAnnual = founderShare * 12;
                                    }
                                    
                                    const totalWorkCommitment = groupCoachingAnnual + semiPrivateAnnual;
                                    
                                    return (
                                      <div key={i} className="bg-white border-2 border-gray-100 rounded-xl p-4 shadow-sm">
                                        {/* Year Header */}
                                        <div className="flex items-center justify-between mb-4">
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow">
                                              Y{yearNum}
                                            </div>
                                            <div>
                                              <div className="font-semibold text-gray-800">Year {yearNum}</div>
                                              <div className="text-xs text-gray-500">{distributionRate}% distributed</div>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-xl font-bold text-green-600">
                                              ${formatNumber(Math.round(yourEquityShare))}
                                            </div>
                                            <div className="text-xs text-gray-500">equity returns</div>
                                          </div>
                                        </div>
                                        
                                        {/* Details */}
                                        <div className="space-y-3">
                                          <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600">Distributed Yearly Profit</span>
                                            <span className="font-medium">${formatNumber(Math.round(distributedProfit))}</span>
                                          </div>
                                          
                                          {isAdvancedMode && totalWorkCommitment > 0 && (
                                            <div className="pt-3 border-t border-gray-100 space-y-2">
                                              <div className="text-xs font-medium text-gray-500 uppercase">Coaching Costs</div>
                                              {groupCoachingAnnual > 0 && (
                                                <div className="flex justify-between items-center text-sm">
                                                  <span className="text-gray-600 flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                                    Group coaching
                                                  </span>
                                                  <span className="font-medium text-red-600">${formatNumber(Math.round(groupCoachingAnnual))}</span>
                                                </div>
                                              )}
                                              {semiPrivateAnnual > 0 && (
                                                <div className="flex justify-between items-center text-sm">
                                                  <span className="text-gray-600 flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                                    Semi-private
                                                  </span>
                                                  <span className="font-medium text-red-600">${formatNumber(Math.round(semiPrivateAnnual))}</span>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          
                                        </div>
                                      </div>
                                    );
                                  })}
                                  
                                  {/* Mobile Summary */}
                                  <div className="mt-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border-2 border-indigo-100">
                                    <div className="text-center">
                                      <div className="text-sm font-medium text-gray-600 mb-2">{projectionYears}-Year Total</div>
                                      <div className="text-2xl font-bold text-indigo-600">${formatNumber(Math.round(totalEquityGains))}</div>
                                      <div className="text-xs text-gray-500 mt-1">from {totalEquity.toFixed(1)}% equity</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={() => setProjectionStep(isAdvancedMode ? 6 : 2)}
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
            
            {/* Simple Projections Toggle - Bottom Right */}
            <div className="flex justify-end mt-6">
              <button 
                onClick={() => setIsAdvancedMode(false)}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium underline transition-colors"
              >
                Switch to Simple Projections
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}