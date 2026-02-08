import { useEffect, useState, useCallback, useRef } from 'react';

export function useDebounce<T>(value: T, delay?: number): T;
export function useDebounce(effect: () => void, delay?: number): () => void;
export function useDebounce<T>(valueOrEffect: T | (() => void), delay: number = 500): T | (() => void) {
  // If it's a function (effect), we use the customized hook logic
  if (typeof valueOrEffect === 'function') {
      return useDebounceCallback(valueOrEffect as () => void, delay);
  }

  // If it's a value, we use the standard value debounce logic
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [debouncedValue, setDebouncedValue] = useState<T>(valueOrEffect);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(valueOrEffect);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [valueOrEffect, delay]);

  return debouncedValue;
}

function useDebounceCallback(callback: () => void, delay: number) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    return useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            callbackRef.current();
        }, delay);
    }, [delay]);
}
