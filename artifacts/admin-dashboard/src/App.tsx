import { Switch, Route, Router as WouterRouter, Link, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState, useCallback } from "react";
import NotFound from "@/pages/not-found";
import Overview from "@/pages/overview";
import Foods from "@/pages/foods";
import Dishes from "@/pages/dishes";
import KnowledgeReview from "@/pages/knowledge-review";
import AiReview from "@/pages/ai-review";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import Plans from "@/pages/plans";
import Users from "@/pages/users";
import Login from "@/pages/login";
import { LangProvider, useLang } from "@/contexts/LangContext";
import { tr } from "@/lib/i18n";
import { adminFetch, API_BASE } from "@/lib/api";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Utensils,
  CheckSquare,
  Bot,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Star,
  Users as UsersIcon,
  Menu,
  X,
  LogOut,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function Sidebar({ open, onClose, onLogout }: { open: boolean; onClose: () => void; onLogout: () => void }) {
  const [location] = useLocation();
  const { lang, toggle } = useLang();

  const NAV_ITEMS = [
    { path: "/", label: lang === "ar" ? "لوحة التحكم" : "Dashboard", icon: LayoutDashboard },
    { path: "/foods", label: tr(lang, "foodDb"), icon: UtensilsCrossed },
    { path: "/dishes", label: lang === "ar" ? "الأطباق" : "Dishes", icon: Utensils },
    { path: "/knowledge-review", label: lang === "ar" ? "مراجعة المعرفة" : "Knowledge Review", icon: CheckSquare },
    { path: "/ai-review", label: lang === "ar" ? "مراجعة الذكاء الاصطناعي" : "AI Review", icon: Bot },
    { path: "/history", label: lang === "ar" ? "سجل البحث" : "Search History", icon: HistoryIcon },
    { path: "/users", label: tr(lang, "users"), icon: UsersIcon },
    { path: "/subscription-plans", label: lang === "ar" ? "باقات الاشتراك" : "Subscription Plans", icon: Star },
    { path: "/settings", label: tr(lang, "settings"), icon: SettingsIcon },
  ];

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-30 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-sidebar-primary-foreground font-bold text-sm">ط</span>
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">طيباتي</p>
            <p className="text-xs text-sidebar-foreground/60 mt-0.5">
              {lang === "ar" ? "لوحة التحكم" : "Admin Dashboard"}
            </p>
          </div>
          <button
            className="mr-auto lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
              const active = path === "/" ? location === "/" : location.startsWith(path);
              return (
                <li key={path}>
                  <Link
                    href={path}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <button
            onClick={toggle}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <Languages className="h-4 w-4" />
            {lang === "ar" ? "English" : "العربية"}
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {tr(lang, "logout")}
          </button>
          <p className="text-xs text-sidebar-foreground/40 px-3">طيباتي Admin v1.0</p>
        </div>
      </aside>
    </>
  );
}

function Layout({ onLogout }: { onLogout: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden flex-row">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={onLogout} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-4 border-b bg-card px-6 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground/70 hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <span className="text-primary-foreground font-bold text-xs">ط</span>
            </div>
            <span className="font-semibold text-sm">طيباتي Admin</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Switch>
            <Route path="/" component={Overview} />
            <Route path="/login">{() => <Redirect to="/" />}</Route>
            <Route path="/foods" component={Foods} />
            <Route path="/dishes" component={Dishes} />
            <Route path="/knowledge-review" component={KnowledgeReview} />
            <Route path="/ai-review" component={AiReview} />
            <Route path="/history" component={History} />
            <Route path="/users" component={Users} />
            <Route path="/subscription-plans" component={Plans} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

async function verifyAdminSession(): Promise<any | null> {
  try {
    const res = await adminFetch(`${API_BASE}/api/admin/me`);
    if (res.ok) {
      const data = await res.json();
      return data.authenticated ? data.admin : null;
    }
    return null;
  } catch {
    return null;
  }
}

function App() {
  const [adminUser, setAdminUser] = useState<any | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    localStorage.removeItem("tayyibati_admin_token");

    verifyAdminSession().then((user) => {
      setAdminUser(user);
      setChecking(false);
    });
  }, []);

  const handleLoginSuccess = useCallback((user: any) => {
    if (window.location.pathname === "/login") {
      window.history.replaceState(null, "", "/");
    }
    setAdminUser(user);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await adminFetch(`${API_BASE}/api/admin/logout`, { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      if (window.location.pathname !== "/login") {
        window.history.replaceState(null, "", "/login");
      }
      setAdminUser(null);
      queryClient.clear();
    }
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!adminUser) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LangProvider>
            <Login onLoginSuccess={handleLoginSuccess} />
          </LangProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LangProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Layout onLogout={handleLogout} />
          </WouterRouter>
        </LangProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
