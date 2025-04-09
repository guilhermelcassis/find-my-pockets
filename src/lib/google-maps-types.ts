// Type definitions for Google Maps integration

// Convenience type aliases for Google Maps objects
export type GoogleMap = google.maps.Map;
export type GoogleMarker = google.maps.Marker;
export type GoogleAutocomplete = google.maps.places.Autocomplete;
export type GoogleLatLng = google.maps.LatLng;

// Helper function to safely access window properties
export function getWindowProperty<T>(propertyName: string, defaultValue: T): T {
  if (typeof window !== 'undefined') {
    return (window as any)[propertyName] as T || defaultValue;
  }
  return defaultValue;
}

// Helper to safely set window properties
export function setWindowProperty<T>(propertyName: string, value: T): void {
  if (typeof window !== 'undefined') {
    (window as any)[propertyName] = value;
  }
} 