import React from 'react';

interface CardProps {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, action, className = '', children }) => (
  <div className={`bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between mb-4">
        {title && <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>}
        {action}
      </div>
    )}
    {children}
  </div>
);
