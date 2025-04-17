'use client';

import React, { useState, useEffect } from 'react';
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
  Cell
} from 'recharts';
import AnalyticsService, { AnalyticsEvent } from '@/lib/supabase-analytics';
import { Card } from '@/components/ui/card';
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
  RefreshCw
} from 'lucide-react';

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
  const [dateRange, setDateRange] = useState<string>('7d'); // 7d, 30d, 90d, all
  const [eventType, setEventType] = useState<string>('all'); // all, search, group_click, etc.
  const [chartData, setChartData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  
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
      
      if (dateRange === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (dateRange === '90d') {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
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
  
  // Process data for visualizations
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
  
  // Export data as CSV
  const exportData = () => {
    if (!analyticsData.length) return;
    
    // Convert data to CSV
    const headers = ['Event Type', 'Event Data', 'Created At', 'Session ID'];
    const csvContent = [
      headers.join(','),
      ...analyticsData.map(event => [
        event.event_type,
        JSON.stringify(event.event_data).replace(/,/g, ';'),
        event.created_at,
        event.session_id
      ].join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `analytics-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              onValueChange={value => setDateRange(value)}
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
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Raw Analytics Data</h3>
            {isLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : analyticsData.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>Recent analytics events{eventType !== 'all' ? ` (filtered to ${eventType} events)` : ''}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Session</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyticsData.slice(0, 100).map((event, index) => (
                      <TableRow key={index}>
                        <TableCell>{event.event_type}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {JSON.stringify(event.event_data)}
                        </TableCell>
                        <TableCell>
                          {new Date(event.created_at || '').toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[120px]">
                          {event.session_id}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[400px]">
                <p className="text-gray-500">No data available for the selected filters</p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 