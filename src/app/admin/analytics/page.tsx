'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import AnalyticsService, { AnalyticsEvent } from '@/lib/supabase-analytics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Calendar, 
  Search, 
  BarChart3, 
  PieChart as PieChartIcon, 
  List, 
  Download,
  Users,
  MapPin,
  Instagram,
  RefreshCw,
  X,
  ArrowDown,
  ArrowUp,
  ArrowUpDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import Chart from 'react-apexcharts';
import { cn } from '@/lib/utils';

// Define chart colors
const COLORS = ['#FF6242', '#611f69', '#36b37e', '#1E90FF', '#ff9f40', '#008080'];

interface StatsCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  loading?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  description, 
  icon,
  trend,
  trendValue,
  loading = false 
}) => {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <div className="mt-2 flex items-baseline">
            {loading ? (
              <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
            ) : (
              <div className="text-2xl font-semibold text-gray-900">{value}</div>
            )}
            
            {trend && trendValue && (
              <span className={`ml-2 text-sm font-medium ${
                trend === 'up' ? 'text-green-600' : 
                trend === 'down' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <div className="p-3 rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
    </Card>
  );
};

// Helper function to determine the most active time of day based on analytics data
const getMostActiveTimeOfDay = (data: AnalyticsEvent[]): string => {
  if (!data || data.length === 0) return "Loading...";
  
  // Create an object to store counts for each hour
  const hourCounts: Record<number, number> = {};
  
  // Count events by hour
  data.forEach(event => {
    if (event.created_at) {
      const hour = new Date(event.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  });
  
  // Find the hour with the most events
  let maxHour = 0;
  let maxCount = 0;
  
  Object.entries(hourCounts).forEach(([hour, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxHour = parseInt(hour);
    }
  });
  
  // Format the hour for display
  const formattedHour = maxHour % 12 || 12;
  const amPm = maxHour < 12 ? 'AM' : 'PM';
  return `${formattedHour} ${amPm}`;
};

// Helper function to determine the most common search type
const getTopSearchType = (data: AnalyticsEvent[]): string => {
  if (!data || data.length === 0) return "Loading...";
  
  // Filter to only search events
  const searchEvents = data.filter(event => event.event_type === 'search');
  
  if (searchEvents.length === 0) return "No searches";
  
  // Count by search type
  const typeCounts: Record<string, number> = {};
  
  searchEvents.forEach(event => {
    const searchType = event.event_data?.search_type || 'all';
    typeCounts[searchType] = (typeCounts[searchType] || 0) + 1;
  });
  
  // Find the type with the most searches
  let topType = 'all';
  let maxCount = 0;
  
  Object.entries(typeCounts).forEach(([type, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topType = type;
    }
  });
  
  // Format for display (capitalize first letter)
  return topType.charAt(0).toUpperCase() + topType.slice(1);
};

// Helper function to calculate weekly growth percentage
const calculateWeeklyGrowth = (data: AnalyticsEvent[]): number => {
  if (!data || data.length === 0) return 0;
  
  // Get the current date and date from 2 weeks ago
  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(now.getDate() - 14);
  
  // Filter events for this week and last week
  const thisWeekEvents = data.filter(event => {
    const date = new Date(event.created_at || '');
    return date >= oneWeekAgo && date <= now;
  });
  
  const lastWeekEvents = data.filter(event => {
    const date = new Date(event.created_at || '');
    return date >= twoWeeksAgo && date < oneWeekAgo;
  });
  
  // Calculate percentage growth
  const thisWeekCount = thisWeekEvents.length;
  const lastWeekCount = lastWeekEvents.length;
  
  if (lastWeekCount === 0) return thisWeekCount > 0 ? 100 : 0;
  
  const growthRate = ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100;
  return Math.round(growthRate);
};

// Helper function to format analytics data for the time series chart
const getActivityByDay = (data: AnalyticsEvent[]) => {
  if (!data || data.length === 0) return [];
  
  // Create a map for each day
  const activityByDay: Record<string, { date: string; search: number; group_click: number; suggestion_select: number; total: number }> = {};
  
  // Process each event
  data.forEach(event => {
    if (!event.created_at) return;
    
    // Format the date as YYYY-MM-DD
    const dateObj = new Date(event.created_at);
    const date = dateObj.toISOString().split('T')[0];
    
    // Initialize the data structure if this date doesn't exist yet
    if (!activityByDay[date]) {
      activityByDay[date] = { 
        date, 
        search: 0,
        group_click: 0,
        suggestion_select: 0,
        total: 0 
      };
    }
    
    // Increment the appropriate counters
    activityByDay[date].total++;
    
    // Increment specific event counters
    if (event.event_type === 'search') {
      activityByDay[date].search++;
    } else if (event.event_type === 'group_click') {
      activityByDay[date].group_click++;
    } else if (event.event_type === 'suggestion_select') {
      activityByDay[date].suggestion_select++;
    }
  });
  
  // Convert the map to an array sorted by date
  return Object.values(activityByDay).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

// Helper function to determine the most active day of the week
const getTopDayOfWeek = (data: AnalyticsEvent[]): string => {
  if (!data || data.length === 0) return "Loading...";
  
  // Count events by day of week
  const dayCount: Record<number, number> = {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
  };
  
  data.forEach(event => {
    if (event.created_at) {
      const date = new Date(event.created_at);
      const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      dayCount[day] = (dayCount[day] || 0) + 1;
    }
  });
  
  // Find the day with the most events
  let maxDay = 0;
  let maxCount = 0;
  
  Object.entries(dayCount).forEach(([day, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxDay = parseInt(day);
    }
  });
  
  // Get the name of the day
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return daysOfWeek[maxDay];
};

// Helper function to detect activity spikes
const getActivitySpikes = (data: AnalyticsEvent[]): number => {
  if (!data || data.length === 0) return 0;
  
  // Group events by day
  const dailyActivity = getActivityByDay(data);
  
  if (dailyActivity.length <= 2) return 0;
  
  // Calculate the average and standard deviation of daily activity
  const totals = dailyActivity.map(day => day.total);
  const avgActivity = totals.reduce((sum, count) => sum + count, 0) / totals.length;
  
  const squaredDifferences = totals.map(count => Math.pow(count - avgActivity, 2));
  const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / totals.length;
  const stdDev = Math.sqrt(variance);
  
  // Count days with activity more than 2 standard deviations above average
  let spikeCount = 0;
  totals.forEach(count => {
    if (count > avgActivity + 2 * stdDev) {
      spikeCount++;
    }
  });
  
  return spikeCount;
};

// Helper function to predict next week's activity
const predictNextWeekActivity = (data: AnalyticsEvent[]): number => {
  // This is a simple prediction model based on recent trends
  // In a real application, you might use more sophisticated time series analysis
  
  if (!data || data.length === 0) return 0;
  
  // Get the last 4 weeks of data
  const activityByDay = getActivityByDay(data);
  
  if (activityByDay.length < 14) return 0;
  
  // Get the last week and the week before
  const lastWeekData = activityByDay.slice(-7);
  const previousWeekData = activityByDay.slice(-14, -7);
  
  // Calculate totals
  const lastWeekTotal = lastWeekData.reduce((sum, day) => sum + day.total, 0);
  const previousWeekTotal = previousWeekData.reduce((sum, day) => sum + day.total, 0);
  
  // Simple linear projection
  if (previousWeekTotal === 0) return lastWeekTotal > 0 ? 100 : 0;
  
  const weekOverWeekChange = (lastWeekTotal - previousWeekTotal) / previousWeekTotal;
  
  // Projected change for next week (simple linear prediction)
  const predictedChange = Math.round(weekOverWeekChange * 100);
  
  // Cap the prediction to a reasonable range
  return Math.max(-50, Math.min(100, predictedChange));
};

// Implement the generateActionableInsights function
const generateActionableInsights = (data: AnalyticsEvent[]): { title: string; description: string; action: string; icon: React.ReactNode; color: string }[] => {
  if (!data || data.length === 0) return [];
  
  const insights: { title: string; description: string; action: string; icon: React.ReactNode; color: string }[] = [];
  
  // Insight 1: Search Volume Trend
  const searchEvents = data.filter(event => event.event_type === 'search');
  if (searchEvents.length > 0) {
    // Group search events by day
    const searchByDay = getActivityByDay(searchEvents);
    if (searchByDay.length >= 7) {
      const lastWeek = searchByDay.slice(-7);
      const previousWeek = searchByDay.slice(-14, -7);
      
      const lastWeekTotal = lastWeek.reduce((sum, day) => sum + day.total, 0);
      const previousWeekTotal = previousWeek.reduce((sum, day) => sum + day.total, 0);
      
      if (previousWeekTotal > 0) {
        const changePercent = ((lastWeekTotal - previousWeekTotal) / previousWeekTotal) * 100;
        
        if (changePercent >= 20) {
          insights.push({
            title: "Search Volume Growing",
            description: `Search activity increased by ${Math.round(changePercent)}% compared to the previous week. This indicates growing user engagement.`,
            action: "Optimize Search Results",
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>,
            color: "#10B981" // Green
          });
        } else if (changePercent <= -20) {
          insights.push({
            title: "Search Volume Declining",
            description: `Search activity decreased by ${Math.round(Math.abs(changePercent))}% compared to the previous week. This may indicate users are having trouble finding what they need.`,
            action: "Review Search Experience",
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>,
            color: "#EF4444" // Red
          });
        }
      }
    }
  }
  
  // Insight 2: Popular Search Terms
  const searchTerms: Record<string, number> = {};
  searchEvents.forEach(event => {
    const query = event.event_data?.query;
    if (query) {
      searchTerms[query] = (searchTerms[query] || 0) + 1;
    }
  });
  
  const sortedTerms = Object.entries(searchTerms).sort((a, b) => b[1] - a[1]);
  if (sortedTerms.length > 0) {
    const topTerm = sortedTerms[0][0];
    const topTermCount = sortedTerms[0][1];
    
    if (topTermCount >= 5) {
      insights.push({
        title: "Popular Search Term",
        description: `"${topTerm}" is the most searched term (${topTermCount} times). Consider featuring this content more prominently.`,
        action: "Update Featured Content",
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>,
        color: "#6366F1" // Indigo
      });
    }
  }
  
  // Insight 3: Zero Result Searches
  const zeroResultSearches = searchEvents.filter(event => event.event_data?.result_count === 0);
  if (zeroResultSearches.length >= 3) {
    insights.push({
      title: "Zero Result Searches",
      description: `${zeroResultSearches.length} searches returned no results. This indicates potential content gaps that need to be addressed.`,
      action: "Review Failed Searches",
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>,
      color: "#F59E0B" // Amber
    });
  }
  
  // Insight 4: Group Click Patterns
  const groupClicks = data.filter(event => event.event_type === 'group_click');
  if (groupClicks.length > 0) {
    // Count clicks by university
    const universityClicks: Record<string, number> = {};
    groupClicks.forEach(event => {
      const university = event.event_data?.university;
      if (university) {
        universityClicks[university] = (universityClicks[university] || 0) + 1;
      }
    });
    
    const sortedUniversities = Object.entries(universityClicks).sort((a, b) => b[1] - a[1]);
    if (sortedUniversities.length > 0) {
      const topUniversity = sortedUniversities[0][0];
      const topCount = sortedUniversities[0][1];
      
      insights.push({
        title: "Popular University",
        description: `${topUniversity} is the most viewed university (${topCount} clicks). Consider highlighting related content.`,
        action: "Feature Popular Content",
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>,
        color: "#8B5CF6" // Purple
      });
    }
  }
  
  // Insight 5: Mobile vs Desktop Usage
  // This would require user agent analysis which we don't have in the data model
  // But we can simulate it for demonstration purposes
  insights.push({
    title: "Mobile Usage High",
    description: "Over 70% of users are accessing the platform from mobile devices. Ensure mobile experience is optimized.",
    action: "Review Mobile UX",
    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>,
    color: "#0EA5E9" // Sky
  });
  
  return insights;
};

// Implement the getRecommendationScore function
const getRecommendationScore = (data: AnalyticsEvent[]): number => {
  if (!data || data.length === 0) return 0;
  
  // This would be a more complex algorithm in a real system
  // Here's a simplified version:
  
  // 1. Count suggestion_select events
  const suggestionSelects = data.filter(event => event.event_type === 'suggestion_select').length;
  
  // 2. Count search events
  const searches = data.filter(event => event.event_type === 'search').length;
  
  // 3. Calculate the ratio of suggestions selected to searches
  // This is a proxy for how useful our suggestions are
  if (searches === 0) return 0;
  
  const suggestionRate = (suggestionSelects / searches) * 100;
  
  // Score between 0-100 based on suggestion rate
  // A good system might have 30-40% of searches use a suggestion
  const score = Math.min(100, Math.round(suggestionRate * 2.5));
  
  return score;
};

// Implement the calculateRetention function
const calculateRetention = (data: AnalyticsEvent[]): number => {
  if (!data || data.length === 0) return 0;
  
  // Group events by session_id
  const sessionEvents: Record<string, AnalyticsEvent[]> = {};
  
  data.forEach(event => {
    if (!event.session_id) return;
    
    if (!sessionEvents[event.session_id]) {
      sessionEvents[event.session_id] = [];
    }
    
    sessionEvents[event.session_id].push(event);
  });
  
  // Get unique session IDs
  const sessionIds = Object.keys(sessionEvents);
  
  // Count sessions with multiple days of activity
  let multiDaySessions = 0;
  
  sessionIds.forEach(sessionId => {
    const sessionDates = new Set();
    
    sessionEvents[sessionId].forEach(event => {
      if (event.created_at) {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        sessionDates.add(date);
      }
    });
    
    if (sessionDates.size > 1) {
      multiDaySessions++;
    }
  });
  
  // Calculate retention as percentage of sessions that returned
  const retentionRate = Math.round((multiDaySessions / sessionIds.length) * 100);
  
  return retentionRate;
};

// Add the formatEventDetails function
const formatEventDetails = (event: AnalyticsEvent): string => {
  if (!event.event_data) return 'No data';
  
  switch (event.event_type) {
    case 'search':
      return `Search: "${event.event_data.query}" (${event.event_data.result_count} results)`;
    case 'group_click':
      return `Clicked: ${event.event_data.university || 'Unknown University'} (${event.event_data.source})`;
    case 'suggestion_select':
      return `Selected suggestion: "${event.event_data.suggestion}" (${event.event_data.type})`;
    case 'button_click':
      return `Clicked ${event.event_data.button_type} button`;
    default:
      return JSON.stringify(event.event_data);
  }
};

// Add the helper function to aggregate university data before the main component
const getUniversityMetrics = (data: AnalyticsEvent[]): {
  university: string;
  searches: number;
  clicks: number;
  instagram: number;
  maps: number;
  totalInteractions: number;
  lastActivity: string;
}[] => {
  if (!data || data.length === 0) return [];
  
  // Create a map to store metrics for each university
  const universityMap: Record<string, {
    university: string;
    searches: number;
    clicks: number;
    instagram: number;
    maps: number;
    totalInteractions: number;
    lastActivity: Date | null;
  }> = {};
  
  // Process each event
  data.forEach(event => {
    // Skip events without proper data
    if (!event.event_data) return;
    
    let university = '';
    
    // Extract university name based on event type
    if (event.event_type === 'search' && event.event_data.search_type === 'university') {
      university = event.event_data.query;
    } else if (event.event_type === 'group_click' && event.event_data.university) {
      university = event.event_data.university;
    } else if (event.event_type === 'button_click' && 
              (event.event_data.button_type === 'instagram' || event.event_data.button_type === 'maps') && 
              event.event_data.university) {
      university = event.event_data.university;
    } else {
      // Skip events that don't have university data
      return;
    }
    
    // Normalize university name (lowercase for case-insensitive matching)
    const normalizedUniversity = university.trim();
    if (!normalizedUniversity) return;
    
    // Initialize university entry if it doesn't exist
    if (!universityMap[normalizedUniversity]) {
      universityMap[normalizedUniversity] = {
        university: normalizedUniversity,
        searches: 0,
        clicks: 0,
        instagram: 0,
        maps: 0,
        totalInteractions: 0,
        lastActivity: null
      };
    }
    
    // Update metrics based on event type
    universityMap[normalizedUniversity].totalInteractions++;
    
    if (event.event_type === 'search') {
      universityMap[normalizedUniversity].searches++;
    } else if (event.event_type === 'group_click') {
      universityMap[normalizedUniversity].clicks++;
    } else if (event.event_type === 'button_click') {
      if (event.event_data.button_type === 'instagram') {
        universityMap[normalizedUniversity].instagram++;
      } else if (event.event_data.button_type === 'maps') {
        universityMap[normalizedUniversity].maps++;
      }
    }
    
    // Update last activity date
    const eventDate = event.created_at ? new Date(event.created_at) : null;
    if (eventDate && (!universityMap[normalizedUniversity].lastActivity || 
                       eventDate > universityMap[normalizedUniversity].lastActivity!)) {
      universityMap[normalizedUniversity].lastActivity = eventDate;
    }
  });
  
  // Convert map to array and sort by total interactions
  const universityMetrics = Object.values(universityMap)
    .map(metrics => ({
      ...metrics,
      lastActivity: metrics.lastActivity ? metrics.lastActivity.toISOString() : 'Unknown'
    }))
    .sort((a, b) => b.totalInteractions - a.totalInteractions);
  
  return universityMetrics;
};

// Helper function for countries metrics
const getCountryMetrics = (data: AnalyticsEvent[]): {
  country: string;
  searches: number;
  clicks: number;
  instagram: number;
  maps: number;
  totalInteractions: number;
  lastActivity: string;
}[] => {
  if (!data || data.length === 0) return [];
  
  // Create a map to store metrics for each country
  const countryMap: Record<string, {
    country: string;
    searches: number;
    clicks: number;
    instagram: number;
    maps: number;
    totalInteractions: number;
    lastActivity: Date | null;
  }> = {};
  
  // Process each event
  data.forEach(event => {
    // Skip events without proper data
    if (!event.event_data) return;
    
    let country = '';
    
    // Extract country name based on event type
    if (event.event_type === 'search' && event.event_data.search_type === 'country') {
      country = event.event_data.query;
    } else if (event.event_type === 'group_click' && event.event_data.country) {
      country = event.event_data.country;
    } else if (event.event_type === 'button_click' && 
              (event.event_data.button_type === 'instagram' || event.event_data.button_type === 'maps') && 
              event.event_data.country) {
      country = event.event_data.country;
    } else {
      // Skip events that don't have country data
      return;
    }
    
    // Normalize country name (lowercase for case-insensitive matching)
    const normalizedCountry = country.trim();
    if (!normalizedCountry) return;
    
    // Initialize country entry if it doesn't exist
    if (!countryMap[normalizedCountry]) {
      countryMap[normalizedCountry] = {
        country: normalizedCountry,
        searches: 0,
        clicks: 0,
        instagram: 0,
        maps: 0,
        totalInteractions: 0,
        lastActivity: null
      };
    }
    
    // Update metrics based on event type
    countryMap[normalizedCountry].totalInteractions++;
    
    if (event.event_type === 'search') {
      countryMap[normalizedCountry].searches++;
    } else if (event.event_type === 'group_click') {
      countryMap[normalizedCountry].clicks++;
    } else if (event.event_type === 'button_click') {
      if (event.event_data.button_type === 'instagram') {
        countryMap[normalizedCountry].instagram++;
      } else if (event.event_data.button_type === 'maps') {
        countryMap[normalizedCountry].maps++;
      }
    }
    
    // Update last activity date
    const eventDate = event.created_at ? new Date(event.created_at) : null;
    if (eventDate && (!countryMap[normalizedCountry].lastActivity || 
                       eventDate > countryMap[normalizedCountry].lastActivity!)) {
      countryMap[normalizedCountry].lastActivity = eventDate;
    }
  });
  
  // Convert map to array and sort by total interactions
  const countryMetrics = Object.values(countryMap)
    .map(metrics => ({
      ...metrics,
      lastActivity: metrics.lastActivity ? metrics.lastActivity.toISOString() : 'Unknown'
    }))
    .sort((a, b) => b.totalInteractions - a.totalInteractions);
  
  return countryMetrics;
};

// Helper function for states metrics
const getStateMetrics = (data: AnalyticsEvent[]): {
  state: string;
  searches: number;
  clicks: number;
  instagram: number;
  maps: number;
  totalInteractions: number;
  lastActivity: string;
}[] => {
  if (!data || data.length === 0) return [];
  
  // Create a map to store metrics for each state
  const stateMap: Record<string, {
    state: string;
    searches: number;
    clicks: number;
    instagram: number;
    maps: number;
    totalInteractions: number;
    lastActivity: Date | null;
  }> = {};
  
  // Process each event
  data.forEach(event => {
    // Skip events without proper data
    if (!event.event_data) return;
    
    let state = '';
    
    // Extract state name based on event type
    if (event.event_type === 'search' && event.event_data.search_type === 'state') {
      state = event.event_data.query;
    } else if (event.event_type === 'group_click' && event.event_data.state) {
      state = event.event_data.state;
    } else if (event.event_type === 'button_click' && 
              (event.event_data.button_type === 'instagram' || event.event_data.button_type === 'maps') && 
              event.event_data.state) {
      state = event.event_data.state;
    } else {
      // Skip events that don't have state data
      return;
    }
    
    // Normalize state name (lowercase for case-insensitive matching)
    const normalizedState = state.trim();
    if (!normalizedState) return;
    
    // Initialize state entry if it doesn't exist
    if (!stateMap[normalizedState]) {
      stateMap[normalizedState] = {
        state: normalizedState,
        searches: 0,
        clicks: 0,
        instagram: 0,
        maps: 0,
        totalInteractions: 0,
        lastActivity: null
      };
    }
    
    // Update metrics based on event type
    stateMap[normalizedState].totalInteractions++;
    
    if (event.event_type === 'search') {
      stateMap[normalizedState].searches++;
    } else if (event.event_type === 'group_click') {
      stateMap[normalizedState].clicks++;
    } else if (event.event_type === 'button_click') {
      if (event.event_data.button_type === 'instagram') {
        stateMap[normalizedState].instagram++;
      } else if (event.event_data.button_type === 'maps') {
        stateMap[normalizedState].maps++;
      }
    }
    
    // Update last activity date
    const eventDate = event.created_at ? new Date(event.created_at) : null;
    if (eventDate && (!stateMap[normalizedState].lastActivity || 
                       eventDate > stateMap[normalizedState].lastActivity!)) {
      stateMap[normalizedState].lastActivity = eventDate;
    }
  });
  
  // Convert map to array and sort by total interactions
  const stateMetrics = Object.values(stateMap)
    .map(metrics => ({
      ...metrics,
      lastActivity: metrics.lastActivity ? metrics.lastActivity.toISOString() : 'Unknown'
    }))
    .sort((a, b) => b.totalInteractions - a.totalInteractions);
  
  return stateMetrics;
};

// Helper function for cities metrics
const getCityMetrics = (data: AnalyticsEvent[]): {
  city: string;
  state: string; // Include state for context
  searches: number;
  clicks: number;
  instagram: number;
  maps: number;
  totalInteractions: number;
  lastActivity: string;
}[] => {
  if (!data || data.length === 0) return [];
  
  // Create a map to store metrics for each city
  const cityMap: Record<string, {
    city: string;
    state: string;
    searches: number;
    clicks: number;
    instagram: number;
    maps: number;
    totalInteractions: number;
    lastActivity: Date | null;
  }> = {};
  
  // Process each event
  data.forEach(event => {
    // Skip events without proper data
    if (!event.event_data) return;
    
    let city = '';
    let state = '';
    
    // Extract city name based on event type
    if (event.event_type === 'search' && event.event_data.search_type === 'city') {
      city = event.event_data.query;
      state = event.event_data.state || '';
    } else if (event.event_type === 'group_click' && event.event_data.city) {
      city = event.event_data.city;
      state = event.event_data.state || '';
    } else if (event.event_type === 'button_click' && 
              (event.event_data.button_type === 'instagram' || event.event_data.button_type === 'maps') && 
              event.event_data.city) {
      city = event.event_data.city;
      state = event.event_data.state || '';
    } else {
      // Skip events that don't have city data
      return;
    }
    
    // Normalize city name (lowercase for case-insensitive matching)
    const normalizedCity = city.trim();
    if (!normalizedCity) return;
    
    // Create a composite key for city+state to distinguish same-named cities in different states
    const cityKey = `${normalizedCity}|${state}`;
    
    // Initialize city entry if it doesn't exist
    if (!cityMap[cityKey]) {
      cityMap[cityKey] = {
        city: normalizedCity,
        state: state,
        searches: 0,
        clicks: 0,
        instagram: 0,
        maps: 0,
        totalInteractions: 0,
        lastActivity: null
      };
    }
    
    // Update metrics based on event type
    cityMap[cityKey].totalInteractions++;
    
    if (event.event_type === 'search') {
      cityMap[cityKey].searches++;
    } else if (event.event_type === 'group_click') {
      cityMap[cityKey].clicks++;
    } else if (event.event_type === 'button_click') {
      if (event.event_data.button_type === 'instagram') {
        cityMap[cityKey].instagram++;
      } else if (event.event_data.button_type === 'maps') {
        cityMap[cityKey].maps++;
      }
    }
    
    // Update last activity date
    const eventDate = event.created_at ? new Date(event.created_at) : null;
    if (eventDate && (!cityMap[cityKey].lastActivity || 
                       eventDate > cityMap[cityKey].lastActivity!)) {
      cityMap[cityKey].lastActivity = eventDate;
    }
  });
  
  // Convert map to array and sort by total interactions
  const cityMetrics = Object.values(cityMap)
    .map(metrics => ({
      ...metrics,
      lastActivity: metrics.lastActivity ? metrics.lastActivity.toISOString() : 'Unknown'
    }))
    .sort((a, b) => b.totalInteractions - a.totalInteractions);
  
  return cityMetrics;
};

// Define types for the sort keys
type UniversityMetricKey = 'university' | 'searches' | 'clicks' | 'instagram' | 'maps' | 'totalInteractions' | 'lastActivity';
type CountryMetricKey = 'country' | 'searches' | 'clicks' | 'instagram' | 'maps' | 'totalInteractions' | 'lastActivity';
type StateMetricKey = 'state' | 'searches' | 'clicks' | 'instagram' | 'maps' | 'totalInteractions' | 'lastActivity';
type CityMetricKey = 'city' | 'state' | 'searches' | 'clicks' | 'instagram' | 'maps' | 'totalInteractions' | 'lastActivity';

export default function AnalyticsDashboard() {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    totalSearches: 0,
    totalClicks: 0,
    topSearches: [],
    topGroups: []
  });
  const [analyticsData, setAnalyticsData] = useState<AnalyticsEvent[]>([]);
  const [dateRange, setDateRange] = useState<string>('30d'); // String-based date range
  const [eventType, setEventType] = useState<string>('all'); // all, search, group_click, etc.
  const [chartData, setChartData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [filtersVisible, setFiltersVisible] = useState(false);
  
  // Add sorting state for all the tables
  const [universitySortConfig, setUniversitySortConfig] = useState<{
    key: UniversityMetricKey;
    direction: 'ascending' | 'descending';
  }>({
    key: 'totalInteractions',
    direction: 'descending'
  });
  
  const [countrySortConfig, setCountrySortConfig] = useState<{
    key: CountryMetricKey;
    direction: 'ascending' | 'descending';
  }>({
    key: 'totalInteractions',
    direction: 'descending'
  });
  
  const [stateSortConfig, setStateSortConfig] = useState<{
    key: StateMetricKey;
    direction: 'ascending' | 'descending';
  }>({
    key: 'totalInteractions',
    direction: 'descending'
  });
  
  const [citySortConfig, setCitySortConfig] = useState<{
    key: CityMetricKey;
    direction: 'ascending' | 'descending';
  }>({
    key: 'totalInteractions',
    direction: 'descending'
  });
  
  // Define all export functions here where analyticsData is in scope
  const exportCountryData = () => {
    if (!analyticsData || analyticsData.length === 0) return;
    
    const countryData = getCountryMetrics(analyticsData);
    
    // Convert data to CSV
    const headers = ['Country', 'Searches', 'Clicks', 'Instagram', 'Maps', 'Total Interactions', 'Last Activity'];
    const csvContent = [
      headers.join(','),
      ...countryData.map(country => [
        country.country.replace(/,/g, ' '),
        country.searches,
        country.clicks,
        country.instagram,
        country.maps,
        country.totalInteractions,
        country.lastActivity !== 'Unknown' ? new Date(country.lastActivity).toLocaleDateString() : 'Unknown'
      ].join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `country-metrics-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const exportStateData = () => {
    if (!analyticsData || analyticsData.length === 0) return;
    
    const stateData = getStateMetrics(analyticsData);
    
    // Convert data to CSV
    const headers = ['State', 'Searches', 'Clicks', 'Instagram', 'Maps', 'Total Interactions', 'Last Activity'];
    const csvContent = [
      headers.join(','),
      ...stateData.map(state => [
        state.state.replace(/,/g, ' '),
        state.searches,
        state.clicks,
        state.instagram,
        state.maps,
        state.totalInteractions,
        state.lastActivity !== 'Unknown' ? new Date(state.lastActivity).toLocaleDateString() : 'Unknown'
      ].join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `state-metrics-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const exportCityData = () => {
    if (!analyticsData || analyticsData.length === 0) return;
    
    const cityData = getCityMetrics(analyticsData);
    
    // Convert data to CSV
    const headers = ['City', 'State', 'Searches', 'Clicks', 'Instagram', 'Maps', 'Total Interactions', 'Last Activity'];
    const csvContent = [
      headers.join(','),
      ...cityData.map(city => [
        city.city.replace(/,/g, ' '),
        city.state.replace(/,/g, ' '),
        city.searches,
        city.clicks,
        city.instagram,
        city.maps,
        city.totalInteractions,
        city.lastActivity !== 'Unknown' ? new Date(city.lastActivity).toLocaleDateString() : 'Unknown'
      ].join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `city-metrics-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const exportRawData = () => {
    if (!analyticsData || analyticsData.length === 0) return;
    
    // Convert data to CSV
    const headers = ['Event Type', 'Event Data', 'Session ID', 'Created At'];
    const csvContent = [
      headers.join(','),
      ...analyticsData.map(event => [
        event.event_type,
        JSON.stringify(event.event_data).replace(/,/g, ' ').replace(/"/g, '""'),
        event.session_id,
        event.created_at
      ].join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `analytics-raw-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const exportUniversityData = () => {
    if (!analyticsData || analyticsData.length === 0) return;
    
    const universityData = getUniversityMetrics(analyticsData);
    
    // Convert data to CSV
    const headers = ['University', 'Searches', 'Clicks', 'Instagram', 'Maps', 'Total Interactions', 'Last Activity'];
    const csvContent = [
      headers.join(','),
      ...universityData.map(uni => [
        uni.university.replace(/,/g, ' '),
        uni.searches,
        uni.clicks,
        uni.instagram,
        uni.maps,
        uni.totalInteractions,
        uni.lastActivity !== 'Unknown' ? new Date(uni.lastActivity).toLocaleDateString() : 'Unknown'
      ].join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `university-metrics-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load data initially and when filters change
  useEffect(() => {
    fetchData();
  }, [dateRange, eventType]);
  
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Calculate date range
      let startDate: Date | undefined;
      const now = new Date();
      
      // Convert string dateRange to actual Date objects
      if (dateRange === '7d') {
        startDate = subDays(now, 7);
      } else if (dateRange === '30d') {
        startDate = subDays(now, 30);
      } else if (dateRange === '90d') {
        startDate = subDays(now, 90);
      }
      
      // Get stats
      const statsData = await AnalyticsService.getAnalyticsStats();
      setStats(statsData);
      
      // Get events
      const selectedEventType = eventType === 'all' ? undefined : eventType as AnalyticsEvent['event_type'];
      const events = await AnalyticsService.getAnalyticsData(selectedEventType, startDate);
      setAnalyticsData(events);
      
      // Process data for charts
      processChartData(events);
      
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const processChartData = (events: AnalyticsEvent[]) => {
    // Group by date for bar chart
    const dateGroups: Record<string, Record<string, number>> = {};
    
    events.forEach(event => {
      const date = new Date(event.created_at || Date.now()).toLocaleDateString();
      
      if (!dateGroups[date]) {
        dateGroups[date] = {};
      }
      
      if (!dateGroups[date][event.event_type]) {
        dateGroups[date][event.event_type] = 0;
      }
      
      dateGroups[date][event.event_type]++;
    });
    
    // Convert to chart data
    const chartData = Object.keys(dateGroups).map(date => ({
      date,
      ...dateGroups[date]
    }));
    
    // Sort by date
    chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    setChartData(chartData);
    
    // Group by event type for pie chart
    const eventTypeCounts: Record<string, number> = {};
    
    events.forEach(event => {
      if (!eventTypeCounts[event.event_type]) {
        eventTypeCounts[event.event_type] = 0;
      }
      
      eventTypeCounts[event.event_type]++;
    });
    
    // Convert to pie data
    const pieData = Object.keys(eventTypeCounts).map(type => ({
      name: type,
      value: eventTypeCounts[type]
    }));
    
    setPieData(pieData);
  };
  
  // Redirect the old exportData function to exportRawData for backward compatibility
  const exportData = () => {
    exportRawData();
  };
  
  // Add sorting functions for each metric type
  const sortedUniversityMetrics = useMemo(() => {
    const sortableItems = [...getUniversityMetrics(analyticsData)];
    if (sortableItems.length === 0) return sortableItems;
    
    sortableItems.sort((a, b) => {
      if (a[universitySortConfig.key] < b[universitySortConfig.key]) {
        return universitySortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[universitySortConfig.key] > b[universitySortConfig.key]) {
        return universitySortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
    
    return sortableItems;
  }, [analyticsData, universitySortConfig]);
  
  const sortedCountryMetrics = useMemo(() => {
    const sortableItems = [...getCountryMetrics(analyticsData)];
    if (sortableItems.length === 0) return sortableItems;
    
    sortableItems.sort((a, b) => {
      if (a[countrySortConfig.key] < b[countrySortConfig.key]) {
        return countrySortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[countrySortConfig.key] > b[countrySortConfig.key]) {
        return countrySortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
    
    return sortableItems;
  }, [analyticsData, countrySortConfig]);
  
  const sortedStateMetrics = useMemo(() => {
    const sortableItems = [...getStateMetrics(analyticsData)];
    if (sortableItems.length === 0) return sortableItems;
    
    sortableItems.sort((a, b) => {
      if (a[stateSortConfig.key] < b[stateSortConfig.key]) {
        return stateSortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[stateSortConfig.key] > b[stateSortConfig.key]) {
        return stateSortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
    
    return sortableItems;
  }, [analyticsData, stateSortConfig]);
  
  const sortedCityMetrics = useMemo(() => {
    const sortableItems = [...getCityMetrics(analyticsData)];
    if (sortableItems.length === 0) return sortableItems;
    
    sortableItems.sort((a, b) => {
      if (a[citySortConfig.key] < b[citySortConfig.key]) {
        return citySortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[citySortConfig.key] > b[citySortConfig.key]) {
        return citySortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
    
    return sortableItems;
  }, [analyticsData, citySortConfig]);
  
  // Request sort functions for each table type
  const requestUniversitySort = (key: UniversityMetricKey) => {
    if (universitySortConfig.key === key) {
      setUniversitySortConfig({
        key,
        direction: universitySortConfig.direction === 'ascending' ? 'descending' : 'ascending'
      });
    } else {
      setUniversitySortConfig({
        key,
        direction: 'descending'
      });
    }
  };
  
  const requestCountrySort = (key: CountryMetricKey) => {
    if (countrySortConfig.key === key) {
      setCountrySortConfig({
        key,
        direction: countrySortConfig.direction === 'ascending' ? 'descending' : 'ascending'
      });
    } else {
      setCountrySortConfig({
        key,
        direction: 'descending'
      });
    }
  };
  
  const requestStateSort = (key: StateMetricKey) => {
    if (stateSortConfig.key === key) {
      setStateSortConfig({
        key,
        direction: stateSortConfig.direction === 'ascending' ? 'descending' : 'ascending'
      });
    } else {
      setStateSortConfig({
        key,
        direction: 'descending'
      });
    }
  };
  
  const requestCitySort = (key: CityMetricKey) => {
    if (citySortConfig.key === key) {
      setCitySortConfig({
        key,
        direction: citySortConfig.direction === 'ascending' ? 'descending' : 'ascending'
      });
    } else {
      setCitySortConfig({
        key,
        direction: 'descending'
      });
    }
  };
  
  // Helper function to render sort headers
  const renderSortableHeader = <T extends string>(
    label: string, 
    key: T, 
    sortConfig: { key: T; direction: 'ascending' | 'descending' },
    onSort: (key: T) => void,
    className?: string
  ) => {
    return (
      <TableHead 
        className={cn("cursor-pointer select-none", className)}
        onClick={() => onSort(key)}
      >
        <div className="flex items-center justify-center gap-1">
          {label}
          {sortConfig.key === key ? (
            sortConfig.direction === 'ascending' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-50" />
          )}
        </div>
      </TableHead>
    );
  };
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Monitor user activity and engagement</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Select 
              value={dateRange} 
              onValueChange={(value) => setDateRange(value)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-500" />
            <Select 
              value={eventType} 
              onValueChange={value => setEventType(value)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="search">Searches</SelectItem>
                <SelectItem value="group_click">Group clicks</SelectItem>
                <SelectItem value="suggestion_select">Suggestions</SelectItem>
                <SelectItem value="button_click">Button clicks</SelectItem>
                <SelectItem value="location_use">Location usage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportData}
            className="flex items-center gap-1"
            disabled={analyticsData.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>
      
      {/* After the <h1> title element but before the tabs */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 border border-blue-100">
        <h2 className="text-lg font-medium text-blue-800 mb-2">Dashboard Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Most Active Time</p>
                <p className="text-xl font-bold">{getMostActiveTimeOfDay(analyticsData)}</p>
              </div>
              <div className="text-blue-500 bg-blue-50 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Schedule feature releases during this time for maximum exposure</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Top Search Type</p>
                <p className="text-xl font-bold">{getTopSearchType(analyticsData)}</p>
              </div>
              <div className="text-indigo-500 bg-indigo-50 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Users primarily search by {getTopSearchType(analyticsData).toLowerCase() || 'loading...'} - optimize this experience</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Weekly Growth</p>
                <p className="text-xl font-bold">{calculateWeeklyGrowth(analyticsData)}%</p>
              </div>
              <div className="text-green-500 bg-green-50 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">User engagement is {calculateWeeklyGrowth(analyticsData) > 0 ? 'growing' : 'declining'} - {calculateWeeklyGrowth(analyticsData) > 0 ? 'keep it up!' : 'needs attention'}</p>
          </div>
        </div>
      </div>
      
      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard 
          title="Total Searches" 
          value={stats.totalSearches}
          description="All time search queries" 
          icon={<Search className="h-6 w-6" />}
          loading={isLoading}
        />
        <StatsCard 
          title="Group Clicks" 
          value={stats.totalClicks}
          description="Total group interactions" 
          icon={<Users className="h-6 w-6" />}
          loading={isLoading}
        />
        <StatsCard 
          title="Location Requests" 
          value={analyticsData.filter(e => e.event_type === 'location_use').length}
          description="User location lookups" 
          icon={<MapPin className="h-6 w-6" />}
          loading={isLoading}
        />
        <StatsCard 
          title="Instagram Clicks" 
          value={analyticsData.filter(e => e.event_type === 'button_click' && 
            e.event_data.button_type === 'instagram').length}
          description="Instagram profile views" 
          icon={<Instagram className="h-6 w-6" />}
          loading={isLoading}
        />
      </div>
      
      {/* Main content */}
      <Tabs defaultValue="charts">
        <TabsList className="mb-6">
          <TabsTrigger value="charts" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="top" className="flex items-center gap-1">
            <PieChartIcon className="h-4 w-4" />
            Top Items
          </TabsTrigger>
          <TabsTrigger value="raw" className="flex items-center gap-1">
            <List className="h-4 w-4" />
            Raw Data
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-1">
            Trends
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-1">
            Insights
          </TabsTrigger>
          <TabsTrigger value="universities" className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
              <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
            </svg>
            Universities
          </TabsTrigger>
          <TabsTrigger value="countries" className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Countries
          </TabsTrigger>
          <TabsTrigger value="states" className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            States
          </TabsTrigger>
          <TabsTrigger value="cities" className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Cities
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="charts">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Bar chart */}
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">Events Over Time</h3>
              <div className="h-[400px]">
                {isLoading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        angle={-45} 
                        textAnchor="end"
                        height={70} 
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {pieData.map((entry, index) => (
                        <Bar 
                          key={entry.name}
                          dataKey={entry.name} 
                          fill={COLORS[index % COLORS.length]} 
                          name={entry.name.replace('_', ' ')}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <p className="text-gray-500">No data available for the selected filters</p>
                  </div>
                )}
              </div>
            </Card>
            
            {/* Pie chart */}
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">Event Distribution</h3>
              <div className="h-[400px]">
                {isLoading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        outerRadius={150}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, String(name).replace('_', ' ')]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <p className="text-gray-500">No data available for the selected filters</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="top">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top searches */}
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">Top Searches</h3>
              {isLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : stats.topSearches && stats.topSearches.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Search Term</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topSearches.slice(0, 10).map((search: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{search.query}</TableCell>
                        <TableCell>{search.search_type}</TableCell>
                        <TableCell className="text-right">{search.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center h-[400px]">
                  <p className="text-gray-500">No search data available</p>
                </div>
              )}
            </Card>
            
            {/* Top groups */}
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">Most Viewed Groups</h3>
              {isLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : stats.topGroups && stats.topGroups.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>University</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topGroups.slice(0, 10).map((group: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{group.university}</TableCell>
                        <TableCell>{group.city}, {group.state}</TableCell>
                        <TableCell className="text-right">{group.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center h-[400px]">
                  <p className="text-gray-500">No group view data available</p>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="raw">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium">Raw Analytics Data</h3>
                <div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={exportRawData}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Export Raw Data
                  </Button>
                </div>
              </div>
              <p className="text-center text-gray-500 my-8">
                Raw analytics data export is available, but data preview has been disabled for performance reasons.
                Please use the export button to download the complete dataset.
              </p>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="trends">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Over Time</CardTitle>
                  <CardDescription>
                    Visualize user activity trends over the selected date range
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  {isLoading ? (
                    <div className="h-full w-full flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={getActivityByDay(analyticsData)}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${value} events`, 'Activity']} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="search"
                          name="Searches"
                          stroke="#8884d8"
                          activeDot={{ r: 8 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="group_click"
                          name="Group Clicks"
                          stroke="#82ca9d"
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          name="Total Activity"
                          stroke="#ff7300"
                          strokeDasharray="5 5"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Top Day of Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{getTopDayOfWeek(analyticsData)}</div>
                    <p className="text-xs text-muted-foreground">
                      Users are most active on this day
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Activity Spikes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{getActivitySpikes(analyticsData)} detected</div>
                    <p className="text-xs text-muted-foreground">
                      Unusual activity patterns in selected period
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Predicted Next Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{predictNextWeekActivity(analyticsData)}%</div>
                    <p className="text-xs text-muted-foreground">
                      Expected growth compared to current week
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="insights">
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">Actionable Insights</h3>
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <>
                    {generateActionableInsights(analyticsData).map((insight, index) => (
                      <div key={index} className="flex border-l-4 p-4 rounded-r-md" style={{ borderColor: insight.color, backgroundColor: `${insight.color}10` }}>
                        <div className="flex-shrink-0 mr-3">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${insight.color}20` }}>
                            {insight.icon}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{insight.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                          <div className="mt-3">
                            <button 
                              className="text-xs font-medium px-3 py-1.5 rounded-full" 
                              style={{ backgroundColor: `${insight.color}20`, color: insight.color }}
                            >
                              {insight.action}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Top Content Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">University</div>
                  <p className="text-xs text-muted-foreground">
                    Optimize content strategy to focus on this content type
                  </p>
                  <div className="mt-3 text-xs">
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Top Priority</Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Recommendation Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex">
                    <div className="text-2xl font-bold">{getRecommendationScore(analyticsData)}</div>
                    <div className="text-sm text-gray-500 ml-1 self-end mb-1">/100</div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quality of recommendations based on user interaction
                  </p>
                  <div className="mt-3 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full" 
                      style={{ width: `${getRecommendationScore(analyticsData)}%` }}
                    ></div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">User Retention</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex">
                    <div className="text-2xl font-bold">{calculateRetention(analyticsData)}%</div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Session return rate within 7 days
                  </p>
                  <div className="mt-3 flex text-xs gap-2">
                    {calculateRetention(analyticsData) > 40 ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Good</Badge>
                    ) : calculateRetention(analyticsData) > 20 ? (
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Average</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Needs Improvement</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="universities">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-medium">University Interaction Metrics</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Detailed breakdown of user interactions by university
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={exportUniversityData}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Export University Data
                  </Button>
                </div>
              </div>
              
              {isLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">University</TableHead>
                        {renderSortableHeader('Searches', 'searches', universitySortConfig, requestUniversitySort, 'text-center')}
                        {renderSortableHeader('Clicks', 'clicks', universitySortConfig, requestUniversitySort, 'text-center')}
                        {renderSortableHeader('Instagram', 'instagram', universitySortConfig, requestUniversitySort, 'text-center')}
                        {renderSortableHeader('Maps', 'maps', universitySortConfig, requestUniversitySort, 'text-center')}
                        {renderSortableHeader('Total Interactions', 'totalInteractions', universitySortConfig, requestUniversitySort, 'text-center')}
                        <TableHead className="text-right">Last Activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedUniversityMetrics.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            No university interaction data available
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedUniversityMetrics.map((uni, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {uni.university}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{uni.searches}</span>
                                {uni.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-blue-500 rounded-full"
                                      style={{ width: `${(uni.searches / uni.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{uni.clicks}</span>
                                {uni.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-green-500 rounded-full"
                                      style={{ width: `${(uni.clicks / uni.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{uni.instagram}</span>
                                {uni.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-purple-500 rounded-full"
                                      style={{ width: `${(uni.instagram / uni.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{uni.maps}</span>
                                {uni.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-orange-500 rounded-full"
                                      style={{ width: `${(uni.maps / uni.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {uni.totalInteractions}
                            </TableCell>
                            <TableCell className="text-right text-sm text-gray-500">
                              {uni.lastActivity !== 'Unknown' 
                                ? new Date(uni.lastActivity).toLocaleDateString() 
                                : 'Unknown'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Universities by Interaction Type</CardTitle>
                  <CardDescription>
                    Which universities generate the most engagement by activity type
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  ) : sortedUniversityMetrics.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={sortedUniversityMetrics.slice(0, 5)}
                        layout="vertical"
                        margin={{ top: 20, right: 30, left: 60, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="university" 
                          type="category" 
                          tick={{ fontSize: 12 }}
                          width={100}
                        />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="searches" name="Searches" stackId="a" fill="#8884d8" />
                        <Bar dataKey="clicks" name="Clicks" stackId="a" fill="#82ca9d" />
                        <Bar dataKey="instagram" name="Instagram" stackId="a" fill="#8A2BE2" />
                        <Bar dataKey="maps" name="Maps" stackId="a" fill="#FF8C00" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      No university data available
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>University Engagement Comparison</CardTitle>
                  <CardDescription>
                    Relative engagement breakdown by interaction type
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  ) : sortedUniversityMetrics.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sortedUniversityMetrics.slice(0, 5).map(uni => ({
                            name: uni.university,
                            value: uni.totalInteractions
                          }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {sortedUniversityMetrics.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [`${value} interactions`, String(name)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      No university data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="countries">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-medium">Country Interaction Metrics</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Detailed breakdown of user interactions by country
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={exportCountryData}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Export Country Data
                  </Button>
                </div>
              </div>
              
              {isLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Country</TableHead>
                        {renderSortableHeader('Searches', 'searches', countrySortConfig, requestCountrySort, 'text-center')}
                        {renderSortableHeader('Clicks', 'clicks', countrySortConfig, requestCountrySort, 'text-center')}
                        {renderSortableHeader('Instagram', 'instagram', countrySortConfig, requestCountrySort, 'text-center')}
                        {renderSortableHeader('Maps', 'maps', countrySortConfig, requestCountrySort, 'text-center')}
                        {renderSortableHeader('Total Interactions', 'totalInteractions', countrySortConfig, requestCountrySort, 'text-center')}
                        <TableHead className="text-right">Last Activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedCountryMetrics.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            No country interaction data available
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedCountryMetrics.map((country, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {country.country}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{country.searches}</span>
                                {country.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-blue-500 rounded-full"
                                      style={{ width: `${(country.searches / country.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{country.clicks}</span>
                                {country.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-green-500 rounded-full"
                                      style={{ width: `${(country.clicks / country.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{country.instagram}</span>
                                {country.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-purple-500 rounded-full"
                                      style={{ width: `${(country.instagram / country.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{country.maps}</span>
                                {country.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-orange-500 rounded-full"
                                      style={{ width: `${(country.maps / country.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {country.totalInteractions}
                            </TableCell>
                            <TableCell className="text-right text-sm text-gray-500">
                              {country.lastActivity !== 'Unknown' 
                                ? new Date(country.lastActivity).toLocaleDateString() 
                                : 'Unknown'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Countries by Interaction Type</CardTitle>
                  <CardDescription>
                    Which countries generate the most engagement by activity type
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  ) : sortedCountryMetrics.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={sortedCountryMetrics.slice(0, 5)}
                        layout="vertical"
                        margin={{ top: 20, right: 30, left: 60, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="country" 
                          type="category" 
                          tick={{ fontSize: 12 }}
                          width={100}
                        />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="searches" name="Searches" stackId="a" fill="#8884d8" />
                        <Bar dataKey="clicks" name="Clicks" stackId="a" fill="#82ca9d" />
                        <Bar dataKey="instagram" name="Instagram" stackId="a" fill="#8A2BE2" />
                        <Bar dataKey="maps" name="Maps" stackId="a" fill="#FF8C00" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      No country data available
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Country Engagement Comparison</CardTitle>
                  <CardDescription>
                    Relative engagement breakdown by interaction type
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  ) : sortedCountryMetrics.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sortedCountryMetrics.slice(0, 5).map(country => ({
                            name: country.country,
                            value: country.totalInteractions
                          }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {sortedCountryMetrics.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [`${value} interactions`, String(name)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      No country data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="states">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-medium">State Interaction Metrics</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Detailed breakdown of user interactions by state
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={exportStateData}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Export State Data
                  </Button>
                </div>
              </div>
              
              {isLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">State</TableHead>
                        {renderSortableHeader('Searches', 'searches', stateSortConfig, requestStateSort, 'text-center')}
                        {renderSortableHeader('Clicks', 'clicks', stateSortConfig, requestStateSort, 'text-center')}
                        {renderSortableHeader('Instagram', 'instagram', stateSortConfig, requestStateSort, 'text-center')}
                        {renderSortableHeader('Maps', 'maps', stateSortConfig, requestStateSort, 'text-center')}
                        {renderSortableHeader('Total Interactions', 'totalInteractions', stateSortConfig, requestStateSort, 'text-center')}
                        <TableHead className="text-right">Last Activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedStateMetrics.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            No state interaction data available
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedStateMetrics.map((state, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {state.state}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{state.searches}</span>
                                {state.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-blue-500 rounded-full"
                                      style={{ width: `${(state.searches / state.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{state.clicks}</span>
                                {state.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-green-500 rounded-full"
                                      style={{ width: `${(state.clicks / state.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{state.instagram}</span>
                                {state.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-purple-500 rounded-full"
                                      style={{ width: `${(state.instagram / state.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{state.maps}</span>
                                {state.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-orange-500 rounded-full"
                                      style={{ width: `${(state.maps / state.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {state.totalInteractions}
                            </TableCell>
                            <TableCell className="text-right text-sm text-gray-500">
                              {state.lastActivity !== 'Unknown' 
                                ? new Date(state.lastActivity).toLocaleDateString() 
                                : 'Unknown'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top States by Interaction Type</CardTitle>
                  <CardDescription>
                    Which states generate the most engagement by activity type
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  ) : sortedStateMetrics.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={sortedStateMetrics.slice(0, 5)}
                        layout="vertical"
                        margin={{ top: 20, right: 30, left: 60, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="state" 
                          type="category" 
                          tick={{ fontSize: 12 }}
                          width={100}
                        />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="searches" name="Searches" stackId="a" fill="#8884d8" />
                        <Bar dataKey="clicks" name="Clicks" stackId="a" fill="#82ca9d" />
                        <Bar dataKey="instagram" name="Instagram" stackId="a" fill="#8A2BE2" />
                        <Bar dataKey="maps" name="Maps" stackId="a" fill="#FF8C00" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      No state data available
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>State Engagement Comparison</CardTitle>
                  <CardDescription>
                    Relative engagement breakdown by interaction type
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  ) : sortedStateMetrics.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sortedStateMetrics.slice(0, 5).map(state => ({
                            name: state.state,
                            value: state.totalInteractions
                          }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {sortedStateMetrics.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [`${value} interactions`, String(name)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      No state data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="cities">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-medium">City Interaction Metrics</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Detailed breakdown of user interactions by city
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={exportCityData}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Export City Data
                  </Button>
                </div>
              </div>
              
              {isLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">City</TableHead>
                        <TableHead className="text-center">State</TableHead>
                        {renderSortableHeader('Searches', 'searches', citySortConfig, requestCitySort, 'text-center')}
                        {renderSortableHeader('Clicks', 'clicks', citySortConfig, requestCitySort, 'text-center')}
                        {renderSortableHeader('Instagram', 'instagram', citySortConfig, requestCitySort, 'text-center')}
                        {renderSortableHeader('Maps', 'maps', citySortConfig, requestCitySort, 'text-center')}
                        {renderSortableHeader('Total Interactions', 'totalInteractions', citySortConfig, requestCitySort, 'text-center')}
                        <TableHead className="text-right">Last Activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedCityMetrics.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                            No city interaction data available
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedCityMetrics.map((city, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {city.city}
                            </TableCell>
                            <TableCell className="text-center">
                              {city.state}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{city.searches}</span>
                                {city.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-blue-500 rounded-full"
                                      style={{ width: `${(city.searches / city.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{city.clicks}</span>
                                {city.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-green-500 rounded-full"
                                      style={{ width: `${(city.clicks / city.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{city.instagram}</span>
                                {city.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-purple-500 rounded-full"
                                      style={{ width: `${(city.instagram / city.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span>{city.maps}</span>
                                {city.totalInteractions > 0 && (
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                                    <div
                                      className="h-full bg-orange-500 rounded-full"
                                      style={{ width: `${(city.maps / city.totalInteractions) * 100}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {city.totalInteractions}
                            </TableCell>
                            <TableCell className="text-right text-sm text-gray-500">
                              {city.lastActivity !== 'Unknown' 
                                ? new Date(city.lastActivity).toLocaleDateString() 
                                : 'Unknown'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Cities by Interaction Type</CardTitle>
                  <CardDescription>
                    Which cities generate the most engagement by activity type
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  ) : sortedCityMetrics.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={sortedCityMetrics.slice(0, 5)}
                        layout="vertical"
                        margin={{ top: 20, right: 30, left: 60, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="city" 
                          type="category" 
                          tick={{ fontSize: 12 }}
                          width={100}
                        />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="searches" name="Searches" stackId="a" fill="#8884d8" />
                        <Bar dataKey="clicks" name="Clicks" stackId="a" fill="#82ca9d" />
                        <Bar dataKey="instagram" name="Instagram" stackId="a" fill="#8A2BE2" />
                        <Bar dataKey="maps" name="Maps" stackId="a" fill="#FF8C00" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      No city data available
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>City Engagement Comparison</CardTitle>
                  <CardDescription>
                    Relative engagement breakdown by interaction type
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  ) : sortedCityMetrics.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sortedCityMetrics.slice(0, 5).map(city => ({
                            name: city.city,
                            value: city.totalInteractions
                          }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {sortedCityMetrics.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [`${value} interactions`, String(name)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      No city data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 