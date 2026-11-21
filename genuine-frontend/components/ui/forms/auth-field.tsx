'use client';

import * as React from 'react';
import { FormField, type FormFieldProps } from './field';
import { Input, type InputProps } from './input';
import { Textarea, type TextareaProps } from './textarea';
import { Select, type SelectProps } from './select';

/**
 * Auth-scoped field: always renders the dark-glass control treatment
 * (white text on translucent dark surface) regardless of page theme.
 * Use ONLY inside intentionally dark surfaces (auth pages).
 * For light cards (e.g. security settings), use FormField + default variant.
 */
export interface AuthFieldProps extends Omit<FormFieldProps, 'children'> {
  control?: 'input' | 'textarea' | 'select';
  inputProps?: InputProps & TextareaProps & SelectProps;
}

export function AuthField({ control = 'input', inputProps, ...field }: AuthFieldProps) {
  return (
    <FormField {...field}>
      {(controlProps) => {
        const merged = { ...controlProps, ...inputProps };
        if (control === 'textarea') {
          return <Textarea variant="auth" {...(merged as TextareaProps)} />;
        }
        if (control === 'select') {
          return <Select variant="auth" {...(merged as SelectProps)} />;
        }
        return <Input variant="auth" {...(merged as InputProps)} />;
      }}
    </FormField>
  );
}
