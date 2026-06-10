import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface User {
  id: string;
  email: string;
  name: string;
  isPremium: boolean;
  provider?: "email" | "google";
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, name: string, opts?: { provider?: "email" | "google"; avatar?: string; id?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updatePremium: (isPremium: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = "tayyibati_user_v2";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(USER_KEY)
      .then((data) => {
        if (data) {
          try {
            setUser(JSON.parse(data));
          } catch {
            AsyncStorage.removeItem(USER_KEY);
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = useCallback(async (
    email: string,
    name: string,
    opts?: { provider?: "email" | "google"; avatar?: string; id?: string }
  ) => {
    const stableId = opts?.id ??
      "user_" + Buffer.from(email.toLowerCase()).toString("base64").replace(/[^a-z0-9]/gi, "").slice(0, 16);
    const newUser: User = {
      id: stableId,
      email,
      name,
      isPremium: false,
      provider: opts?.provider ?? "email",
      ...(opts?.avatar ? { avatar: opts.avatar } : {}),
    };
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const updatePremium = useCallback((isPremium: boolean) => {
    if (!user) return;
    const updated = { ...user, isPremium };
    setUser(updated);
    AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, updatePremium }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
