'use client';

import { useEffect, useRef, useState } from 'react';

type AnimatedNumberProps = {
  value: number;
  format: (value: number) => string;
  duration?: number;
  className?: string;
};

/** Counts KPI values smoothly while keeping the final value available to assistive tech. */
export function AnimatedNumber({ value, format, duration = 1700, className }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef<number | null>(null);
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    const startValue = previousValue.current ?? 0;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches || target === startValue || duration <= 0) {
      previousValue.current = target;
      setDisplayValue(target);
      return;
    }

    let frame = 0;
    let startTime = 0;
    let lastPaint = 0;
    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min(1, (time - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const nextValue = startValue + (target - startValue) * eased;
      if (progress === 1 || time - lastPaint >= 32) {
        setDisplayValue(progress === 1 ? target : nextValue);
        lastPaint = time;
      }
      if (progress < 1) frame = window.requestAnimationFrame(animate);
      else previousValue.current = target;
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className={className} aria-label={formatRef.current(value)}>{formatRef.current(displayValue)}</span>;
}
