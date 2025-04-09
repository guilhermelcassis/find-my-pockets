import { useState, useEffect } from 'react';

type Breakpoints = {
  base?: boolean | string | number;
  sm?: boolean | string | number;
  md?: boolean | string | number;
  lg?: boolean | string | number;
  xl?: boolean | string | number;
  '2xl'?: boolean | string | number;
};

export function useBreakpointValue<T>(breakpointMap: Breakpoints): T {
  const breakpoints = {
    base: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  };

  const getBreakpointValue = (width: number): T => {
    // Start with the base value
    let currentValue = breakpointMap.base as T;

    // Check each breakpoint in ascending order
    if (width >= breakpoints.sm && breakpointMap.sm !== undefined) {
      currentValue = breakpointMap.sm as T;
    }
    if (width >= breakpoints.md && breakpointMap.md !== undefined) {
      currentValue = breakpointMap.md as T;
    }
    if (width >= breakpoints.lg && breakpointMap.lg !== undefined) {
      currentValue = breakpointMap.lg as T;
    }
    if (width >= breakpoints.xl && breakpointMap.xl !== undefined) {
      currentValue = breakpointMap.xl as T;
    }
    if (width >= breakpoints['2xl'] && breakpointMap['2xl'] !== undefined) {
      currentValue = breakpointMap['2xl'] as T;
    }

    return currentValue;
  };

  const [value, setValue] = useState<T>(() => {
    // Default to the base value during SSR
    if (typeof window === 'undefined') {
      return breakpointMap.base as T;
    }
    return getBreakpointValue(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setValue(getBreakpointValue(window.innerWidth));
    };

    // Set initial value
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return value;
} 