import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerUser, loginUser, getUser } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  isPremium: boolean;
  provider?: "email" | "google";
  avatar?: string;
  planId?: number | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, name: string, opts?: { provider?: "email" | "google"; avatar?: string; id?: string }) => Promise<void>;
  registerWithPassword: (email: string, name: string, password: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updatePremium: (isPremium: boolean) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = "tayyibati_user_v2";

interface ApiUser {
  id: string;
  email: string;
  name: string;
  isPremium: string;
  provider?: "email" | "google";
  avatar?: string | null;
  planId?: number | null;
}

function toUser(api: ApiUser): User {
  return {
    id: api.id,
    email: api.email,
    name: api.name,
    isPremium: api.isPremium === "true",
    provider: api.provider ?? "email",
    ...(api.avatar ? { avatar: api.avatar } : {}),
    planId: api.planId ?? null,
  };
}

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

  const persist = useCallback(async (u: User) => {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const signIn = useCallback(async (
    email: string,
    name: string,
    opts?: { provider?: "email" | "google"; avatar?: string; id?: string }
  ) => {
    const api = await registerUser({
      email,
      name,
      provider: opts?.provider ?? "email",
      avatar: opts?.avatar,
      id: opts?.id,
    });
    await persist(toUser(api));
  }, [persist]);

  const registerWithPassword = useCallback(async (email: string, name: string, password: string) => {
    const api = await registerUser({ email, name, password });
    await persist(toUser(api));
  }, [persist]);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const api = await loginUser({ email, password });
    await persist(toUser(api));
  }, [persist]);

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

  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const api = await getUser(user.id);
      await persist(toUser(api));
    } catch {
      // keep current state on failure
    }
  }, [user, persist]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, registerWithPassword, loginWithPassword, signOut, updatePremium, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
