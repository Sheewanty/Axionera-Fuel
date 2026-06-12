"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * useState backed by localStorage. Safe during SSR — falls back to
 * the initialValue until the component mounts on the client.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Initialise from localStorage only on first render (client only)
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Sync to localStorage whenever the value changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      // Storage quota or private-mode error — ignore
    }
  }, [key, storedValue]);

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (value) => {
      setStoredValue(value);
    },
    []
  );

  return [storedValue, setValue];
}
