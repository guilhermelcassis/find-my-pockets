import { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";

interface Action {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary';
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: Action[];
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="border-b border-border py-8 px-8 bg-white shadow-sm rounded-lg mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 border-l-4 border-primary pl-3 py-1">
            {title}
          </h1>
          {description && (
            <p className="text-gray-600 text-sm mt-2.5 max-w-2xl leading-relaxed pl-3">
              {description}
            </p>
          )}
        </div>
        {actions && actions.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {actions.map((action, index) => (
              action.href ? (
                <Button
                  key={index}
                  variant={action.variant || 'default'} 
                  size="sm"
                  asChild
                  className="shadow-sm font-medium"
                >
                  <Link href={action.href}>
                    {action.label}
                  </Link>
                </Button>
              ) : (
                <Button 
                  key={index}
                  variant={action.variant || 'default'}
                  size="sm"
                  onClick={action.onClick}
                  className="shadow-sm font-medium"
                >
                  {action.label}
                </Button>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminNavigationButtons() {
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2 shadow-sm border-border"
        asChild
      >
        <Link href="/admin/groups">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          Manage Groups
        </Link>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
        asChild
      >
        <Link href="/admin">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Admin
        </Link>
      </Button>
    </>
  );
} 