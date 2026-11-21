'use client';

import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type FieldVariant = 'default' | 'auth' | 'ghost';
export type FieldSize = 'sm' | 'md' | 'lg';

export interface FieldControlProps {
  id?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  'aria-describedby'?: string;
  disabled?: boolean;
}

export function fieldClasses(
  variant: FieldVariant = 'default',
  size: FieldSize = 'md',
  invalid = false,
  className?: string,
) {
  return twMerge(
    'ui-field',
    `ui-field--${variant}`,
    `ui-field--${size}`,
    invalid && 'ui-field--invalid',
    className,
  );
}

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  children: (control: FieldControlProps) => React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  helperText,
  error,
  required,
  disabled,
  className,
  labelClassName,
  children,
}: FormFieldProps) {
  const helperId = helperText ? `${htmlFor}-help` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={clsx('ui-form-field', className)}>
      <label htmlFor={htmlFor} className={clsx('ui-field-label', labelClassName)}>
        {label}
        {required ? <span className="ui-field-required" aria-hidden="true">*</span> : null}
      </label>
      {children({
        id: htmlFor,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        disabled,
      })}
      {helperText && !error ? (
        <p id={helperId} className="ui-field-helper">{helperText}</p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="ui-field-error">{error}</p>
      ) : null}
    </div>
  );
}
