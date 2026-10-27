import { useSyncExternalStore } from 'react';

/**
 * Minimal external store: get / set / subscribe plus a React hook. Enough
 * for the app's few pieces of global state without adding a state library.
 */
export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
  use<S = T>(selector?: (state: T) => S): S;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  const store: Store<T> = {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    use<S>(selector?: (state: T) => S): S {
      const select = selector ?? ((s: T) => s as unknown as S);
      return useSyncExternalStore(store.subscribe, () => select(state));
    },
  };
  return store;
}
