import { useEffect, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/** Animate a number from its previous value to `target` over `duration` ms (static under reduced motion). */
export const useCountUp = (target: number, duration = 700): number => {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      return undefined;
    }
    const from = value;
    if (from === target) return undefined;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / duration);
      setValue(from + (target - from) * easeOutExpo(p));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, reduced]);

  return value;
};
