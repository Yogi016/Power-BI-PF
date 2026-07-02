import React from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  leadingIcon?: React.ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#0066cc] text-white hover:bg-[#0055b3] disabled:bg-slate-200 disabled:text-slate-400',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  tertiary: 'bg-transparent text-[#0066cc] hover:underline disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', leadingIcon, className = '', children, ...rest
}) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    {...rest}
  >
    {leadingIcon}
    {children}
  </button>
);
