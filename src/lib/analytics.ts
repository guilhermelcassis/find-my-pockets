import { track } from '@vercel/analytics';
import { Group } from './interfaces';

/**
 * Analytics utility for tracking user interactions in the app
 */
export const Analytics = {
  /**
   * Track a search query
   * @param query The search term entered by the user
   * @param type The type of search (university, city, state, country)
   * @param resultCount Number of results found
   */
  trackSearch: (
    query: string, 
    type: 'university' | 'city' | 'state' | 'country' | null,
    resultCount: number
  ) => {
    track('search', {
      query,
      searchType: type || 'all',
      resultCount,
    });
  },

  /**
   * Track when a group is clicked in search results or on the map
   * @param group The group that was clicked
   * @param source Whether the interaction came from the map or search results list
   */
  trackGroupClick: (
    group: Group, 
    source: 'map' | 'search_results'
  ) => {
    track('group_click', {
      groupId: group.id,
      groupUniversity: group.university,
      city: group.city,
      state: group.state,
      country: group.country,
      source,
    });
  },

  /**
   * Track when a suggestion is selected from the dropdown
   * @param suggestionText The text of the selected suggestion
   * @param suggestionType The type of suggestion (university, city, state, country)
   */
  trackSuggestionSelect: (
    suggestionText: string,
    suggestionType: 'university' | 'city' | 'state' | 'country'
  ) => {
    track('suggestion_select', {
      suggestion: suggestionText,
      type: suggestionType,
    });
  }
};

export default Analytics; 