# Vercel Analytics Integration for Find My Pockets

This document outlines how to use Vercel Analytics to track user interactions in the Find My Pockets application.

## Implementation Details

We have integrated Vercel Analytics to track three main types of user interactions:

1. **Search Queries**: Tracks what users are searching for, including the search term, type of search (university, city, state, country, or all), and the number of results found.

2. **Group Clicks**: Tracks which groups users click on, either from the search results list or directly on the map.

3. **Suggestion Selections**: Tracks which suggestions users select from the dropdown menu.

## Viewing Analytics Data

To view the analytics data:

1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the Find My Pockets project
3. Click on the "Analytics" tab in the left sidebar
4. In the Analytics view, you can see:
   - Page views and unique visitors
   - Web Vitals metrics
   - Custom events (search, group_click, suggestion_select)

## Custom Events

### Search Queries

The `search` event includes:
- `query`: The search term entered by the user
- `searchType`: The type of search (university, city, state, country, or all)
- `resultCount`: The number of results returned

This data can help understand:
- What locations/universities users are most interested in
- Which search queries yield no results (may indicate missing data)
- Most popular search terms

### Group Clicks

The `group_click` event includes:
- `groupId`: The unique ID of the clicked group
- `groupUniversity`: The university of the group
- `city`: The city of the group
- `state`: The state of the group
- `country`: The country of the group
- `source`: Whether the click came from the map or search results list

This data can help understand:
- Which groups are most popular
- Whether users prefer interacting with the map or the list view
- Geographic distribution of user interest

### Suggestion Selections

The `suggestion_select` event includes:
- `suggestion`: The text of the selected suggestion
- `type`: The type of suggestion (university, city, state, country)

This data can help understand:
- Which autocomplete suggestions are most helpful to users
- What type of suggestions users prefer (university, city, etc.)

## Creating Custom Reports

You can create custom reports in the Vercel Analytics dashboard:

1. Go to the Analytics section
2. Click "Create Custom Report"
3. Select the event type to analyze (search, group_click, suggestion_select)
4. Choose dimensions and metrics
5. Save the report for future reference

## Integration with Other Tools

Vercel Analytics data can be exported for integration with other analytics tools:

1. From the Analytics dashboard, click "Export Data"
2. Choose the date range and event types
3. Export in CSV format for further analysis in tools like Excel or Google Sheets

## Privacy Considerations

The analytics implementation respects user privacy:
- No personally identifiable information (PII) is collected
- Data is anonymized and aggregated
- Complies with GDPR and other privacy regulations

## Technical Implementation

The analytics tracking is implemented in:

- `src/lib/analytics.ts`: Custom utility functions for tracking events
- `src/app/layout.tsx`: Base Analytics component integration
- `src/app/page.tsx`: Integration with search and interaction functions

---

For any questions about the analytics implementation, please contact the development team. 