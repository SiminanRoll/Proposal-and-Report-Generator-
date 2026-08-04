"use client";

import { useEffect, useMemo, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  delay?: number;
  format?: (value: number) => string;
  prefix?: string;
  suffix?: string;
  className?: string;
}

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function AnimatedNumber({
  value,
  duration = 900,
  delay = 0,
  format = (current) => integerFormatter.format(Math.round(current)),
  prefix = "",
  suffix = "",
  className = "",
}: AnimatedNumberProps) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const [current, setCurrent] = useState(0);
  const finalLabel = useMemo(() => `${prefix}${format(safeValue)}${suffix}`, [format, prefix, safeValue, suffix]);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reducedMotion || duration <= 0) {
      setCurrent(safeValue);
      return;
    }

    let frame = 0;
    let timer = 0;
    const startAnimation = () => {
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCurrent(safeValue * eased);
        if (progress < 1) frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
    };

    setCurrent(0);
    timer = window.setTimeout(startAnimation, Math.max(0, delay));
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [delay, duration, safeValue]);

  return <span className={`animated-number ${className}`.trim()} style={{ minWidth: `${Math.max(1, finalLabel.length)}ch` }} aria-label={finalLabel}>{prefix}{format(current)}{suffix}</span>;
}
