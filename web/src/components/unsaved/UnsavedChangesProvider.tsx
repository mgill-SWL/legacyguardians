"use client";

import React, { createContext, useContext, useMemo, useRef, useState } from "react";

type SaveFn = () => Promise<void> | void;

type Ctx = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  saveFn: SaveFn | null;
  registerSaveFn: (fn: SaveFn | null) => void;
};

const UnsavedChangesContext = createContext<Ctx | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const saveFnRef = useRef<SaveFn | null>(null);

  const value = useMemo<Ctx>(() => {
    return {
      dirty,
      setDirty,
      saveFn: saveFnRef.current,
      registerSaveFn: (fn) => {
        saveFnRef.current = fn;
      },
    };
  }, [dirty]);

  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  return ctx;
}
