/**
 * Utility functions for the application
 */

/**
 * Normalizes text by removing accents/diacritics and converting to lowercase
 * This helps with search matching across accented characters
 * 
 * @param text The text to normalize
 * @returns Normalized text (lowercase, no accents)
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  // Convert to lowercase first
  const lowerCase = text.toLowerCase();
  
  // Remove accents/diacritics
  // This uses Unicode normalization to decompose accented characters and then removes the accent marks
  return lowerCase.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Creates a PostgreSQL-compatible pattern for accent-insensitive search
 * 
 * @param searchTerm The search term to create a pattern for
 * @returns A pattern for case and accent insensitive search
 */
export function createSearchPattern(searchTerm: string): string {
  // First normalize the search term
  const normalized = normalizeText(searchTerm);
  
  // Create a pattern with % wildcards for partial matching
  return `%${normalized}%`;
} 