import React from 'react';
import Script from 'next/script';

export const metadata = {
  title: 'Dashboard - Find My Pockets',
  description: 'Estatísticas e métricas globais sobre nosso alcance',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="google-maps-guard"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            // Create the Google Maps initialization guard
            window.__GOOGLE_MAPS_INIT_GUARD = window.__GOOGLE_MAPS_INIT_GUARD || {
              initialized: false,
              loading: false,
              callbacks: []
            };
            
            // Create a guarded initialization function that prevents multiple initializations
            window.initializeGoogleMapsGuarded = function() {
              if (!window.__GOOGLE_MAPS_INIT_GUARD.loading && !window.__GOOGLE_MAPS_INIT_GUARD.initialized) {
                window.__GOOGLE_MAPS_INIT_GUARD.loading = true;
                console.log('Google Maps initialization started');
                
                // Mark as initialized immediately to prevent duplicate loading attempts
                window.__GOOGLE_MAPS_INIT_GUARD.initialized = true;
                window.__GOOGLE_MAPS_INIT_GUARD.loading = false;
                
                // Execute any queued callbacks
                window.__GOOGLE_MAPS_INIT_GUARD.callbacks.forEach(callback => {
                  try {
                    callback();
                  } catch (e) {
                    console.error('Error in Google Maps callback:', e);
                  }
                });
                
                console.log('Google Maps initialization completed');
              } else if (window.__GOOGLE_MAPS_INIT_GUARD.initialized) {
                console.log('Google Maps already initialized, skipping');
              }
            };
          `,
        }}
      />
      {children}
    </>
  );
} 