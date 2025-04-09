import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

interface StatusMessageProps {
  type: 'success' | 'error' | 'info';
  text: string;
  onClose: () => void;
}

export default function StatusMessage({ type, text, onClose }: StatusMessageProps) {
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          variant: "default" as const,
          borderColor: "border-green-500",
          bgColor: "bg-green-50",
          textColor: "text-green-800",
          icon: <CheckCircle className="h-5 w-5 text-green-500" />
        };
      case 'error':
        return {
          variant: "destructive" as const,
          borderColor: "border-red-500",
          bgColor: "bg-red-50",
          textColor: "text-red-800",
          icon: <AlertCircle className="h-5 w-5 text-red-500" />
        };
      case 'info':
        return {
          variant: "default" as const,
          borderColor: "border-blue-500",
          bgColor: "bg-blue-50",
          textColor: "text-blue-800",
          icon: <Info className="h-5 w-5 text-blue-500" />
        };
      default:
        return {
          variant: "default" as const,
          borderColor: "border-blue-500",
          bgColor: "bg-blue-50",
          textColor: "text-blue-800",
          icon: <Info className="h-5 w-5 text-blue-500" />
        };
    }
  };

  const { borderColor, bgColor, textColor, icon, variant } = getTypeStyles();

  return (
    <Alert 
      variant={variant}
      className={`border-l-2 ${borderColor} ${bgColor} mx-6 my-6 p-4 rounded-md relative shadow-sm border border-r-gray-100 border-t-gray-100 border-b-gray-100`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center flex-grow mr-3">
          <div className="flex-shrink-0">
            {icon}
          </div>
          <AlertDescription className={`ml-3 text-sm ${textColor} truncate`}>
            {text}
          </AlertDescription>
        </div>
        <button
          className="text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded-full hover:bg-gray-100 flex-shrink-0"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </Alert>
  );
} 