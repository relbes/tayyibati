import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface DeveloperModeContextType {
  isDevMode: boolean;
  setDevMode: (enabled: boolean) => void;
  toggleDevMode: () => void;
}

const DeveloperModeContext = createContext<DeveloperModeContextType>({
  isDevMode: false,
  setDevMode: () => {},
  toggleDevMode: () => {},
});

const STORAGE_KEY = "tayyibati_developer_mode_enabled";

export const DeveloperModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDevMode, setIsDevMode] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "true") {
        setIsDevMode(true);
      }
    });
  }, []);

  const setDevMode = (enabled: boolean) => {
    setIsDevMode(enabled);
    AsyncStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  };

  const toggleDevMode = () => {
    setDevMode(!isDevMode);
  };

  return (
    <DeveloperModeContext.Provider value={{ isDevMode, setDevMode, toggleDevMode }}>
      {children}
    </DeveloperModeContext.Provider>
  );
};

export const useDeveloperMode = () => useContext(DeveloperModeContext);
