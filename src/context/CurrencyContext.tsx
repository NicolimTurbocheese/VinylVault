import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { DisplayCurrency, SUPPORTED_CURRENCIES, formatCurrency } from "../utils/currency";

const STORAGE_KEY = "vinylvault_display_currency";

interface CurrencyContextValue {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  format: (amountSGD: number, opts?: { compact?: boolean }) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as DisplayCurrency | null;
    return stored && (SUPPORTED_CURRENCIES as readonly string[]).includes(stored) ? stored : "SGD";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currency);
  }, [currency]);

  const setCurrency = useCallback((c: DisplayCurrency) => setCurrencyState(c), []);
  const format = useCallback(
    (amountSGD: number, opts?: { compact?: boolean }) => formatCurrency(amountSGD, currency, opts),
    [currency]
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within a CurrencyProvider");
  return ctx;
}
