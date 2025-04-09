import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a text string by removing diacritics and converting to lowercase
 * for search comparison purposes.
 * 
 * @param text The text to normalize
 * @returns Normalized text string, or empty string if input is null/undefined
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  
  try {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove all non-alphanumeric characters except spaces
      .replace(/\s+/g, ' ')    // Normalize multiple spaces to single space
      .trim();
  } catch (error) {
    console.error('Error normalizing text:', error);
    return text.toLowerCase().trim();
  }
}
