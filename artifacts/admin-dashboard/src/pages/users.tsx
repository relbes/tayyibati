import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LangContext";
import { tr } from "@/lib/i18n";
import { Pencil, Trash2, Users as UsersIcon, Star, Search, Key, Mail, LockOpen, Lock } from "lucide-react";

const API_BASE = () => localStorage.getItem("tayyibati_api_url") || "";
const adminHeaders = (): HeadersInit => {
  const token = localStorage.getItem("tayyibati_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface User {
  id: string;
  email: string;
  name: string;
  isPremium: string;
  provider: string;
  avatar: string | null;
  planId: number | null;
  hasPassword: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
  failedLoginAttempts: number;
  createdAt: string;
}

interface Plan { id: number; name: string; nameEn: string; dailyLimit: number; }

async function fetchUsers(search: string): Promise<User[]> {
  const url = search
    ? `${API_BASE()}/api/users?search=${encodeURIComponent(search)}`
    : `${API_BASE()}/api/users`;
  const res = await fetch(url, { headers: adminHeaders() });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}
async function fetchPlans(): Promise<Plan[]> {
  const res = await fetch(`${API_BASE()}/api/plans`);
  if (!res.ok) throw new Error("Failed to fetch plans");
  return res.json();
}
async function updateUser(id: string, data: Partial<Pick<User, "name" | "email" | "isPremium">>): Promise<User> {
  const res = await fetch(`${API_BASE()}/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update user");
  return res.json();
}
async function enrollPlan(id: string, planId: number | null): Promise<User> {
  const res = await fetch(`${API_BASE()}/api/users/${id}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify({ planId }),
  });
  if (!res.ok) throw new Error("Failed to update plan");
  return res.json();
}
async function resetPassword(id: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE()}/api/users/${id}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to reset password");
  }
}
async function unlockUser(id: string): Promise<User> {
  const res = await fetch(`${API_BASE()}/api/users/${id}/unlock`, {
    method: "POST", headers: { "Content-Type": "application/json", ...adminHeaders() },
  });
  if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || "Failed"); }
  return res.json();
}
async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${API_BASE()}/api/users/${id}`, { method: "DELETE", headers: adminHeaders() });
  if (!res.ok) throw new Error("Failed to delete user");
}

function formatLockedUntil(lockedUntil: string, lang: "ar" | "en"): string {
  const date = new Date(lockedUntil);
  const secsLeft = Math.ceil((date.getTime() - Date.now()) / 1000);
  if (secsLeft <= 0) return lang === "ar" ? "تنتهي قريباً" : "Expiring…";
  if (secsLeft < 60) return lang === "ar" ? `${secsLeft}ث` : `${secsLeft}s`;
  const mins = Math.ceil(secsLeft / 60);
  return lang === "ar" ? `${mins} دقيقة` : `${mins}m`;
}

const NO_PLAN = "none";

export default function Users() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { lang } = useLang();
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", isPremium: "false", planId: NO_PLAN });
  const [newPassword, setNewPassword] = useState("");

  const { data: users = [], isLoading } = useQuery({ queryKey: ["users", search], queryFn: () => fetchUsers(search) });
  const { data: plans = [] } = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      await updateUser(editUser.id, { name: form.name, email: form.email, isPremium: form.isPremium });
      const desiredPlan = form.planId === NO_PLAN ? null : Number(form.planId);
      if (desiredPlan !== (editUser.planId ?? null)) await enrollPlan(editUser.id, desiredPlan);
      if (newPassword.trim()) await resetPassword(editUser.id, newPassword.trim());
    },
    onSuccess: () => { invalidate(); setEditUser(null); setNewPassword(""); toast({ title: tr(lang, "userUpdated") }); },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" }),
  });

  const unlockMut = useMutation({
    mutationFn: (id: string) => unlockUser(id),
    onSuccess: (updated) => {
      qc.setQueryData(["users", search], (old: User[] | undefined) =>
        old ? old.map((u) => (u.id === updated.id ? updated : u)) : old
      );
      if (editUser?.id === updated.id) setEditUser(updated);
      toast({ title: tr(lang, "userUnlocked") });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { invalidate(); toast({ title: tr(lang, "userDeleted") }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const openEdit = (user: User) => {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, isPremium: user.isPremium, planId: user.planId != null ? String(user.planId) : NO_PLAN });
    setNewPassword("");
  };

  const handleDelete = (user: User) => {
    const msg = lang === "ar"
      ? `حذف المستخدم "${user.email}" نهائياً؟`
      : `Delete user "${user.email}"? This cannot be undone.`;
    if (confirm(msg)) deleteMut.mutate(user.id);
  };

  const planName = (id: number | null) => {
    if (id == null) return null;
    const p = plans.find((pl) => pl.id === id);
    if (!p) return `#${id}`;
    return lang === "ar" ? p.name : p.nameEn;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{tr(lang, "users")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {lang === "ar" ? "إدارة الحسابات والخطط والصلاحيات" : "Manage app accounts, plans, and access"}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={lang === "ar" ? "بحث بالاسم أو البريد..." : "Search by name or email..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">{tr(lang, "loading")}</div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <UsersIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {search
              ? (lang === "ar" ? "لا يوجد مستخدمون يطابقون البحث" : "No users match your search.")
              : tr(lang, "noUsers")}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "ar" ? "المستخدم" : "User"}</TableHead>
                <TableHead>{tr(lang, "provider")}</TableHead>
                <TableHead>{tr(lang, "plan")}</TableHead>
                <TableHead>{tr(lang, "status")}</TableHead>
                <TableHead>{lang === "ar" ? "الحجب" : "Lockout"}</TableHead>
                <TableHead className="w-[100px]">{tr(lang, "actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                  </TableCell>
                  <TableCell className="capitalize">{user.provider}</TableCell>
                  <TableCell>
                    {planName(user.planId) ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {user.isPremium === "true"
                      ? <Badge className="gap-1"><Star className="h-3 w-3" /> {tr(lang, "premium")}</Badge>
                      : <Badge variant="secondary">{tr(lang, "basic")}</Badge>}
                  </TableCell>
                  <TableCell>
                    {user.isLocked ? (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <Lock className="h-3 w-3" /> {tr(lang, "locked")}
                        </Badge>
                        {user.lockedUntil && (
                          <span className="text-xs text-muted-foreground">
                            {formatLockedUntil(user.lockedUntil, lang)}
                          </span>
                        )}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(user)}
                        className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr(lang, "editUser")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editUser?.isLocked && (
              <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      {lang === "ar" ? "الحساب محجوب" : "Account locked"}
                    </p>
                    {editUser.lockedUntil && (
                      <p className="text-xs text-muted-foreground">
                        {formatLockedUntil(editUser.lockedUntil, lang)} · {editUser.failedLoginAttempts} {tr(lang, "failedAttempts")}
                      </p>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="outline"
                  className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => unlockMut.mutate(editUser.id)} disabled={unlockMut.isPending}>
                  <LockOpen className="h-3.5 w-3.5" />
                  {tr(lang, "unlock")}
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{tr(lang, "name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {tr(lang, "email")}</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{tr(lang, "status")}</Label>
                <Select value={form.isPremium} onValueChange={(v) => setForm({ ...form, isPremium: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">{tr(lang, "basic")}</SelectItem>
                    <SelectItem value="true">{tr(lang, "premium")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{tr(lang, "plan")}</Label>
                <Select value={form.planId} onValueChange={(v) => setForm({ ...form, planId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PLAN}>{lang === "ar" ? "بدون خطة" : "No plan"}</SelectItem>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{lang === "ar" ? p.name : p.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Key className="h-3.5 w-3.5" /> {tr(lang, "resetPassword")}</Label>
              <Input type="text"
                placeholder={lang === "ar" ? "اتركه فارغاً للإبقاء على كلمة المرور الحالية" : "Leave blank to keep current"}
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                {editUser?.hasPassword
                  ? (lang === "ar" ? "المستخدم لديه كلمة مرور." : "User has a password set.")
                  : (lang === "ar" ? "لا توجد كلمة مرور." : "User has no password yet.")}
                {" "}{lang === "ar" ? "4 أحرف على الأقل." : "Min 4 characters."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>{tr(lang, "cancel")}</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!form.email || saveMut.isPending}>
              {tr(lang, "save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
