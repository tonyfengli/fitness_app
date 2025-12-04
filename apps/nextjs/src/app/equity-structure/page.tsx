"use client";

import React, { useState, useEffect, useRef } from 'react';
import CollapsibleSection from './CollapsibleSection';

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
  
  // State for active tab in roles section
  const [activeRoleTab, setActiveRoleTab] = useState('all');

  // Founders list
  const founders = [
    { id: 'founder2', name: 'R&E', color: 'bg-green-500' },
    { id: 'founder3', name: 'David', color: 'bg-purple-500' },
    { id: 'founder4', name: 'Kyle', color: 'bg-orange-500' },
    { id: 'founder5', name: 'Tony', color: 'bg-pink-500' }
  ];

  // State for role bullets with assignees and hours per founder
  const [roleBullets, setRoleBullets] = useState<{[key: string]: Array<{id: string; text: string; assignees: string[]; hours?: {[founderId: string]: number}; expanded?: boolean}>}>({
    leadership: [
      { id: '1', text: "Prepare and lead weekly meetings", assignees: [] },
      { id: '2', text: "Review KPIs, diagnose issues, assign tasks, and set monthly budgets", assignees: [] },
      { id: '4', text: "Make sure other founders/team members are on track and run performance reviews if needed", assignees: [] }
    ],
    maintenance: [
      { id: '4', text: "Build and maintain gym technology (apps, Wi-Fi, routers, etc)", assignees: [] },
      { id: '5', text: "Repair maintenance-related issues (equipment, A/C, other gym amenities)", assignees: [] },
      { id: '48', text: "Oversee facility renovations and construction projects", assignees: [] }
    ],
    inGymCoaching: [
      { id: '6', text: "Lead in-person workouts", assignees: [] },
      { id: '7', text: "Program and create the workouts (planning-related)", assignees: [] },
      { id: '49', text: "Manage workout music and playlists", assignees: [] }
    ],
    remoteCoaching: [
      { id: '8', text: "Review client videos/feedback and provide coaching feedback", assignees: [] },
      { id: '9', text: "Record new videos if needed", assignees: [] },
      { id: '10', text: "Update the app for workout changes", assignees: [] }
    ],
    coachManagement: [
      { id: '11', text: "Recruit, interview, and onboard new coaches", assignees: [] },
      { id: '12', text: "Run training sessions for coaches", assignees: [] },
      { id: '13', text: "Filming coaching or tutorial videos for content/marketing purposes", assignees: [] },
      { id: '14', text: "Lead and manage coaching curriculum and training philosophy", assignees: [] }
    ],
    sales: [
      { id: '15', text: "Respond quickly to new leads (DM, SMS, email, phone)", assignees: [] },
      { id: '16', text: "Group classes - follow ups, trials, close", assignees: [] },
      { id: '17', text: "Semi-privates - follow ups, assessments and close", assignees: [] },
      { id: '18', text: "Run save attempts when clients want to cancel (before Admin processes)", assignees: [] }
    ],
    marketing: [
      { id: '20', text: "Plan and maintain a content calendar (frequency & posting cadence to be aligned)", assignees: [] },
      { id: '21', text: "Capture photos and video during sessions and events", assignees: [] },
      { id: '22', text: "Create and publish content on social platforms", assignees: [] },
      { id: '23', text: "Engage with comments, DMs, and basic social interactions", assignees: [] },
      { id: '24', text: "Manage email/newsletter campaigns", assignees: [] },
      { id: '25', text: "Maintain website/SEO", assignees: [] },
      { id: '50', text: "Create and publish paid ads (Facebook, Google, Instagram)", assignees: [] }
    ],
    partnerships: [
      { id: '26', text: "Identify and contact local businesses for partnerships", assignees: [] },
      { id: '27', text: "Set up referral and cross-promotion agreements", assignees: [] },
      { id: '28', text: "Coordinate joint events, pop-ups, and challenges", assignees: [] },
      { id: '29', text: "Engage local Facebook/Nextdoor groups within their rules", assignees: [] }
    ],
    clientSuccess: [
      { id: '30', text: "Client check-ins (monthly touch points)", assignees: [] },
      { id: '31', text: "Send birthday, milestone, and \"we noticed you\" messages", assignees: [] },
      { id: '32', text: "Organize community events, challenges, and social outings", assignees: [] },
      { id: '33', text: "Answer client questions about administrative policies, address complaints", assignees: [] }
    ],
    facilities: [
      { id: '35', text: "Clean per daily checklist (trash, floors, bathrooms, equipment wipe-down)", assignees: [] },
      { id: '36', text: "Put equipment and supplies back in their proper place", assignees: [] },
      { id: '37', text: "Restock towels, wipes, toiletries, water, and other consumables", assignees: [] },
      { id: '38', text: "Manage lost-and-found area and log items", assignees: [] },
      { id: '40', text: "Order cleaning and maintenance supplies within budget", assignees: [] },
      { id: '46', text: "Take out trash", assignees: [] }
    ],
    admin: [
      { id: '42', text: "Process freezes, cancellations, membership changes, and coach scheduling adjustments", assignees: [] },
      { id: '44', text: "Run payroll for the trainers", assignees: [] },
      { id: '45', text: "Do bookkeeping and monthly financial reports to the team", assignees: [] },
      { id: '47', text: "Chase down unpaid invoices and manage collections", assignees: [] }
    ]
  });
  
  // Revenue projection state  
  const [revenueStep, setRevenueStep] = useState(1); // 1-2 for revenue steps
  
  // Financial projection state
  const [projectionStep, setProjectionStep] = useState(1); // 1-4 (steps + results)
  const [projectionYears] = useState(5); // Fixed at 5 years
  const [monthlyProfits, setMonthlyProfits] = useState<(number | string | undefined)[]>([2000, 4000, 6000, 8000, 10000]); // Monthly profits
  const [yearlyDistributions, setYearlyDistributions] = useState<number[]>([50, 60, 70, 80, 80]); // percentage distributed vs reinvested
  const [isAdvancedMode, setIsAdvancedMode] = useState(true);
  
  // Advanced mode state
  const [groupClassPrices, setGroupClassPrices] = useState<(number | string | undefined)[]>([]);
  const [groupClassClientsStart, setGroupClassClientsStart] = useState<(number | string | undefined)[]>([]);
  const [groupClassClientsEnd, setGroupClassClientsEnd] = useState<(number | string | undefined)[]>([]);
  const [groupClassDropoffs, setGroupClassDropoffs] = useState<(number | string | undefined)[]>([]); // Monthly client dropoffs
  const [semiPrivatePrices, setSemiPrivatePrices] = useState<(number | string | undefined)[]>([]);
  const [semiPrivateClientsStart, setSemiPrivateClientsStart] = useState<(number | string | undefined)[]>([]);
  const [semiPrivateClientsEnd, setSemiPrivateClientsEnd] = useState<(number | string | undefined)[]>([]);
  const [semiPrivateDropoffs, setSemiPrivateDropoffs] = useState<(number | string | undefined)[]>([]); // Monthly client dropoffs
  const [operatingModes, setOperatingModes] = useState<boolean[]>([]); // true = studio, false = expansion per year
  const [operatingCosts, setOperatingCosts] = useState<(number | string | undefined)[]>([]);
  const [paidAdsCosts, setPaidAdsCosts] = useState<(number | string | undefined)[]>([]);
  const [groupCoachingCosts, setGroupCoachingCosts] = useState<number[]>([]);
  const [expandedCalculations, setExpandedCalculations] = useState<boolean[]>([]);
  const [expandedReviews, setExpandedReviews] = useState<boolean[]>([]);
  const [trainerSplits, setTrainerSplits] = useState<number[]>([50, 50, 50, 50, 50]); // percentage to trainer (business gets remainder)
  const [expandedYearDetails, setExpandedYearDetails] = useState<boolean[]>([false, false, false, false, false]); // track expansion state for each year
  const [customWeeklySessions, setCustomWeeklySessions] = useState<(number | string | undefined)[]>([]); // custom weekly sessions for coaching cost calculation
  const [customCoachingRates, setCustomCoachingRates] = useState<(number | string | undefined)[]>([]); // custom coaching cost per session
  const [kyleSessions, setKyleSessions] = useState<(number | string | undefined)[]>([]); // Kyle weekly sessions
  const [kyleRates, setKyleRates] = useState<(number | string | undefined)[]>([]); // Kyle cost per session
  const [tonySessions, setTonySessions] = useState<(number | string | undefined)[]>([]); // Tony weekly sessions
  const [tonyRates, setTonyRates] = useState<(number | string | undefined)[]>([]); // Tony cost per session
  
  // Conversion rates for customer acquisition funnel
  const [leadToTrialRate, setLeadToTrialRate] = useState<number | string>(50); // Default 50%
  const [trialToMemberRate, setTrialToMemberRate] = useState<number | string>(60); // Default 60%
  
  // Role hours state
  const [roleHours, setRoleHours] = useState({
    leadership: 0,
    maintenance: 0,
    inGymCoaching: 0,
    remoteCoaching: 0,
    coachManagement: 0,
    sales: 0,
    marketing: 0,
    partnerships: 0,
    clientSuccess: 0,
    facilities: 0,
    admin: 0
  });
  
  // Ref for auto-scrolling to Financial Projections section
  const financialProjectionsRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Helper functions for role bullets
  const addBullet = (roleKey: string) => {
    const newId = Date.now().toString();
    setRoleBullets(prev => ({
      ...prev,
      [roleKey]: [...prev[roleKey], { id: newId, text: '', assignees: [] }]
    }));
  };

  const removeBullet = (roleKey: string, bulletId: string) => {
    setRoleBullets(prev => ({
      ...prev,
      [roleKey]: prev[roleKey].filter(bullet => bullet.id !== bulletId)
    }));
  };

  const updateBulletText = (roleKey: string, bulletId: string, newText: string) => {
    setRoleBullets(prev => ({
      ...prev,
      [roleKey]: prev[roleKey].map(bullet =>
        bullet.id === bulletId ? { ...bullet, text: newText } : bullet
      )
    }));
  };

  const toggleAssignee = (roleKey: string, bulletId: string, founderId: string) => {
    setRoleBullets(prev => ({
      ...prev,
      [roleKey]: prev[roleKey].map(bullet => {
        if (bullet.id === bulletId) {
          const assignees = bullet.assignees.includes(founderId)
            ? bullet.assignees.filter(id => id !== founderId)
            : [...bullet.assignees, founderId];
          return { ...bullet, assignees };
        }
        return bullet;
      })
    }));
  };

  const updateBulletHours = (roleKey: string, bulletId: string, founderId: string, hours: number) => {
    setRoleBullets(prev => ({
      ...prev,
      [roleKey]: prev[roleKey].map(bullet =>
        bullet.id === bulletId 
          ? { 
              ...bullet, 
              hours: {
                ...(bullet.hours || {}),
                [founderId]: hours
              }
            } 
          : bullet
      )
    }));
  };

  const toggleBulletExpanded = (roleKey: string, bulletId: string) => {
    setRoleBullets(prev => ({
      ...prev,
      [roleKey]: prev[roleKey].map(bullet =>
        bullet.id === bulletId 
          ? { ...bullet, expanded: !bullet.expanded } 
          : bullet
      )
    }));
  };

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
      // Calculate average of start and end clients
      const startClients = i === 0 ? (Number(groupClassClientsStart[i]) || 0) : (Number(groupClassClientsEnd[i-1]) || 0);
      const avgClients = (startClients + (Number(groupClassClientsEnd[i]) || 0)) / 2;
      const calculatedCost = calculateGroupCoachingCost(avgClients, i);
      
      // Only update if user hasn't manually overridden this year's cost OR if it's currently 0  
      if (newGroupCoachingCosts[i] === undefined || newGroupCoachingCosts[i] === 0) {
        newGroupCoachingCosts[i] = calculatedCost;
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      setGroupCoachingCosts(newGroupCoachingCosts);
    }
  }, [groupClassClientsStart, groupClassClientsEnd, projectionYears]);

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
          {/* Revenue Projections Section */}
          <div className="p-8 bg-gradient-to-br from-green-50 to-emerald-50">
            <CollapsibleSection title="💰 Revenue Projections" defaultOpen={false}>
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-3 flex items-center justify-center gap-2">
                  <span className="text-2xl">💰</span>
                  Revenue Projections
                </h3>
              </div>

              {/* Progress Bar for Revenue Steps */}
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
                        className="h-0.5 bg-green-600 transition-all duration-500"
                        style={{ width: `${((revenueStep - 1) / 1) * 100}%` }}
                      ></div>
                    </div>
                    
                    {/* Step circles */}
                    {[1, 2].map((step) => (
                      <div key={step} className="relative">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 border-2 ${
                          step <= revenueStep 
                            ? 'bg-green-600 text-white border-green-600' 
                            : 'bg-white text-gray-400 border-gray-200'
                        }`}>
                          {step}
                        </div>
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-gray-600">
                          {step === 1 ? 'Group Classes' : 'Semi-Private'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Revenue Step Content */}
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden mt-8">
                <div className="relative min-h-96">
                  {/* Step 1: Group Classes */}
                  <div className={`${revenueStep === 1 ? 'block' : 'hidden'} p-8 space-y-8`}>
                    <div>
                      <h4 className="text-xl font-bold text-gray-800 mb-2 text-center">Group Classes</h4>
                      <p className="text-gray-600 text-center mb-6 text-sm">Set pricing and member capacity for your group fitness classes</p>
                      
                      <div className="space-y-3">
                        {Array.from({ length: projectionYears }, (_, i) => {
                          // Initialize arrays if needed
                          if (groupClassPrices.length <= i) {
                            const newPrices = [...groupClassPrices];
                            const newClientsStart = [...groupClassClientsStart];
                            const newClientsEnd = [...groupClassClientsEnd];
                            const newDropoffs = [...groupClassDropoffs];
                            
                            // Default pricing: Year 1 ($120), Year 2-3 ($130), Year 4-5 ($140)
                            const defaultPrices = [120, 130, 130, 140, 140];
                            // Default clients progression
                            const defaultClientsStart = [0, 30, 50, 70, 90];
                            const defaultClientsEnd = [30, 50, 70, 90, 100];
                            // Default dropoffs (about 2-3 per month)
                            const defaultDropoffs = [2, 2, 3, 3, 3];
                            
                            while (newPrices.length <= i) {
                              const yearIndex = newPrices.length;
                              newPrices.push(defaultPrices[yearIndex] || 140);
                            }
                            while (newClientsStart.length <= i) {
                              const yearIndex = newClientsStart.length;
                              newClientsStart.push(defaultClientsStart[yearIndex] || 0);
                              newClientsEnd.push(defaultClientsEnd[yearIndex] || 100);
                              newDropoffs.push(defaultDropoffs[yearIndex] || 3);
                            }
                            setGroupClassPrices(newPrices);
                            setGroupClassClientsStart(newClientsStart);
                            setGroupClassClientsEnd(newClientsEnd);
                            setGroupClassDropoffs(newDropoffs);
                          }
                          
                          const startClients = i === 0 ? (Number(groupClassClientsStart[i]) || 0) : (Number(groupClassClientsEnd[i-1]) || 0);
                          const avgClients = (startClients + (Number(groupClassClientsEnd[i]) || 0)) / 2;
                          const monthlyRevenue = (Number(groupClassPrices[i]) || 0) * avgClients;
                          
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
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">Start Clients</label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">#</span>
                                      <input
                                        type="text"
                                        value={i === 0 
                                          ? (groupClassClientsStart[i] !== undefined ? formatInputValue(groupClassClientsStart[i]) : '0')
                                          : formatInputValue(groupClassClientsEnd[i-1] || 0)
                                        }
                                        onChange={(e) => {
                                          if (i === 0) {
                                            const newClients = [...groupClassClientsStart];
                                            while (newClients.length <= i) newClients.push(undefined);
                                            newClients[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                            setGroupClassClientsStart(newClients);
                                          }
                                        }}
                                        className={`w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg ${i === 0 ? 'focus:border-green-500' : 'bg-gray-100 cursor-not-allowed'}`}
                                        placeholder="0"
                                        disabled={i > 0}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">End Clients</label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">#</span>
                                      <input
                                        type="text"
                                        value={groupClassClientsEnd[i] !== undefined ? formatInputValue(groupClassClientsEnd[i]) : '50'}
                                        onChange={(e) => {
                                          const newClients = [...groupClassClientsEnd];
                                          while (newClients.length <= i) newClients.push(undefined);
                                          newClients[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                          setGroupClassClientsEnd(newClients);
                                        }}
                                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-green-500"
                                        placeholder="50"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">Monthly Dropoffs</label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">#</span>
                                      <input
                                        type="text"
                                        value={groupClassDropoffs[i] !== undefined ? formatInputValue(groupClassDropoffs[i]) : '2'}
                                        onChange={(e) => {
                                          const newDropoffs = [...groupClassDropoffs];
                                          while (newDropoffs.length <= i) newDropoffs.push(undefined);
                                          newDropoffs[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                          setGroupClassDropoffs(newDropoffs);
                                        }}
                                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-green-500"
                                        placeholder="2"
                                      />
                                    </div>
                                  </div>
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
                                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-green-500"
                                        placeholder="150"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 text-center">
                                  Average clients: <span className="font-medium">{Math.round(avgClients)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => setRevenueStep(2)}
                        className="bg-green-600 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-green-700 transition-colors shadow-lg"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  {/* Step 2: Semi-Private Classes */}
                  <div className={`${revenueStep === 2 ? 'block' : 'hidden'} p-8 space-y-8`}>
                    <div>
                      <h4 className="text-xl font-bold text-gray-800 mb-2 text-center">Semi-Private Classes</h4>
                      <p className="text-gray-600 text-center mb-6 text-sm">Set pricing and client capacity for your semi-private training sessions</p>
                      
                      <div className="space-y-3">
                        {Array.from({ length: projectionYears }, (_, i) => {
                          // Initialize arrays if needed
                          if (semiPrivatePrices.length <= i) {
                            const newPrices = [...semiPrivatePrices];
                            const newClientsStart = [...semiPrivateClientsStart];
                            const newClientsEnd = [...semiPrivateClientsEnd];
                            const newDropoffs = [...semiPrivateDropoffs];
                            const newSplits = [...trainerSplits];
                            
                            // Default pricing: $300 for all years
                            // Default clients progression
                            const defaultPrice = 300;
                            const defaultClientsStart = [0, 10, 15, 20, 25];
                            const defaultClientsEnd = [10, 15, 20, 25, 30];
                            // Default dropoffs (about 1-2 per month for semi-private)
                            const defaultDropoffs = [1, 1, 1, 2, 2];
                            
                            while (newPrices.length <= i) {
                              newPrices.push(defaultPrice);
                            }
                            while (newClientsStart.length <= i) {
                              const yearIndex = newClientsStart.length;
                              newClientsStart.push(defaultClientsStart[yearIndex] || 0);
                              newClientsEnd.push(defaultClientsEnd[yearIndex] || 30);
                              newDropoffs.push(defaultDropoffs[yearIndex] || 1);
                            }
                            while (newSplits.length <= i) newSplits.push(50);
                            setSemiPrivatePrices(newPrices);
                            setSemiPrivateClientsStart(newClientsStart);
                            setSemiPrivateClientsEnd(newClientsEnd);
                            setSemiPrivateDropoffs(newDropoffs);
                            setTrainerSplits(newSplits);
                          }
                          
                          const startClients = i === 0 ? (Number(semiPrivateClientsStart[i]) || 0) : (Number(semiPrivateClientsEnd[i-1]) || 0);
                          const avgClients = (startClients + (Number(semiPrivateClientsEnd[i]) || 0)) / 2;
                          const monthlyRevenue = (Number(semiPrivatePrices[i]) || 0) * avgClients;
                          
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
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">Start Clients</label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">#</span>
                                      <input
                                        type="text"
                                        value={i === 0 
                                          ? (semiPrivateClientsStart[i] !== undefined ? formatInputValue(semiPrivateClientsStart[i]) : '0')
                                          : formatInputValue(semiPrivateClientsEnd[i-1] || 0)
                                        }
                                        onChange={(e) => {
                                          if (i === 0) {
                                            const newClients = [...semiPrivateClientsStart];
                                            while (newClients.length <= i) newClients.push(undefined);
                                            newClients[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                            setSemiPrivateClientsStart(newClients);
                                          }
                                        }}
                                        className={`w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg ${i === 0 ? 'focus:border-green-500' : 'bg-gray-100 cursor-not-allowed'}`}
                                        placeholder="0"
                                        disabled={i > 0}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">End Clients</label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">#</span>
                                      <input
                                        type="text"
                                        value={semiPrivateClientsEnd[i] !== undefined ? formatInputValue(semiPrivateClientsEnd[i]) : '30'}
                                        onChange={(e) => {
                                          const newClients = [...semiPrivateClientsEnd];
                                          while (newClients.length <= i) newClients.push(undefined);
                                          newClients[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                          setSemiPrivateClientsEnd(newClients);
                                        }}
                                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-green-500"
                                        placeholder="30"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">Monthly Dropoffs</label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">#</span>
                                      <input
                                        type="text"
                                        value={semiPrivateDropoffs[i] !== undefined ? formatInputValue(semiPrivateDropoffs[i]) : '1'}
                                        onChange={(e) => {
                                          const newDropoffs = [...semiPrivateDropoffs];
                                          while (newDropoffs.length <= i) newDropoffs.push(undefined);
                                          newDropoffs[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                          setSemiPrivateDropoffs(newDropoffs);
                                        }}
                                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-green-500"
                                        placeholder="1"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-600">Monthly Price</label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                      <input
                                        type="text"
                                        value={semiPrivatePrices[i] !== undefined ? formatInputValue(semiPrivatePrices[i]) : '300'}
                                        onChange={(e) => {
                                          const newPrices = [...semiPrivatePrices];
                                          while (newPrices.length <= i) newPrices.push(undefined);
                                          newPrices[i] = e.target.value === '' ? '' : parseNumber(e.target.value);
                                          setSemiPrivatePrices(newPrices);
                                        }}
                                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:border-green-500"
                                        placeholder="300"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 text-center">
                                  Average clients: <span className="font-medium">{Math.round(avgClients)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <button
                        onClick={() => setRevenueStep(1)}
                        className="bg-gray-300 text-gray-700 w-12 h-12 rounded-full text-lg font-bold hover:bg-gray-400 transition-colors shadow-lg"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setRevenueStep(1)}
                        className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-lg"
                      >
                        Complete Revenue Setup
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </CollapsibleSection>
          </div>
          
          {/* Customer Acquisition Funnel Section */}
          <div className="p-8 bg-gradient-to-br from-amber-50 to-orange-50">
            <CollapsibleSection title="🚀 Customer Acquisition Funnel" defaultOpen={false}>
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-3 flex items-center justify-center gap-2">
                  <span className="text-2xl">🚀</span>
                  Customer Acquisition Funnel
                </h3>
              </div>

              <div className="space-y-2">
                {/* Conversion Rate Settings */}
                <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 p-4">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-3">
                    {/* Lead to Trial */}
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100 shadow-sm w-full md:w-auto justify-center">
                      <span className="text-xs font-medium text-gray-500">Lead→Trial</span>
                      <input
                        type="text"
                        value={leadToTrialRate}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            setLeadToTrialRate('');
                          } else {
                            const num = parseInt(value) || 0;
                            setLeadToTrialRate(Math.min(100, Math.max(0, num)));
                          }
                        }}
                        className="w-12 px-1 py-0.5 text-sm font-semibold text-center text-gray-800 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:border-blue-400 focus:outline-none transition-all"
                      />
                      <span className="text-xs font-medium text-gray-400">%</span>
                    </div>
                    
                    <div className="hidden md:block w-4 h-px bg-gray-300"></div>
                    
                    {/* Trial to Member */}
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100 shadow-sm w-full md:w-auto justify-center">
                      <span className="text-xs font-medium text-gray-500">Trial→Member</span>
                      <input
                        type="text"
                        value={trialToMemberRate}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            setTrialToMemberRate('');
                          } else {
                            const num = parseInt(value) || 0;
                            setTrialToMemberRate(Math.min(100, Math.max(0, num)));
                          }
                        }}
                        className="w-12 px-1 py-0.5 text-sm font-semibold text-center text-gray-800 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:border-purple-400 focus:outline-none transition-all"
                      />
                      <span className="text-xs font-medium text-gray-400">%</span>
                    </div>
                  </div>
                </div>

                {/* Year-by-Year Projections */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden p-6">
                  <h4 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-xl">📈</span>
                    Monthly Acquisition Requirements by Year
                  </h4>

                  <div className="space-y-4">
                    {(() => {
                      const results = [];
                      for (let i = 0; i < projectionYears; i++) {
                        // Get client numbers
                        const startGroupClients = i === 0 ? (Number(groupClassClientsStart[i]) || 0) : (Number(groupClassClientsEnd[i-1]) || 0);
                        const endGroupClients = Number(groupClassClientsEnd[i]) || 0;
                        const groupDropoffs = Number(groupClassDropoffs[i]) || 0;
                        
                        const startSemiPrivateClients = i === 0 ? (Number(semiPrivateClientsStart[i]) || 0) : (Number(semiPrivateClientsEnd[i-1]) || 0);
                        const endSemiPrivateClients = Number(semiPrivateClientsEnd[i]) || 0;
                        const semiPrivateDropoffsNum = Number(semiPrivateDropoffs[i]) || 0;
                        
                        // Calculate average clients for the year
                        const avgGroupClients = (startGroupClients + endGroupClients) / 2;
                        const avgSemiPrivateClients = (startSemiPrivateClients + endSemiPrivateClients) / 2;
                        const avgTotal = avgGroupClients + avgSemiPrivateClients;
                        
                        // Calculate total clients
                        const startTotal = startGroupClients + startSemiPrivateClients;
                        const endTotal = endGroupClients + endSemiPrivateClients;
                        const totalMonthlyDropoffs = groupDropoffs + semiPrivateDropoffsNum;
                        
                        // Calculate requirements using average client base for dropoffs
                        const totalDropoffsYear = totalMonthlyDropoffs * 12;
                        const netGrowth = endTotal - startTotal;
                        const totalNewMembersNeeded = netGrowth + totalDropoffsYear;
                        
                        // Calculate for each service type
                        const groupNetGrowth = endGroupClients - startGroupClients;
                        const groupDropoffsYear = groupDropoffs * 12;
                        const groupNewMembersNeeded = groupNetGrowth + groupDropoffsYear;
                        
                        const semiPrivateNetGrowth = endSemiPrivateClients - startSemiPrivateClients;
                        const semiPrivateDropoffsYear = semiPrivateDropoffsNum * 12;
                        const semiPrivateNewMembersNeeded = semiPrivateNetGrowth + semiPrivateDropoffsYear;
                        
                        // Work backwards through funnel
                        const trialsNeeded = Math.ceil(totalNewMembersNeeded / ((Number(trialToMemberRate) || 1) / 100));
                        const leadsNeeded = Math.ceil(trialsNeeded / ((Number(leadToTrialRate) || 1) / 100));
                        
                        // Calculate for each service type
                        const groupTrialsNeeded = Math.ceil(groupNewMembersNeeded / ((Number(trialToMemberRate) || 1) / 100));
                        const groupLeadsNeeded = Math.ceil(groupTrialsNeeded / ((Number(leadToTrialRate) || 1) / 100));
                        
                        const semiPrivateTrialsNeeded = Math.ceil(semiPrivateNewMembersNeeded / ((Number(trialToMemberRate) || 1) / 100));
                        const semiPrivateLeadsNeeded = Math.ceil(semiPrivateTrialsNeeded / ((Number(leadToTrialRate) || 1) / 100));
                        
                        results.push(
                          <div key={i} className="group relative bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-all duration-200 hover:shadow-sm">
                            <div className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
                                    <span className="text-xs font-bold text-blue-700">{i + 1}</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1">
                                      <div className="text-center">
                                        <div className="text-sm font-bold text-gray-900">{Math.ceil(leadsNeeded / 12)}</div>
                                        <div className="text-xs text-gray-400 -mt-0.5">leads</div>
                                      </div>
                                    </div>
                                    <div className="w-4 h-px bg-gradient-to-r from-blue-300 to-purple-300"></div>
                                    <div className="flex items-center gap-1">
                                      <div className="text-center">
                                        <div className="text-sm font-bold text-gray-900">{Math.ceil(trialsNeeded / 12)}</div>
                                        <div className="text-xs text-gray-400 -mt-0.5">trials</div>
                                      </div>
                                    </div>
                                    <div className="w-4 h-px bg-gradient-to-r from-purple-300 to-green-300"></div>
                                    <div className="flex items-center gap-1">
                                      <div className="text-center">
                                        <div className="text-sm font-bold text-gray-900">{Math.ceil(totalNewMembersNeeded / 12)}</div>
                                        <div className="text-xs text-gray-400 -mt-0.5">members</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    const newExpanded = [...expandedYearDetails];
                                    newExpanded[i] = !newExpanded[i];
                                    setExpandedYearDetails(newExpanded);
                                  }}
                                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                                    expandedYearDetails[i] 
                                      ? 'bg-gray-100 text-gray-600' 
                                      : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                                  }`}
                                >
                                  <svg 
                                    className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedYearDetails[i] ? 'rotate-180' : ''}`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                                
                              {/* Service Type Breakdown - Collapsible */}
                              {expandedYearDetails[i] && (
                                <div className="mt-3 pt-3 border-t border-gray-50">
                                  {/* Service Type Breakdown */}
                                  <div className="grid grid-cols-2 gap-2">
                                  {(() => {
                                    // Calculate monthly totals first
                                    const monthlyLeadsTotal = Math.ceil(leadsNeeded / 12);
                                    const monthlyTrialsTotal = Math.ceil(trialsNeeded / 12);
                                    const monthlyMembersTotal = Math.ceil(totalNewMembersNeeded / 12);
                                    
                                    // Calculate proportions
                                    const groupProportion = groupNewMembersNeeded / totalNewMembersNeeded || 0;
                                    const semiPrivateProportion = semiPrivateNewMembersNeeded / totalNewMembersNeeded || 0;
                                    
                                    // Allocate based on proportions, ensuring they add up
                                    const groupMonthlyMembers = Math.round(monthlyMembersTotal * groupProportion);
                                    const semiPrivateMonthlyMembers = monthlyMembersTotal - groupMonthlyMembers;
                                    
                                    const groupMonthlyTrials = Math.round(monthlyTrialsTotal * groupProportion);
                                    const semiPrivateMonthlyTrials = monthlyTrialsTotal - groupMonthlyTrials;
                                    
                                    const groupMonthlyLeads = Math.round(monthlyLeadsTotal * groupProportion);
                                    const semiPrivateMonthlyLeads = monthlyLeadsTotal - groupMonthlyLeads;
                                    
                                    return (
                                      <>
                                        <div className="bg-blue-50/50 rounded-lg p-2.5">
                                          <div className="flex items-center gap-2 mb-1.5">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                            <div className="text-xs font-medium text-blue-700">Group Classes</div>
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-blue-600">
                                            <span className="font-semibold">{groupMonthlyLeads}</span>
                                            <svg className="w-3 h-3 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="font-semibold">{groupMonthlyTrials}</span>
                                            <svg className="w-3 h-3 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="font-semibold">{groupMonthlyMembers}</span>
                                          </div>
                                          <div className="flex items-center gap-4 text-[10px] text-blue-500 mt-1">
                                            <span>L</span>
                                            <span className="ml-3">T</span>
                                            <span className="ml-2">M</span>
                                          </div>
                                        </div>
                                        <div className="bg-purple-50/50 rounded-lg p-2.5">
                                          <div className="flex items-center gap-2 mb-1.5">
                                            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                                            <div className="text-xs font-medium text-purple-700">Semi-Private</div>
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-purple-600">
                                            <span className="font-semibold">{semiPrivateMonthlyLeads}</span>
                                            <svg className="w-3 h-3 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="font-semibold">{semiPrivateMonthlyTrials}</span>
                                            <svg className="w-3 h-3 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="font-semibold">{semiPrivateMonthlyMembers}</span>
                                          </div>
                                          <div className="flex items-center gap-4 text-[10px] text-purple-500 mt-1">
                                            <span>L</span>
                                            <span className="ml-3">T</span>
                                            <span className="ml-2">M</span>
                                          </div>
                                        </div>
                                      </>
                                    );
                                  })()}
                                  </div>
                                  
                                  {/* Weekly Overview - Moved below service breakdown */}
                                  <div className="grid grid-cols-2 gap-2 mt-2">
                                    {/* Weekly Requirements */}
                                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3">
                                      <div className="flex items-center gap-1.5 mb-2">
                                        <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                        <div className="text-xs font-medium text-gray-700">Weekly Targets</div>
                                      </div>
                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-gray-600">Leads</span>
                                          <span className="font-semibold text-gray-800">{Math.round(Math.ceil(leadsNeeded / 12) / 4.33)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-gray-600">Trials</span>
                                          <span className="font-semibold text-gray-800">{Math.round(Math.ceil(trialsNeeded / 12) / 4.33)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-gray-600">New Members</span>
                                          <span className="font-semibold text-gray-800">{Math.round(Math.ceil(totalNewMembersNeeded / 12) / 4.33)}</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Classes Schedule */}
                                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-3">
                                      <div className="flex items-center gap-1.5 mb-2">
                                        <div className="w-1 h-1 bg-amber-500 rounded-full"></div>
                                        <div className="text-xs font-medium text-amber-700">Weekly Classes</div>
                                      </div>
                                      <div className="space-y-1.5">
                                        {(() => {
                                          // Calculate weekly sessions based on average group clients
                                          let weeklySessions;
                                          if (avgGroupClients === 0) weeklySessions = 0;
                                          else if (avgGroupClients <= 20) weeklySessions = 7;
                                          else if (avgGroupClients <= 30) weeklySessions = 10;
                                          else if (avgGroupClients <= 50) weeklySessions = 15;
                                          else if (avgGroupClients <= 70) weeklySessions = 22;
                                          else if (avgGroupClients <= 90) weeklySessions = 28;
                                          else if (avgGroupClients <= 120) weeklySessions = 35;
                                          else weeklySessions = 40;
                                          
                                          // Calculate semi-private sessions
                                          const semiPrivateSessions = Math.ceil(avgSemiPrivateClients / 3);
                                          
                                          return (
                                            <>
                                              <div className="flex items-center justify-between text-xs">
                                                <span className="text-amber-600">Group Classes</span>
                                                <span className="font-semibold text-amber-800">{weeklySessions}</span>
                                              </div>
                                              <div className="flex items-center justify-between text-xs">
                                                <span className="text-amber-600">Semi-Private</span>
                                                <span className="font-semibold text-amber-800">{semiPrivateSessions}</span>
                                              </div>
                                              <div className="flex items-center justify-between text-xs border-t border-amber-200 pt-1.5 mt-1">
                                                <span className="text-amber-600">Total</span>
                                                <span className="font-semibold text-amber-800">{weeklySessions + semiPrivateSessions}</span>
                                              </div>
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return results;
                    })()}
                  </div>
                </div>
              </div>
            </div>
            </CollapsibleSection>
          </div>
          
          {/* Roles and Responsibilities */}
          <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100">
            <CollapsibleSection title="👥 Roles and Responsibilities" defaultOpen={false}>
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 text-center">
                  Roles and Responsibilities
                </h3>
              </div>
              
              {/* Founder Tabs */}
              <div className="mb-6">
                <div className="flex justify-center">
                  <div className="inline-flex bg-gray-100 p-0.5 rounded-lg shadow-inner">
                    <div className="flex gap-0.5 overflow-x-auto scrollbar-hide max-w-full">
                      {/* All Tab */}
                      <button
                        onClick={() => setActiveRoleTab('all')}
                        className={`px-5 py-1.5 rounded-md font-medium text-xs transition-all duration-200 ${
                          activeRoleTab === 'all'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        All
                      </button>
                      
                      {/* Founder Tabs */}
                      {founders.map((founder) => {
                        return (
                          <button
                            key={founder.id}
                            onClick={() => setActiveRoleTab(founder.id)}
                            className={`px-5 py-1.5 rounded-md font-medium text-xs transition-all duration-200 ${
                              activeRoleTab === founder.id
                                ? `bg-white text-gray-900 shadow-sm`
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                          >
                            {founder.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Active filter indicator */}
                {activeRoleTab !== 'all' && (
                  <div className="mt-3 text-center">
                    <p className="text-sm text-gray-600">
                      Showing responsibilities assigned to{' '}
                      <span className="font-semibold">
                        {founders.find(f => f.id === activeRoleTab)?.name}
                      </span>
                    </p>
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-2xl shadow-xl p-6">
                {(() => {
                  const roles = [
                    {
                      id: 1,
                      key: 'leadership',
                      title: "Leadership & KPIs",
                      color: "from-indigo-500 to-purple-600",
                      borderColor: "border-indigo-200",
                      bgColor: "bg-indigo-50",
                      hours: roleHours.leadership
                    },
                    {
                      id: 2,
                      key: 'maintenance',
                      title: "Maintain Gym Amenities",
                      color: "from-blue-500 to-cyan-600",
                      borderColor: "border-blue-200",
                      bgColor: "bg-blue-50",
                      hours: roleHours.maintenance
                    },
                    {
                      id: 3,
                      key: 'inGymCoaching',
                      title: "In-Gym Coaching",
                      color: "from-green-500 to-emerald-600",
                      borderColor: "border-green-200",
                      bgColor: "bg-green-50",
                      hours: roleHours.inGymCoaching
                    },
                    {
                      id: 4,
                      key: 'remoteCoaching',
                      title: "Remote Coaching",
                      color: "from-teal-500 to-cyan-600",
                      borderColor: "border-teal-200",
                      bgColor: "bg-teal-50",
                      hours: roleHours.remoteCoaching
                    },
                    {
                      id: 5,
                      key: 'coachManagement',
                      title: "Coach & Training Management",
                      color: "from-orange-500 to-red-600",
                      borderColor: "border-orange-200",
                      bgColor: "bg-orange-50",
                      hours: roleHours.coachManagement
                    },
                    {
                      id: 6,
                      key: 'sales',
                      title: "Sales",
                      color: "from-purple-500 to-pink-600",
                      borderColor: "border-purple-200",
                      bgColor: "bg-purple-50",
                      hours: roleHours.sales
                    },
                    {
                      id: 7,
                      key: 'marketing',
                      title: "Marketing",
                      color: "from-pink-500 to-rose-600",
                      borderColor: "border-pink-200",
                      bgColor: "bg-pink-50",
                      hours: roleHours.marketing
                    },
                    {
                      id: 8,
                      key: 'partnerships',
                      title: "Strategic Partnerships",
                      color: "from-violet-500 to-purple-600",
                      borderColor: "border-violet-200",
                      bgColor: "bg-violet-50",
                      hours: roleHours.partnerships
                    },
                    {
                      id: 9,
                      key: 'clientSuccess',
                      title: "Client Success",
                      color: "from-amber-500 to-orange-600",
                      borderColor: "border-amber-200",
                      bgColor: "bg-amber-50",
                      hours: roleHours.clientSuccess
                    },
                    {
                      id: 10,
                      key: 'facilities',
                      title: "Facilities & Supplies",
                      color: "from-gray-500 to-slate-600",
                      borderColor: "border-gray-200",
                      bgColor: "bg-gray-50",
                      hours: roleHours.facilities
                    },
                    {
                      id: 11,
                      key: 'admin',
                      title: "Admin & Finance",
                      color: "from-slate-500 to-gray-600",
                      borderColor: "border-slate-200",
                      bgColor: "bg-slate-50",
                      hours: roleHours.admin
                    }
                  ];
                  
                  // Different layout for individual founder view
                  if (activeRoleTab !== 'all') {
                    // Collect all tasks assigned to this founder with their role info
                    const founderTasks = [];
                    const categoryTotals = {};
                    
                    roles.forEach(role => {
                      const bullets = roleBullets[role.key]?.filter(bullet => 
                        bullet.assignees.includes(activeRoleTab)
                      ) || [];
                      
                      // Calculate total hours for this category for this founder
                      const categoryHours = bullets.reduce((sum, bullet) => sum + (bullet.hours?.[activeRoleTab] || 0), 0);
                      if (bullets.length > 0) {
                        categoryTotals[role.key] = {
                          title: role.title,
                          totalHours: roleHours[role.key] || 0,
                          founderHours: categoryHours,
                          color: role.bgColor,
                          borderColor: role.borderColor
                        };
                      }
                      
                      bullets.forEach(bullet => {
                        founderTasks.push({
                          ...bullet,
                          roleKey: role.key,
                          roleTitle: role.title,
                          roleColor: role.color,
                          roleBgColor: role.bgColor,
                          roleBorderColor: role.borderColor
                        });
                      });
                    });
                    
                    const totalFounderHours = founderTasks.reduce((sum, task) => sum + (task.hours?.[activeRoleTab] || 0), 0);
                    
                    return (
                      <div className="space-y-3">
                        {founderTasks.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="text-gray-400 mb-2">
                              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            </div>
                            <p className="text-gray-600 font-medium">No responsibilities assigned yet</p>
                            <p className="text-sm text-gray-500 mt-1">
                              Assign tasks to {founders.find(f => f.id === activeRoleTab)?.name} from the All view
                            </p>
                          </div>
                        ) : (
                          founderTasks.map((task, index) => (
                            <div key={task.id} className="border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors">
                              <div className="p-4">
                                <div className="flex items-start gap-3">
                                  <span className="text-gray-400 mt-1 flex-shrink-0">•</span>
                                  <div className="flex-1 space-y-2">
                                    {/* Task text */}
                                    <div className="flex items-start gap-2">
                                      <textarea
                                        value={task.text}
                                        onChange={(e) => updateBulletText(task.roleKey, task.id, e.target.value)}
                                        className="flex-1 text-[15px] text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none transition-colors leading-relaxed py-0.5 resize-none overflow-hidden min-h-[1.5em]"
                                        placeholder="Enter task description..."
                                        rows={1}
                                        ref={(el) => {
                                          if (el && task.text) {
                                            el.style.height = 'auto';
                                            el.style.height = el.scrollHeight + 'px';
                                          }
                                        }}
                                        onInput={(e) => {
                                          e.currentTarget.style.height = 'auto';
                                          e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                        }}
                                      />
                                      <button
                                        onClick={() => removeBullet(task.roleKey, task.id)}
                                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 p-1"
                                        title="Remove bullet"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                    
                                    {/* Category, hours, and other assignees */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${task.roleBgColor} ${task.roleBorderColor} border`}>
                                          {task.roleTitle}
                                        </span>
                                        
                                        {/* Hours input */}
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            min="0"
                                            max="20"
                                            step="0.5"
                                            value={task.hours?.[activeRoleTab] || ''}
                                            onChange={(e) => updateBulletHours(task.roleKey, task.id, activeRoleTab, parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                            className="w-14 px-2 py-0.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                          />
                                          <span className="text-xs text-gray-500">h/w</span>
                                        </div>
                                      </div>
                                      
                                      {/* Show other assignees */}
                                      <div className="flex items-center gap-1">
                                        {task.assignees.filter(id => id !== activeRoleTab).map(assigneeId => {
                                          const assignee = founders.find(f => f.id === assigneeId);
                                          return assignee ? (
                                            <span key={assigneeId} className="text-xs text-gray-500">
                                              + {assignee.name}
                                            </span>
                                          ) : null;
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  }
                  
                  // Original grid layout for "All" view
                  return (
                    <>
                      {/* Roles Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {roles.map((role) => {
                          return (
                            <div key={role.id} className={`border ${role.borderColor} rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300`}>
                            {/* Header */}
                            <div className={`${role.bgColor} px-4 py-3 border-b ${role.borderColor}`}>
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-800">{role.title}</h4>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="40"
                                    step="0.5"
                                    value={role.hours || ''}
                                    onChange={(e) => {
                                      const newHours = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                      setRoleHours(prev => ({
                                        ...prev,
                                        [role.key]: newHours
                                      }));
                                    }}
                                    className={`w-16 px-2 py-1 rounded-lg text-center bg-white border-2 ${role.borderColor} text-gray-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-${role.color.split(' ')[1].split('-')[0]}-400`}
                                  />
                                  <span className="text-sm font-medium text-gray-600">h/week</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Bullets */}
                            <div className="px-4 py-3 bg-white">
                              <ul className="space-y-3">
                                {roleBullets[role.key]?.filter(bullet => {
                                  // Filter bullets based on active tab
                                  if (activeRoleTab === 'all') return true;
                                  return bullet.assignees.includes(activeRoleTab);
                                }).map((bullet, bulletIndex) => (
                                  <li key={bullet.id} className="group">
                                    <div className="flex items-start gap-2">
                                      <span className="text-gray-400 mt-1 flex-shrink-0">•</span>
                                      <div className="flex-1 space-y-2">
                                        <div className="flex items-start gap-2">
                                          <textarea
                                            value={bullet.text}
                                            onChange={(e) => updateBulletText(role.key, bullet.id, e.target.value)}
                                            className="flex-1 text-[15px] text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none transition-colors leading-relaxed py-0.5 resize-none overflow-hidden min-h-[1.5em]"
                                            placeholder="Enter task description..."
                                            rows={1}
                                            ref={(el) => {
                                              if (el && bullet.text) {
                                                el.style.height = 'auto';
                                                el.style.height = el.scrollHeight + 'px';
                                              }
                                            }}
                                            onInput={(e) => {
                                              e.currentTarget.style.height = 'auto';
                                              e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                            }}
                                          />
                                          <button
                                            onClick={() => removeBullet(role.key, bullet.id)}
                                            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 p-1"
                                            title="Remove bullet"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                        
                                        {/* Founder assignment badges with hours */}
                                        <div className="space-y-2">
                                          <div className="flex flex-wrap gap-1">
                                            {founders.map((founder) => (
                                              <button
                                                key={founder.id}
                                                onClick={() => toggleAssignee(role.key, bullet.id, founder.id)}
                                                className={`px-2 py-0.5 text-xs rounded-full transition-all ${
                                                  bullet.assignees.includes(founder.id)
                                                    ? 'bg-gray-700 text-white'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                              >
                                                {founder.name}
                                              </button>
                                            ))}
                                          </div>
                                          
                                          {/* Hours section with expand/collapse */}
                                          {bullet.assignees.length > 0 && (
                                            <>
                                              <button
                                                onClick={() => toggleBulletExpanded(role.key, bullet.id)}
                                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                              >
                                                <svg 
                                                  className={`w-3 h-3 transition-transform duration-200 ${bullet.expanded ? 'rotate-180' : ''}`}
                                                  fill="none" 
                                                  stroke="currentColor" 
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                                <span>Hours allocation</span>
                                                <span className="text-gray-400">
                                                  ({bullet.assignees.reduce((sum, fId) => sum + (bullet.hours?.[fId] || 0), 0)}h total)
                                                </span>
                                              </button>
                                              
                                              {/* Hours inputs for assigned founders */}
                                              {bullet.expanded && (
                                                <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-gray-200 mt-2">
                                                  {bullet.assignees.map(founderId => {
                                                    const founder = founders.find(f => f.id === founderId);
                                                    return founder ? (
                                                      <div key={founderId} className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                                                        <span className="text-xs text-gray-600">{founder.name}:</span>
                                                        <input
                                                          type="number"
                                                          min="0"
                                                          max="20"
                                                          step="0.5"
                                                          value={bullet.hours?.[founderId] || ''}
                                                          onChange={(e) => updateBulletHours(role.key, bullet.id, founderId, parseFloat(e.target.value) || 0)}
                                                          placeholder="0"
                                                          className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                        />
                                                        <span className="text-xs text-gray-500">h</span>
                                                      </div>
                                                    ) : null;
                                                  })}
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                              
                              {/* Add bullet button */}
                              <button
                                onClick={() => addBullet(role.key)}
                                className="mt-3 w-full py-2 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add responsibility
                              </button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                      
                      {/* Empty state when founder has no tasks */}
                      {activeRoleTab !== 'all' && (() => {
                        const founderHasAnyTasks = Object.values(roleBullets).some(bullets => 
                          bullets.some(b => b.assignees.includes(activeRoleTab))
                        );
                        if (!founderHasAnyTasks) {
                          const founder = founders.find(f => f.id === activeRoleTab);
                          return (
                            <div className="mt-8 text-center py-12">
                              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                              </div>
                              <h4 className="text-lg font-semibold text-gray-800 mb-2">
                                No responsibilities assigned to {founder?.name}
                              </h4>
                              <p className="text-gray-600 max-w-md mx-auto">
                                Click on role items above and select {founder?.name}'s badge to assign responsibilities.
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Total Hours Summary */}
                      <div className="mt-6 p-4 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-semibold text-gray-800">Total Weekly Hours</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-gray-900">
                              {Object.values(roleHours).reduce((sum, hours) => sum + hours, 0)}
                            </span>
                            <span className="text-sm font-medium text-gray-600">hours/week</span>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          This represents the total weekly commitment across all roles and responsibilities.
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            </CollapsibleSection>
          </div>
          
          {/* Hours Summary */}
          <div className="p-8 bg-gradient-to-br from-indigo-50 to-blue-50">
            <CollapsibleSection title="⏰ Hours Summary" defaultOpen={false}>
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 text-center">
                  Hours Summary
                </h3>
                <p className="text-gray-600 mt-2">Weekly time allocation by founder and category</p>
              </div>
              
              <div className="bg-white rounded-2xl shadow-xl p-6">
                {(() => {
                  // Define roles array
                  const roles = [
                    {
                      id: 1,
                      key: 'leadership',
                      title: "Leadership & KPIs",
                      color: "from-indigo-500 to-purple-600",
                      borderColor: "border-indigo-200",
                      bgColor: "bg-indigo-50",
                      hours: roleHours.leadership
                    },
                    {
                      id: 2,
                      key: 'maintenance',
                      title: "Maintain Gym Amenities",
                      color: "from-blue-500 to-cyan-600",
                      borderColor: "border-blue-200",
                      bgColor: "bg-blue-50",
                      hours: roleHours.maintenance
                    },
                    {
                      id: 3,
                      key: 'inGymCoaching',
                      title: "In-Gym Coaching",
                      color: "from-green-500 to-emerald-600",
                      borderColor: "border-green-200",
                      bgColor: "bg-green-50",
                      hours: roleHours.inGymCoaching
                    },
                    {
                      id: 4,
                      key: 'remoteCoaching',
                      title: "Remote Coaching",
                      color: "from-teal-500 to-cyan-600",
                      borderColor: "border-teal-200",
                      bgColor: "bg-teal-50",
                      hours: roleHours.remoteCoaching
                    },
                    {
                      id: 5,
                      key: 'coachManagement',
                      title: "Coach & Training Management",
                      color: "from-orange-500 to-red-600",
                      borderColor: "border-orange-200",
                      bgColor: "bg-orange-50",
                      hours: roleHours.coachManagement
                    },
                    {
                      id: 6,
                      key: 'sales',
                      title: "Sales",
                      color: "from-purple-500 to-pink-600",
                      borderColor: "border-purple-200",
                      bgColor: "bg-purple-50",
                      hours: roleHours.sales
                    },
                    {
                      id: 7,
                      key: 'marketing',
                      title: "Marketing",
                      color: "from-pink-500 to-rose-600",
                      borderColor: "border-pink-200",
                      bgColor: "bg-pink-50",
                      hours: roleHours.marketing
                    },
                    {
                      id: 8,
                      key: 'partnerships',
                      title: "Strategic Partnerships",
                      color: "from-violet-500 to-purple-600",
                      borderColor: "border-violet-200",
                      bgColor: "bg-violet-50",
                      hours: roleHours.partnerships
                    },
                    {
                      id: 9,
                      key: 'clientSuccess',
                      title: "Client Success",
                      color: "from-amber-500 to-orange-600",
                      borderColor: "border-amber-200",
                      bgColor: "bg-amber-50",
                      hours: roleHours.clientSuccess
                    },
                    {
                      id: 10,
                      key: 'facilities',
                      title: "Facilities & Supplies",
                      color: "from-gray-500 to-slate-600",
                      borderColor: "border-gray-200",
                      bgColor: "bg-gray-50",
                      hours: roleHours.facilities
                    },
                    {
                      id: 11,
                      key: 'admin',
                      title: "Admin & Finance",
                      color: "from-slate-500 to-gray-600",
                      borderColor: "border-slate-200",
                      bgColor: "bg-slate-50",
                      hours: roleHours.admin
                    }
                  ];
                  
                  // Calculate hours breakdown for each founder by category
                  const hoursBreakdown = {};
                  const founderTotals = {};
                  
                  founders.forEach(founder => {
                    founderTotals[founder.id] = 0;
                  });
                  
                  roles.forEach(role => {
                    hoursBreakdown[role.key] = {
                      title: role.title,
                      color: role.color,
                      bgColor: role.bgColor,
                      borderColor: role.borderColor,
                      totalHours: roleHours[role.key] || 0,
                      founders: {}
                    };
                    
                    founders.forEach(founder => {
                      hoursBreakdown[role.key].founders[founder.id] = 0;
                    });
                    
                    roleBullets[role.key]?.forEach(bullet => {
                      bullet.assignees.forEach(founderId => {
                        const bulletHours = bullet.hours?.[founderId] || 0;
                        hoursBreakdown[role.key].founders[founderId] += bulletHours;
                        founderTotals[founderId] = (founderTotals[founderId] || 0) + bulletHours;
                      });
                    });
                  });
                  
                  return (
                    <div className="space-y-6">
                      {/* Category Breakdown */}
                      <div className="space-y-4">
                        {Object.entries(hoursBreakdown).map(([key, category]: [string, any]) => {
                          const hasAnyHours = Object.values(category.founders).some(h => h > 0);
                          if (!hasAnyHours && category.totalHours === 0) return null;
                          
                          return (
                            <div key={key} className={`border ${category.borderColor} rounded-xl overflow-hidden`}>
                              {/* Category Header */}
                              <div className={`${category.bgColor} px-4 py-2 border-b ${category.borderColor}`}>
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-gray-800">{category.title}</h4>
                                  <div className="text-sm">
                                    <span className="font-semibold text-gray-900">
                                      {Object.values(category.founders).reduce((sum: number, h: number) => sum + h, 0)}h
                                    </span>
                                    <span className="text-gray-600"> / {category.totalHours}h allocated</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Founder Bars */}
                              <div className="p-4 bg-white">
                                <div className="space-y-3">
                                  {founders.map((founder, index) => {
                                    const founderHours = category.founders[founder.id] || 0;
                                    const percentage = category.totalHours > 0 ? (founderHours / category.totalHours) * 100 : 0;
                                    
                                    if (founderHours === 0) return null;
                                    
                                    // Use unique colors for each founder for better distinction
                                    const founderColors = [
                                      'from-blue-400 to-blue-600',
                                      'from-green-400 to-green-600',
                                      'from-purple-400 to-purple-600',
                                      'from-orange-400 to-orange-600',
                                      'from-pink-400 to-pink-600'
                                    ];
                                    
                                    return (
                                      <div key={founder.id} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="font-medium text-gray-700">{founder.name}</span>
                                          <span className="text-gray-600">{founderHours}h</span>
                                        </div>
                                        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                                          <div 
                                            className={`absolute left-0 top-0 h-full bg-gradient-to-r ${founderColors[index]} transition-all duration-500 ease-out`}
                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                  
                                  {/* Show unallocated hours if any */}
                                  {(() => {
                                    const allocatedHours = Object.values(category.founders).reduce((sum: number, h: number) => sum + h, 0);
                                    const unallocated = category.totalHours - allocatedHours;
                                    if (unallocated > 0) {
                                      return (
                                        <div className="pt-2 border-t border-gray-100">
                                          <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-500 italic">Unallocated</span>
                                            <span className="text-gray-500">{unallocated}h</span>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Founder Summary Cards */}
                      <div className="grid grid-cols-5 gap-1 sm:gap-3 mt-6">
                        {founders.map(founder => (
                          <div key={founder.id} className="bg-gray-50 rounded-lg p-1.5 sm:p-3 text-center">
                            <h5 className="font-medium text-gray-800 text-xs sm:text-sm truncate">{founder.name}</h5>
                            <div className="text-lg sm:text-2xl font-bold text-gray-900">{founderTotals[founder.id] || 0}h</div>
                            <div className="text-[10px] sm:text-xs text-gray-500 leading-tight">per<br className="sm:hidden"/> week</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            </CollapsibleSection>
          </div>
          
          {/* Financial Projections Flow */}
          <div ref={financialProjectionsRef} className="p-8 bg-gradient-to-br from-indigo-50 to-purple-50">
            <CollapsibleSection title="📊 Financial Projections" defaultOpen={false}>
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-3 flex items-center justify-center gap-2">
                  <span className="text-2xl">💸</span>
                  Cost Projections & Analysis
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
                            ? `${((projectionStep - 1) / 4) * 100}%` 
                            : `${((projectionStep - 1) / 2) * 100}%` 
                        }}
                      ></div>
                    </div>
                    
                    {/* Step circles */}
                    {(isAdvancedMode ? [1, 2, 3, 4, 5] : [1, 2, 3]).map((step) => (
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
                  <div className={`${(projectionStep === 2 && !isAdvancedMode) || (projectionStep === 3 && isAdvancedMode) ? 'block' : 'hidden'} p-8 space-y-8`}>
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
                        onClick={() => setProjectionStep(isAdvancedMode ? 2 : 1)}
                        className="bg-gray-500 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-gray-600 transition-colors shadow-lg"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setProjectionStep(isAdvancedMode ? 4 : 3)}
                        className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg"
                      >
                        Review
                      </button>
                    </div>
                  </div>

                  {/* Advanced Mode Steps 2-6 (Placeholders) */}
                  {isAdvancedMode && (
                    <>
                      {/* Step 2: Kyle & Tony Contribution */}
                      <div className={`${projectionStep === 2 && isAdvancedMode ? 'block' : 'hidden'} p-8 space-y-8`}>
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
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">#</span>
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
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">#</span>
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

                      {/* Step 1: Operating Costs */}
                      <div className={`${projectionStep === 1 && isAdvancedMode ? 'block' : 'hidden'} p-8 space-y-8`}>
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
                                  const startClients = i === 0 ? (Number(groupClassClientsStart[i]) || 0) : (Number(groupClassClientsEnd[i-1]) || 0);
                                  const avgClients = (startClients + (Number(groupClassClientsEnd[i]) || 0)) / 2;
                                  const calculatedCost = calculateGroupCoachingCost(avgClients, i);
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
                              const startGroupClients = i === 0 ? (Number(groupClassClientsStart[i]) || 0) : (Number(groupClassClientsEnd[i-1]) || 0);
                              const avgGroupClients = (startGroupClients + (Number(groupClassClientsEnd[i]) || 0)) / 2;
                              const defaultGroupCoachingCost = calculateGroupCoachingCost(avgGroupClients, i);
                              
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
                              const startClients = i === 0 ? (Number(groupClassClientsStart[i]) || 0) : (Number(groupClassClientsEnd[i-1]) || 0);
                              const avgClients = (startClients + (Number(groupClassClientsEnd[i]) || 0)) / 2;
                              const calculationDetails = getCalculationDetails(avgClients, i);
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
                            onClick={() => setProjectionStep(2)}
                            className="bg-indigo-600 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg"
                          >
                            →
                          </button>
                        </div>
                      </div>

                      {/* Step 4: Review & Projections */}
                      <div className={`${projectionStep === 4 && isAdvancedMode ? 'block' : 'hidden'} p-8 space-y-8`}>
                        <div>
                          <div className="text-center mb-8">
                            <h4 className="text-xl font-bold text-gray-800 mb-2">Financial Review & Projections</h4>
                            <p className="text-gray-600 text-sm">Review your 5-year financial projections and monthly profit breakdown</p>
                          </div>


                          {/* Year-by-Year Breakdown */}
                          <div className="space-y-4">
                            {Array.from({ length: projectionYears }, (_, i) => {
                              // Revenue Calculations
                              const startGroupClients = i === 0 ? (Number(groupClassClientsStart[i]) || 0) : (Number(groupClassClientsEnd[i-1]) || 0);
                              const avgGroupClients = (startGroupClients + (Number(groupClassClientsEnd[i]) || 0)) / 2;
                              const startSemiPrivateClients = i === 0 ? (Number(semiPrivateClientsStart[i]) || 0) : (Number(semiPrivateClientsEnd[i-1]) || 0);
                              const avgSemiPrivateClients = (startSemiPrivateClients + (Number(semiPrivateClientsEnd[i]) || 0)) / 2;
                              const groupRevenue = (Number(groupClassPrices[i]) || 0) * avgGroupClients;
                              const semiPrivateRevenue = (Number(semiPrivatePrices[i]) || 0) * avgSemiPrivateClients;
                              const totalRevenue = groupRevenue + semiPrivateRevenue;
                              
                              // Cost Calculations
                              const operatingCost = Number(operatingCosts[i]) || 0;
                              const paidAdsCost = Number(paidAdsCosts[i]) || 0;
                              const groupCoachingCost = calculateGroupCoachingCost(avgGroupClients, i);
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
                            onClick={() => setProjectionStep(3)}
                            className="bg-gray-500 text-white w-12 h-12 rounded-full text-lg font-bold hover:bg-gray-600 transition-colors shadow-lg"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => setProjectionStep(5)}
                            className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg"
                          >
                            See Results
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Results Page */}
                  <div className={`${(projectionStep === 3 && !isAdvancedMode) || (projectionStep === 5 && isAdvancedMode) ? 'block' : 'hidden'} p-8 space-y-8`}>
                    <div>
                      <div className="text-center mb-8">
                        <h4 className="text-xl font-bold text-gray-800 mb-6">Your {projectionYears}-Year Founder Journey</h4>
                        {(() => {
                          // Calculate monthly profits for all years first
                          const calculatedMonthlyProfits = [];
                          for (let i = 0; i < projectionYears; i++) {
                            if (isAdvancedMode) {
                              // Advanced mode: calculate profit from detailed inputs
                              const startGroupClients = i === 0 ? (Number(groupClassClientsStart[i]) || 0) : (Number(groupClassClientsEnd[i-1]) || 0);
                              const avgGroupClients = (startGroupClients + (Number(groupClassClientsEnd[i]) || 0)) / 2;
                              const startSemiPrivateClients = i === 0 ? (Number(semiPrivateClientsStart[i]) || 0) : (Number(semiPrivateClientsEnd[i-1]) || 0);
                              const avgSemiPrivateClients = (startSemiPrivateClients + (Number(semiPrivateClientsEnd[i]) || 0)) / 2;
                              const groupRevenue = (Number(groupClassPrices[i]) || 0) * avgGroupClients;
                              const semiPrivateRevenue = (Number(semiPrivatePrices[i]) || 0) * avgSemiPrivateClients;
                              const totalRevenue = groupRevenue + semiPrivateRevenue;
                              
                              const operatingCost = Number(operatingCosts[i]) || 0;
                              const paidAdsCost = Number(paidAdsCosts[i]) || 0;
                              const groupCoachingCost = calculateGroupCoachingCost(avgGroupClients, i);
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
                              const avgSemiPrivateClients = ((Number(semiPrivateClientsStart[i]) || 0) + (Number(semiPrivateClientsEnd[i]) || 0)) / 2;
                              const semiPrivateRevenue = (Number(semiPrivatePrices[i]) || 0) * avgSemiPrivateClients;
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
                                      const startGroupClients = i === 0 ? (Number(groupClassClientsStart[i]) || 0) : (Number(groupClassClientsEnd[i-1]) || 0);
                                      const avgGroupClients = (startGroupClients + (Number(groupClassClientsEnd[i]) || 0)) / 2;
                                      const groupCoachingMonthly = calculateGroupCoachingCost(avgGroupClients, i);
                                      groupCoachingAnnual = groupCoachingMonthly * 12;
                                      
                                      const startSemiPrivateClients = i === 0 ? (Number(semiPrivateClientsStart[i]) || 0) : (Number(semiPrivateClientsEnd[i-1]) || 0);
                                      const avgSemiPrivateClients = (startSemiPrivateClients + (Number(semiPrivateClientsEnd[i]) || 0)) / 2;
                                      const semiPrivateRevenue = (Number(semiPrivatePrices[i]) || 0) * avgSemiPrivateClients;
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
                                      const startGroupClients = i === 0 ? (Number(groupClassClientsStart[i]) || 0) : (Number(groupClassClientsEnd[i-1]) || 0);
                                      const avgGroupClients = (startGroupClients + (Number(groupClassClientsEnd[i]) || 0)) / 2;
                                      const groupCoachingMonthly = calculateGroupCoachingCost(avgGroupClients, i);
                                      groupCoachingAnnual = groupCoachingMonthly * 12;
                                      
                                      const startSemiPrivateClients = i === 0 ? (Number(semiPrivateClientsStart[i]) || 0) : (Number(semiPrivateClientsEnd[i-1]) || 0);
                                      const avgSemiPrivateClients = (startSemiPrivateClients + (Number(semiPrivateClientsEnd[i]) || 0)) / 2;
                                      const semiPrivateRevenue = (Number(semiPrivatePrices[i]) || 0) * avgSemiPrivateClients;
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
                        onClick={() => setProjectionStep(isAdvancedMode ? 4 : 2)}
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
            </CollapsibleSection>
          </div>
          
          {/* Visual Equity Split Display */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <CollapsibleSection title="📊 Equity Distribution" defaultOpen={false}>
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
            </CollapsibleSection>
          </div>


          {/* Personal Equity Builder */}
          <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50">
            <CollapsibleSection title="💼 Your Personal Equity Breakdown" defaultOpen={false}>
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
            </CollapsibleSection>
          </div>

        </div>
      </div>
    </div>
  );
}