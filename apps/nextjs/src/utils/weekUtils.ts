/**
 * Week boundary utilities for attendance tracking
 * Ensures all date ranges start on Monday and end on Sunday
 */

export interface WeekRange {
  start: Date;
  end: Date;
  label: string;
  wasAdjusted: boolean;
  originalStart?: Date;
  originalEnd?: Date;
}

/**
 * Get the Monday of the week containing the given date
 * Preserves the time from the original date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  d.setDate(diff);
  return d;
}

/**
 * Get the Sunday of the week containing the given date
 * Preserves the time from the original date
 */
export function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return weekEnd;
}

/**
 * Get all complete Monday-Sunday weeks within a date range
 */
export function getCompleteWeeksInRange(startDate: Date, endDate: Date): WeekRange[] {
  const weeks: WeekRange[] = [];
  const adjustedStart = getWeekStart(startDate);
  const adjustedEnd = getWeekEnd(endDate);
  
  let currentWeekStart = new Date(adjustedStart);
  
  while (currentWeekStart <= adjustedEnd) {
    const weekEnd = getWeekEnd(currentWeekStart);
    
    // Only include complete weeks that fall within our range
    if (weekEnd <= adjustedEnd) {
      weeks.push({
        start: new Date(currentWeekStart),
        end: weekEnd,
        label: `${formatShortDate(currentWeekStart)} - ${formatShortDate(weekEnd)}`,
        wasAdjusted: false
      });
    }
    
    // Move to next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }
  
  return weeks;
}

/**
 * Process a filter selection and return adjusted date range
 */
export function processFilterSelection(filter: string, currentDate: Date = new Date()): WeekRange {
  const today = new Date(currentDate);
  let originalStart: Date;
  let originalEnd: Date;
  
  
  if (filter === 'Last 2 Weeks' || filter === '2 Weeks') {
    // For "last 2 completed weeks", we need to exclude the current week
    // End should be last Sunday (end of previous week) at end of day
    const currentWeekStart = getWeekStart(today);
    originalEnd = new Date(currentWeekStart);
    originalEnd.setDate(currentWeekStart.getDate() - 1); // Go to last Sunday
    originalEnd.setHours(23, 59, 59, 999); // Set to end of day
    
    // Start should be 2 weeks before that at start of day
    originalStart = new Date(originalEnd);
    originalStart.setDate(originalEnd.getDate() - 13); // 2 weeks ago = 14 days back
    originalStart.setHours(0, 0, 0, 0); // Set to start of day
  } else if (filter === 'Last 4 Weeks' || filter === '4 Weeks') {
    // For "last 4 completed weeks", we need to exclude the current week
    // End should be last Sunday (end of previous week) at end of day
    const currentWeekStart = getWeekStart(today);
    originalEnd = new Date(currentWeekStart);
    originalEnd.setDate(currentWeekStart.getDate() - 1); // Go to last Sunday
    originalEnd.setHours(23, 59, 59, 999); // Set to end of day
    
    // Start should be 4 weeks before that at start of day
    originalStart = new Date(originalEnd);
    originalStart.setDate(originalEnd.getDate() - 27); // 4 weeks ago = 28 days back
    originalStart.setHours(0, 0, 0, 0); // Set to start of day
  } else if (filter.includes(' - ')) {
    // Handle custom month ranges like "January 2025 - June 2025" - CHECK THIS FIRST!
    const [startMonthYear, endMonthYear] = filter.split(' - ');
    
    // Parse start month and year
    const startParts = startMonthYear!.trim().split(' ');
    const startMonthName = startParts[0]!;
    const startYear = startParts[1] ? parseInt(startParts[1]) : today.getFullYear();
    const startMonthIndex = getMonthIndex(startMonthName);
    
    // Parse end month and year
    const endParts = endMonthYear!.trim().split(' ');
    const endMonthName = endParts[0]!;
    const endYear = endParts[1] ? parseInt(endParts[1]) : today.getFullYear();
    const endMonthIndex = getMonthIndex(endMonthName);
    
    if (startMonthIndex !== -1 && endMonthIndex !== -1) {
      originalStart = new Date(startYear, startMonthIndex, 1);
      originalStart.setHours(0, 0, 0, 0); // Start of first day
      originalEnd = new Date(endYear, endMonthIndex + 1, 0); // Last day of end month
      originalEnd.setHours(23, 59, 59, 999); // End of last day
    } else {
      // Fallback if invalid month names
      originalStart = new Date(today);
      originalStart.setDate(today.getDate() - 13);
      originalStart.setHours(0, 0, 0, 0);
      originalEnd = new Date(today);
      originalEnd.setHours(23, 59, 59, 999);
    }
  } else if (isMonthName(filter) || filter.includes(' ')) {
    // Handle both "October" and "October 2023" formats
    let monthName = filter;
    let year = today.getFullYear();
    
    if (filter.includes(' ')) {
      const parts = filter.split(' ');
      monthName = parts[0]!;
      year = parseInt(parts[1]!) || today.getFullYear();
    }
    
    const monthIndex = getMonthIndex(monthName);
    if (monthIndex !== -1) {
      originalStart = new Date(year, monthIndex, 1);
      originalStart.setHours(0, 0, 0, 0); // Start of first day
      originalEnd = new Date(year, monthIndex + 1, 0); // Last day of month
      originalEnd.setHours(23, 59, 59, 999); // End of last day
    } else {
      // Fallback if invalid month
      originalStart = new Date(today);
      originalStart.setDate(today.getDate() - 13);
      originalStart.setHours(0, 0, 0, 0);
      originalEnd = new Date(today);
      originalEnd.setHours(23, 59, 59, 999);
    }
  } else {
    // Handle single custom month or fallback
    const monthIndex = getMonthIndex(filter);
    if (monthIndex !== -1) {
      const year = today.getFullYear();
      originalStart = new Date(year, monthIndex, 1);
      originalStart.setHours(0, 0, 0, 0); // Start of first day
      originalEnd = new Date(year, monthIndex + 1, 0);
      originalEnd.setHours(23, 59, 59, 999); // End of last day
    } else {
      // Fallback to 2 weeks
      originalStart = new Date(today);
      originalStart.setDate(today.getDate() - 13);
      originalStart.setHours(0, 0, 0, 0);
      originalEnd = new Date(today);
      originalEnd.setHours(23, 59, 59, 999);
    }
  }
  
  // Auto-adjust to complete weeks (this is the core design principle)
  // ALL filters should start on Monday and end on Sunday for consistent week-based calculations
  const adjustedStart = getWeekStart(originalStart);
  const adjustedEnd = getWeekEnd(originalEnd);
  
  // Ensure proper start/end of day timing for week boundaries
  adjustedStart.setHours(0, 0, 0, 0);
  adjustedEnd.setHours(23, 59, 59, 999);
  
  // Minimal logging for debugging (uncomment if needed)
  // console.log(`[${filter}] ${adjustedStart.toISOString()} to ${adjustedEnd.toISOString()}`);
  
  const wasAdjusted = 
    adjustedStart.getTime() !== originalStart.getTime() || 
    adjustedEnd.getTime() !== originalEnd.getTime();
  
  return {
    start: adjustedStart,
    end: adjustedEnd,
    label: `${formatShortDate(adjustedStart)} - ${formatShortDate(adjustedEnd)}`,
    wasAdjusted,
    originalStart,
    originalEnd
  };
}

/**
 * Check if a string is a month name
 */
function isMonthName(str: string): boolean {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months.includes(str);
}

/**
 * Get month index (0-11) from month name
 */
function getMonthIndex(monthName: string): number {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const index = months.indexOf(monthName);
  return index; // Will return -1 if not found
}

/**
 * Format date as MMM D (e.g., "Nov 4")
 */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Format date as "Mon, Nov 4"
 */
export function formatDateWithDay(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Format date as "November 4, 2024"
 */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Calculate the number of complete weeks in a date range
 */
export function getWeekCount(startDate: Date, endDate: Date): number {
  const weeks = getCompleteWeeksInRange(startDate, endDate);
  return weeks.length;
}

/**
 * Get the most recent complete month
 * A complete month is one where all full weeks of that month are in the past
 */
export function getMostRecentCompleteMonth(currentDate: Date = new Date()): string {
  const today = new Date(currentDate);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Start from previous month and work backwards
  let testMonth = currentMonth - 1;
  let testYear = currentYear;
  
  // Handle January (go to December of previous year)
  if (testMonth < 0) {
    testMonth = 11;
    testYear = currentYear - 1;
  }
  
  // Check if this month has all complete weeks in the past
  const firstDayOfMonth = new Date(testYear, testMonth, 1);
  const lastDayOfMonth = new Date(testYear, testMonth + 1, 0);
  
  // Get the last complete week of the month
  const lastWeekEnd = getWeekEnd(lastDayOfMonth);
  
  // If the last week of the month ends before today, this month is complete
  if (lastWeekEnd < today) {
    return `${monthNames[testMonth]} ${testYear}`;
  }
  
  // If current month isn't complete, go to previous month
  testMonth = testMonth - 1;
  if (testMonth < 0) {
    testMonth = 11;
    testYear = testYear - 1;
  }
  
  return `${monthNames[testMonth]} ${testYear}`;
}