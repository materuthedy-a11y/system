'use client';

import * as React from 'react';
import { fieldClasses, type FieldControlProps, type FieldSize, type FieldVariant } from './field';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    FieldControlProps {
  variant?: FieldVariant;
  size?: FieldSize;
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { variant = 'default', size = 'md', invalid, className, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      data-variant={variant}
      rows={rows}
      className={fieldClasses(variant, size, invalid, className)}
      {...props}
    />
  );
});
