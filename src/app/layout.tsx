import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../lib/auth-context";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dunamis Pockets",
  description: "Encontre Dunamis Pockets pelo mundo",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" }
    ],
    apple: { url: "/apple-icon.png", type: "image/png" },
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <Script id="google-maps-guard" strategy="beforeInteractive">
          {`
            // Prevent multiple initializations of Google Maps
            window.__GOOGLE_MAPS_INIT_GUARD = window.__GOOGLE_MAPS_INIT_GUARD || {
              initialized: false,
              loading: false,
              callbacks: []
            };

            // Safe wrapper for the Google Maps callback
            if (!window.initializeGoogleMapsGuarded) {
              window.initializeGoogleMapsGuarded = function() {
                if (window.__GOOGLE_MAPS_INIT_GUARD.initialized) {
                  console.log('Google Maps already initialized, skipping callback');
                  return;
                }
                window.__GOOGLE_MAPS_INIT_GUARD.initialized = true;
                window.__GOOGLE_MAPS_INIT_GUARD.loading = false;
                
                // Call the actual initialization function if it exists
                if (typeof window.initializeGoogleMaps === 'function') {
                  window.initializeGoogleMaps();
                }
                
                // Process any queued callbacks
                window.__GOOGLE_MAPS_INIT_GUARD.callbacks.forEach(function(callback) {
                  try {
                    callback();
                  } catch (e) {
                    console.error('Error in Google Maps callback:', e);
                  }
                });
                window.__GOOGLE_MAPS_INIT_GUARD.callbacks = [];
              };
            }
          `}
        </Script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
