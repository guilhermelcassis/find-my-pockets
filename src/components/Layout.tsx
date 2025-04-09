import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-white">
      {/* Top accent line with university-themed gradient */}
      <div className="h-2 bg-gradient-to-r from-[hsl(350,65%,30%)] via-[hsl(350,65%,41%)] to-[hsl(350,65%,30%)]"></div>
      
      <div className="container mx-auto max-w-7xl px-6 py-10">
        {children}
      </div>
      
      {/* Footer area with subtle separation */}
      <div className="py-10 mt-14 border-t border-border bg-gray-50">
        <div className="container mx-auto max-w-7xl px-6">
          <p className="text-xs text-gray-500 text-center">
            © {new Date().getFullYear()} Find My Pockets. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
} 