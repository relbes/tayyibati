import { useState, useEffect } from "react";
import { setBaseUrl, useHealthCheck } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, RefreshCw, Globe, Trash2 } from "lucide-react";

const STORAGE_KEY = "tayyibati_api_url";

export default function Settings() {
  const [apiUrl, setApiUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    setApiUrl(stored);
    setSaved(!!stored);
  }, []);

  const { data: health, isLoading: checking, refetch, isError } = useHealthCheck();

  function handleSave() {
    const trimmed = apiUrl.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      setBaseUrl(trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setBaseUrl(null);
    }
    setSaved(!!trimmed);
    queryClient.clear();
    toast({ title: "Settings saved", description: "API URL updated. Queries reset." });
    setTimeout(() => refetch(), 300);
  }

  function handleClear() {
    setApiUrl("");
    localStorage.removeItem(STORAGE_KEY);
    setBaseUrl(null);
    setSaved(false);
    queryClient.clear();
    toast({ title: "Cleared", description: "Using default relative API path." });
  }

  const isConnected = !!health?.status;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Configure how the dashboard connects to the Tayyibati API
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" />
            API Connection
          </CardTitle>
          <CardDescription>
            By default the dashboard connects to the Tayyibati API running on the same
            server (relative path <code className="text-xs font-mono">/api</code>). If
            you're self-hosting the dashboard separately, enter your API server's full
            base URL below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-url">API Base URL</Label>
            <div className="flex gap-2">
              <Input
                id="api-url"
                placeholder="https://your-api-server.com (leave blank for default)"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <Button onClick={handleSave}>Save</Button>
              {saved && (
                <Button variant="outline" size="icon" onClick={handleClear}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {saved
                ? `Custom API URL active: ${localStorage.getItem(STORAGE_KEY)}`
                : "Using default relative /api path"}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-4 bg-muted/30">
            <div className="flex-1">
              <p className="text-sm font-medium">Connection Status</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {checking
                  ? "Checking…"
                  : isConnected
                    ? "API server is reachable"
                    : "Unable to reach API server"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {checking ? (
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : isConnected ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={checking}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Self-Hosting Instructions</CardTitle>
          <CardDescription>
            Deploy the admin dashboard on your own server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="space-y-2 list-decimal list-inside">
            <li>
              Build the dashboard:{" "}
              <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
                pnpm --filter @workspace/admin-dashboard run build
              </code>
            </li>
            <li>
              Copy the <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">dist/</code> folder to your web server (nginx, Caddy, etc.)
            </li>
            <li>
              Make sure your API server has CORS enabled for the dashboard's origin
            </li>
            <li>
              Enter your API server URL in the field above and click Save
            </li>
          </ol>
          <p className="text-xs pt-1">
            The dashboard is a fully static SPA — no server-side rendering required.
            All API calls happen from the browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
