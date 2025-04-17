import { supabase } from './supabase';
import { Group } from './interfaces';

export interface AnalyticsEvent {
  id?: string;
  event_type: 'search' | 'group_click' | 'suggestion_select' | 'button_click' | 'location_use';
  event_data: Record<string, any>;
  created_at?: string;
  session_id: string;
  user_id?: string;
  user_agent?: string;
  referrer?: string;
  url?: string;
  country?: string;
  city?: string;
}

/**
 * Enhanced Analytics for detailed user tracking
 */
export const AnalyticsService = {
  /**
   * Generate a unique session ID if not already set
   */
  getSessionId: (): string => {
    // Try to get existing session ID from localStorage
    let sessionId = typeof window !== 'undefined' ? localStorage.getItem('fmp_session_id') : null;
    
    // If no session ID exists, create one
    if (!sessionId) {
      sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      if (typeof window !== 'undefined') {
        localStorage.setItem('fmp_session_id', sessionId);
      }
    }
    
    return sessionId;
  },

  /**
   * Get basic context information for analytics events
   */
  getEventContext: (): Pick<AnalyticsEvent, 'session_id' | 'user_agent' | 'referrer' | 'url'> => {
    // Initialize with session ID which works server-side too
    const context: Pick<AnalyticsEvent, 'session_id' | 'user_agent' | 'referrer' | 'url'> = {
      session_id: AnalyticsService.getSessionId(),
    };
    
    // Add browser-specific information
    if (typeof window !== 'undefined') {
      context.user_agent = navigator.userAgent;
      context.referrer = document.referrer;
      context.url = window.location.href;
    }
    
    return context;
  },

  /**
   * Track any event with the analytics service
   */
  trackEvent: async (eventType: AnalyticsEvent['event_type'], eventData: Record<string, any>) => {
    try {
      const event: AnalyticsEvent = {
        event_type: eventType,
        event_data: eventData,
        ...AnalyticsService.getEventContext(),
      };
      
      // Send to Supabase
      const { error } = await supabase
        .from('analytics_events')
        .insert(event);

      if (error) {
        console.error('Failed to track event:', error);
      }
      
      // Also send to Vercel Analytics if available
      if (typeof window !== 'undefined' && 'vercelAnalytics' in window) {
        try {
          // @ts-ignore - Vercel Analytics might be available
          window.vercelAnalytics.track(eventType, eventData);
        } catch (e) {
          // Silently fail if Vercel Analytics is not available
        }
      }
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  },

  /**
   * Track search queries
   */
  trackSearch: async (
    query: string, 
    searchType: 'university' | 'city' | 'state' | 'country' | null,
    resultCount: number
  ) => {
    await AnalyticsService.trackEvent('search', {
      query,
      search_type: searchType || 'all',
      result_count: resultCount,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track group clicks (map markers or list items)
   */
  trackGroupClick: async (
    group: Group, 
    source: 'map' | 'search_results'
  ) => {
    await AnalyticsService.trackEvent('group_click', {
      group_id: group.id,
      university: group.university,
      city: group.city,
      state: group.state,
      country: group.country,
      source,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track suggestion selections from dropdown
   */
  trackSuggestionSelect: async (
    suggestionText: string,
    suggestionType: 'university' | 'city' | 'state' | 'country'
  ) => {
    await AnalyticsService.trackEvent('suggestion_select', {
      suggestion: suggestionText,
      type: suggestionType,
      timestamp: new Date().toISOString(),
    });
  },
  
  /**
   * Track button clicks (Instagram, Maps, etc.)
   */
  trackButtonClick: async (
    buttonType: 'instagram' | 'maps' | 'my_location' | 'show_all_groups' | 'install_app',
    metadata: Record<string, any> = {}
  ) => {
    await AnalyticsService.trackEvent('button_click', {
      button_type: buttonType,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track when users use location features
   */
  trackLocationUse: async (
    actionType: 'request' | 'receive' | 'error',
    metadata: Record<string, any> = {}
  ) => {
    await AnalyticsService.trackEvent('location_use', {
      action_type: actionType,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  },
  
  /**
   * Get analytics data (for admin dashboard)
   */
  getAnalyticsData: async (
    eventType?: AnalyticsEvent['event_type'],
    startDate?: Date,
    endDate?: Date,
    limit: number = 1000
  ) => {
    let query = supabase
      .from('analytics_events')
      .select('*');
      
    // Filter by event type if provided
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    
    // Filter by date range if provided
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }
    
    // Order by created_at and limit results
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error('Failed to fetch analytics data:', error);
      throw error;
    }
    
    return data;
  },
  
  /**
   * Get aggregated analytics statistics
   */
  getAnalyticsStats: async () => {
    // Get total searches
    const { count: searchCount, error: searchError } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'search');
      
    // Get total group clicks
    const { count: clickCount, error: clickError } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'group_click');
      
    // Get most searched queries (top 10)
    const { data: topSearches, error: topSearchesError } = await supabase.rpc(
      'get_top_searches',
      { limit_count: 10 }
    );
    
    // Get most clicked groups (top 10)
    const { data: topGroups, error: topGroupsError } = await supabase.rpc(
      'get_top_groups',
      { limit_count: 10 }
    );
    
    // Handle errors
    if (searchError || clickError || topSearchesError || topGroupsError) {
      console.error('Error fetching analytics stats:', 
        searchError || clickError || topSearchesError || topGroupsError);
    }
    
    return {
      totalSearches: searchCount || 0,
      totalClicks: clickCount || 0,
      topSearches: topSearches || [],
      topGroups: topGroups || [],
    };
  }
};

export default AnalyticsService; 