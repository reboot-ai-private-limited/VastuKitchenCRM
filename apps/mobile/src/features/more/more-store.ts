import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const moreSheet = {
  isOpen: () => open,
  open: () => {
    if (!open) {
      open = true;
      emit();
    }
  },
  close: () => {
    if (open) {
      open = false;
      emit();
    }
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useMoreSheetOpen(): boolean {
  return useSyncExternalStore(subscribe, moreSheet.isOpen, moreSheet.isOpen);
}
