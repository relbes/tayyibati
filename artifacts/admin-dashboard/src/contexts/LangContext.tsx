import { createContext, useContext, useState, type ReactNode } from "react";
import type { Lang } from "@/lib/i18n";

interface LangContextType {
  lang: Lang;
  toggle: () => void;
}

const LangContext = createContext<LangContextType>({ lang: "ar", toggle: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem("tayyibati_admin_lang") as Lang) || "ar"
  );

  const toggle = () => {
    setLang((l) => {
      const next: Lang = l === "ar" ? "en" : "ar";
      localStorage.setItem("tayyibati_admin_lang", next);
      return next;
    });
  };

  return (
    <LangContext.Provider value={{ lang, toggle }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
