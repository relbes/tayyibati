import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setBaseUrl } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import NotFound from "@/pages/not-found";
import Overview from "@/pages/overview";
import Foods from "@/pages/foods";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import Plans from "@/pages/plans";
import Users from "@/pages/users";
import {
  LayoutDashboard,
  UtensilsCrossed,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Star,
  Users as UsersIcon,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const NAV_ITEMS = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/foods", label: "Foods Database", icon: UtensilsCrossed },
  { path: "/history", label: "Analysis History", icon: HistoryIcon },
  { path: "/users", label: "Users", icon: UsersIcon },
  { path: "/plans", label: "Subscription Plans", icon: Star },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
];

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-sidebar-primary-foreground font-bold text-sm">ط</span>
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">طيباتي</p>
            <p className="text-xs text-sidebar-foreground/60 mt-0.5">Admin Dashboard</p>
          </div>
          <button
            className="ml-auto lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
              const active =
                path === "/" ? location === "/" : location.startsWith(path);
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

        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/40">Tayyibati Admin v1.0</p>
        </div>
      </aside>
    </>
  );
}

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-4 border-b bg-card px-6 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-foreground/70 hover:text-foreground"
          >
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
            <Route path="/foods" component={Foods} />
            <Route path="/history" component={History} />
            <Route path="/users" component={Users} />
            <Route path="/plans" component={Plans} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function AppInit({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem("tayyibati_api_url");
    if (stored) {
      setBaseUrl(stored);
    }
  }, []);
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppInit>
            <Layout />
          </AppInit>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
