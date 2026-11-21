'use client';

import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fieldClasses, type FieldControlProps, type FieldSize, type FieldVariant } from './field';

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    FieldControlProps {
  variant?: FieldVariant;
  size?: FieldSize;
  invalid?: boolean;
  options?: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { variant = 'default', size = 'md', invalid, options, placeholder, className, children, ...props },
  ref,
) {
  // Auto-width selects need the wrapper to hug the control, otherwise the
  // absolutely-positioned chevron anchors to the full-width wrapper edge.
  const fitWidth = typeof className === 'string' && /(?:^|\s)!?w-auto(?:\s|$)/.test(className);
  return (
    <span className={clsx('ui-select-wrap', `ui-field--${size}`, fitWidth && 'ui-select-wrap--fit')}>
      <select
        ref={ref}
        data-slot="select"
        data-variant={variant}
        className={twMerge(fieldClasses(variant, size, invalid), 'ui-select', className)}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))
          : children}
      </select>
      <svg className="ui-select-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
});
