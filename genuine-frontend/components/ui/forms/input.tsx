'use client';

import * as React from 'react';
import { fieldClasses, type FieldControlProps, type FieldSize, type FieldVariant } from './field';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    FieldControlProps {
  variant?: FieldVariant;
  size?: FieldSize;
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { variant = 'default', size = 'md', invalid, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      data-slot="input"
      data-variant={variant}
      className={fieldClasses(variant, size, invalid, className)}
      {...props}
    />
  );
});
