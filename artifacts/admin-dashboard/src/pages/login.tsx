import { API_BASE, adminFetch } from "@/lib/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Lock, User } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (admin: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await adminFetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      const body = await res.json();

      if (!res.ok || !body.success) {
        setError(body.error || "بيانات تسجيل الدخول غير صحيحة");
        return;
      }

      onLoginSuccess(body.admin);
    } catch (err) {
      console.error("Login error:", err);
      setError("تعذّر الوصول إلى الخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 dir-rtl">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <span className="text-primary-foreground font-bold text-xl">ط</span>
          </div>
          <h1 className="text-2xl font-bold">طيباتي Admin</h1>
          <p className="text-sm text-muted-foreground">تسجيل دخول لوحة التحكم</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" />
              تسجيل دخول لوحة التحكم
            </CardTitle>
            <CardDescription>
              أدخل اسم المستخدم وكلمة المرور للمتابعة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2 text-right">
                <Label htmlFor="username">اسم المستخدم أو البريد الإلكتروني</Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="أدخل اسم المستخدم أو البريد"
                    className="pr-9"
                    autoFocus
                  />
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-2 text-right">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={visible ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="pl-10"
                  />
                  <button
                    type="button"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setVisible((v) => !v)}
                    tabIndex={-1}
                  >
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive text-center">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!username.trim() || !password.trim() || loading}>
                {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
