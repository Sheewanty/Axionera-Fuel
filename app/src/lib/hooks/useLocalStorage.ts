"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * useState-like localStorage hook that is safe for SSR hydration.
 * React renders the server snapshot first, then updates from localStorage.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const eventName = `local-storage:${key}`;

  const readValue = useCallback((): T => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  }, [initialValue, key]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === key) onStoreChange();
      };

      window.addEventListener("storage", handleStorage);
      window.addEventListener(eventName, onStoreChange);

      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(eventName, onStoreChange);
      };
    },
    [eventName, key]
  );

  const storedValue = useSyncExternalStore(
    subscribe,
    readValue,
    () => initialValue
  );

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (value) => {
      try {
        const currentValue = readValue();
        const nextValue =
          typeof value === "function"
            ? (value as (previous: T) => T)(currentValue)
            : value;

        window.localStorage.setItem(key, JSON.stringify(nextValue));
        window.dispatchEvent(new Event(eventName));
      } catch {
        // Storage quota or private-mode error - ignore.
      }
    },
    [eventName, key, readValue]
  );

  return [storedValue, setValue];
}
