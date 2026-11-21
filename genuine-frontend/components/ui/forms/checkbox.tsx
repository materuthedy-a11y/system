'use client';

import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FieldControlProps } from './field';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>,
    FieldControlProps {
  label?: React.ReactNode;
  invalid?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, invalid, ...props },
  ref,
) {
  const input = (
    <input
      ref={ref}
      type="checkbox"
      data-slot="checkbox"
      data-invalid={invalid || undefined}
      className={twMerge('ui-checkbox', className)}
      {...props}
    />
  );
  if (label === undefined) return input;
  return (
    <label className={clsx('ui-checkbox-label', props.disabled && 'ui-checkbox-label--disabled')}>
      {input}
      <span>{label}</span>
    </label>
  );
});
