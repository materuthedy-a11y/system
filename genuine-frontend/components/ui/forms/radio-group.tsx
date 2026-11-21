'use client';

import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function RadioGroup({
  name,
  options,
  value,
  onChange,
  disabled,
  invalid,
  className,
  ...aria
}: RadioGroupProps) {
  return (
    <div role="radiogroup" className={twMerge('ui-radio-group', className)} {...aria}>
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={clsx('ui-radio-label', (disabled || option.disabled) && 'ui-radio-label--disabled')}
          >
            <input
              type="radio"
              id={id}
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={disabled || option.disabled}
              data-invalid={invalid || undefined}
              onChange={() => onChange?.(option.value)}
              className="ui-radio"
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
