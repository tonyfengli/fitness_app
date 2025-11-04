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
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Get the Sunday of the week containing the given date
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
  
  console.log('=== FILTER DEBUG ===');
  console.log('Filter received:', JSON.stringify(filter));
  console.log('Filter length:', filter.length);
  console.log('Contains " - "?', filter.includes(' - '));
  console.log('isMonthName?', isMonthName(filter));
  console.log('Contains space?', filter.includes(' '));
  
  if (filter === '2 Weeks') {
    originalEnd = new Date(today);
    originalStart = new Date(today);
    originalStart.setDate(today.getDate() - 13); // 2 weeks ago = 14 days back
  } else if (filter === '4 Weeks') {
    originalEnd = new Date(today);
    originalStart = new Date(today);
    originalStart.setDate(today.getDate() - 27); // 4 weeks ago = 28 days back
  } else if (filter.includes(' - ')) {
    // Handle custom month ranges like "January 2025 - June 2025" - CHECK THIS FIRST!
    const [startMonthYear, endMonthYear] = filter.split(' - ');
    
    console.log('Parsing date range:', filter);
    console.log('Start part:', JSON.stringify(startMonthYear), 'End part:', JSON.stringify(endMonthYear));
    
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
    
    console.log('Start parts:', JSON.stringify(startParts), 'parsed:', startMonthName, startYear, 'index:', startMonthIndex);
    console.log('End parts:', JSON.stringify(endParts), 'parsed:', endMonthName, endYear, 'index:', endMonthIndex);
    
    if (startMonthIndex !== -1 && endMonthIndex !== -1) {
      originalStart = new Date(startYear, startMonthIndex, 1);
      originalEnd = new Date(endYear, endMonthIndex + 1, 0); // Last day of end month
      
      console.log('Created dates - Start:', originalStart, 'End:', originalEnd);
    } else {
      // Fallback if invalid month names
      originalStart = new Date(today);
      originalStart.setDate(today.getDate() - 13);
      originalEnd = new Date(today);
      
      console.log('Fallback used - invalid month names, startIndex:', startMonthIndex, 'endIndex:', endMonthIndex);
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
      originalEnd = new Date(year, monthIndex + 1, 0); // Last day of month
    } else {
      // Fallback if invalid month
      originalStart = new Date(today);
      originalStart.setDate(today.getDate() - 13);
      originalEnd = new Date(today);
    }
  } else {
    // Handle single custom month or fallback
    const monthIndex = getMonthIndex(filter);
    if (monthIndex !== -1) {
      const year = today.getFullYear();
      originalStart = new Date(year, monthIndex, 1);
      originalEnd = new Date(year, monthIndex + 1, 0);
    } else {
      // Fallback to 2 weeks
      originalStart = new Date(today);
      originalEnd = new Date(today);
      originalEnd.setDate(today.getDate() + 13);
    }
  }
  
  // Auto-adjust to complete weeks
  const adjustedStart = getWeekStart(originalStart);
  const adjustedEnd = getWeekEnd(originalEnd);
  
  console.log('Week adjustment:');
  console.log('Adjusted start:', adjustedStart);
  console.log('Adjusted end:', adjustedEnd);
  
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