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
import { Plus, Pencil, Trash2, Star, CheckCircle, FileText, Camera, Layers } from "lucide-react";

const API_BASE = () => localStorage.getItem("tayyibati_api_url") || "";
const adminHeaders = (): HeadersInit => {
  const token = localStorage.getItem("tayyibati_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface Plan {
  id: number;
  name: string;
  nameEn: string;
  dailyLimit: number;
  dailyTextLimit: number;
  dailyImageLimit: number;
  price: string;
  currency: string;
  billingCycle: string;
  features: string;
  isActive: string;
  sortOrder: number;
}

type PlanForm = Omit<Plan, "id">;

const EMPTY_FORM: PlanForm = {
  name: "",
  nameEn: "",
  dailyLimit: 10,
  dailyTextLimit: 10,
  dailyImageLimit: 5,
  price: "0",
  currency: "SAR",
  billingCycle: "monthly",
  features: "",
  isActive: "true",
  sortOrder: 0,
};

async function fetchPlans(): Promise<Plan[]> {
  const res = await fetch(`${API_BASE()}/api/plans`);
  if (!res.ok) throw new Error("Failed to fetch plans");
  return res.json();
}

async function createPlan(data: PlanForm): Promise<Plan> {
  const res = await fetch(`${API_BASE()}/api/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify({
      ...data,
      features: Array.isArray(data.features)
        ? JSON.stringify(data.features)
        : JSON.stringify(data.features.split("\n").filter(Boolean)),
    }),
  });
  if (!res.ok) throw new Error("Failed to create plan");
  return res.json();
}

async function updatePlan(id: number, data: Partial<PlanForm>): Promise<Plan> {
  const body = { ...data };
  if (typeof body.features === "string") {
    body.features = JSON.stringify(body.features.split("\n").filter(Boolean));
  }
  const res = await fetch(`${API_BASE()}/api/plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update plan");
  return res.json();
}

async function deletePlan(id: number): Promise<void> {
  const res = await fetch(`${API_BASE()}/api/plans/${id}`, { method: "DELETE", headers: adminHeaders() });
  if (!res.ok) throw new Error("Failed to delete plan");
}

async function bulkUpdateLimits(dailyTextLimit: number, dailyImageLimit: number): Promise<Plan[]> {
  const res = await fetch(`${API_BASE()}/api/plans/bulk-limits`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify({ dailyTextLimit, dailyImageLimit }),
  });
  if (!res.ok) throw new Error("Failed to bulk update");
  return res.json();
}

function parseFeatures(features: string): string {
  try {
    const arr = JSON.parse(features);
    return Array.isArray(arr) ? arr.join("\n") : features;
  } catch { return features; }
}

function LimitBadge({ value, label }: { value: number; label: string }) {
  if (value < 0) return (
    <span className="flex items-center gap-1 text-green-600 text-xs">
      <CheckCircle className="h-3 w-3" />∞
    </span>
  );
  return <span className="text-xs">{value} <span className="text-muted-foreground">{label}</span></span>;
}

function LimitInput({
  label,
  icon: Icon,
  value,
  onChange,
  lang,
}: {
  label: string;
  icon: React.ElementType;
  value: number;
  onChange: (v: number) => void;
  lang: "ar" | "en";
}) {
  const unlimited = value < 0;
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          value={unlimited ? "" : value}
          disabled={unlimited}
          onChange={(e) => onChange(parseInt(e.target.value) || 1)}
          className="w-24"
          placeholder="..."
        />
        <button
          type="button"
          onClick={() => onChange(unlimited ? 10 : -1)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            unlimited
              ? "bg-green-100 text-green-700 border-green-300"
              : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
          }`}
        >
          {unlimited ? `✓ ${tr(lang, "unlimited")}` : tr(lang, "noLimit")}
        </button>
      </div>
    </div>
  );
}

export default function Plans() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { lang } = useLang();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [bulkForm, setBulkForm] = useState({ dailyTextLimit: 10, dailyImageLimit: 5 });

  const { data: plans = [], isLoading } = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });

  const createMut = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      setDialogOpen(false);
      toast({ title: tr(lang, "planCreated") });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PlanForm> }) => updatePlan(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      setDialogOpen(false);
      toast({ title: tr(lang, "planUpdated") });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: deletePlan,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plans"] }); toast({ title: tr(lang, "planDeleted") }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const bulkMut = useMutation({
    mutationFn: () => bulkUpdateLimits(bulkForm.dailyTextLimit, bulkForm.dailyImageLimit),
    onSuccess: (updated) => {
      qc.setQueryData(["plans"], updated);
      setBulkOpen(false);
      toast({ title: tr(lang, "bulkUpdated") });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const openCreate = () => { setEditingPlan(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({ ...plan, features: parseFeatures(plan.features) });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name || !form.nameEn) return;
    if (editingPlan) updateMut.mutate({ id: editingPlan.id, data: form });
    else createMut.mutate(form);
  };

  const handleToggleActive = (plan: Plan) => {
    updateMut.mutate({ id: plan.id, data: { isActive: plan.isActive === "true" ? "false" : "true" } });
  };

  const handleDelete = (plan: Plan) => {
    const msg = lang === "ar" ? `حذف الخطة "${plan.name}"؟` : `Delete plan "${plan.nameEn}"?`;
    if (confirm(msg)) deleteMut.mutate(plan.id);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr(lang, "plans")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{tr(lang, "managePlans")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Layers className="h-4 w-4 mr-2" />
            {tr(lang, "bulkUpdate")}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {tr(lang, "newPlan")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">{tr(lang, "loading")}</div>
      ) : plans.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Star className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{tr(lang, "noPlanYet")}</p>
          <Button onClick={openCreate} variant="outline" className="mt-4">
            <Plus className="h-4 w-4 mr-2" /> {tr(lang, "createPlan")}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tr(lang, "name")}</TableHead>
                <TableHead>{tr(lang, "price")}</TableHead>
                <TableHead className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> {tr(lang, "textSearches")}
                </TableHead>
                <TableHead>
                  <span className="flex items-center gap-1">
                    <Camera className="h-3.5 w-3.5" /> {tr(lang, "imageScans")}
                  </span>
                </TableHead>
                <TableHead>{tr(lang, "billingCycle")}</TableHead>
                <TableHead>{tr(lang, "status")}</TableHead>
                <TableHead className="w-[100px]">{tr(lang, "actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-1.5">
                      {parseFloat(plan.price) > 0 && <Star className="h-3.5 w-3.5 text-amber-500" />}
                      {lang === "ar" ? plan.name : plan.nameEn}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5" dir={lang === "ar" ? "ltr" : "rtl"}>
                      {lang === "ar" ? plan.nameEn : plan.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {parseFloat(plan.price) > 0
                      ? `${plan.price} ${plan.currency}`
                      : <span className="text-muted-foreground">{tr(lang, "free")}</span>}
                  </TableCell>
                  <TableCell>
                    <LimitBadge value={plan.dailyTextLimit} label={tr(lang, "perDay")} />
                  </TableCell>
                  <TableCell>
                    <LimitBadge value={plan.dailyImageLimit} label={tr(lang, "perDay")} />
                  </TableCell>
                  <TableCell className="capitalize">
                    {plan.billingCycle === "monthly" ? tr(lang, "monthly")
                      : plan.billingCycle === "yearly" ? tr(lang, "yearly")
                      : tr(lang, "free")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={plan.isActive === "true" ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleToggleActive(plan)}
                    >
                      {plan.isActive === "true" ? tr(lang, "active") : tr(lang, "inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(plan)}
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

      {/* Plan create/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPlan ? tr(lang, "editPlan") : tr(lang, "newPlan")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{tr(lang, "planNameAr")}</Label>
                <Input dir="rtl" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="بريميوم" />
              </div>
              <div className="space-y-1.5">
                <Label>{tr(lang, "planNameEn")}</Label>
                <Input value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="Premium" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{tr(lang, "price")}</Label>
                <Input type="number" value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="9.99" />
              </div>
              <div className="space-y-1.5">
                <Label>{tr(lang, "currency")}</Label>
                <Input value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="SAR" />
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Layers className="h-4 w-4" />
                {lang === "ar" ? "حدود الاستخدام اليومي" : "Daily Usage Limits"}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <LimitInput
                  label={tr(lang, "dailyTextLimit")}
                  icon={FileText}
                  value={form.dailyTextLimit}
                  onChange={(v) => setForm({ ...form, dailyTextLimit: v })}
                  lang={lang}
                />
                <LimitInput
                  label={tr(lang, "dailyImageLimit")}
                  icon={Camera}
                  value={form.dailyImageLimit}
                  onChange={(v) => setForm({ ...form, dailyImageLimit: v })}
                  lang={lang}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{tr(lang, "billingCycle")}</Label>
                <Select value={form.billingCycle} onValueChange={(v) => setForm({ ...form, billingCycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">{tr(lang, "free")}</SelectItem>
                    <SelectItem value="monthly">{tr(lang, "monthly")}</SelectItem>
                    <SelectItem value="yearly">{tr(lang, "yearly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{tr(lang, "sortOrder")}</Label>
                <Input type="number" value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{tr(lang, "features")}</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
                dir="rtl"
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                placeholder={"تحليلات غير محدودة\nبحث بالنص\nتحليل الصور"}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{tr(lang, "status")}</Label>
              <Select value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{tr(lang, "active")}</SelectItem>
                  <SelectItem value="false">{tr(lang, "inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tr(lang, "cancel")}</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.name || !form.nameEn || createMut.isPending || updateMut.isPending}
            >
              {editingPlan ? tr(lang, "save") : tr(lang, "createPlan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk update dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr(lang, "bulkUpdate")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{tr(lang, "bulkUpdateDesc")}</p>
            <div className="grid grid-cols-2 gap-4">
              <LimitInput
                label={tr(lang, "dailyTextLimit")}
                icon={FileText}
                value={bulkForm.dailyTextLimit}
                onChange={(v) => setBulkForm({ ...bulkForm, dailyTextLimit: v })}
                lang={lang}
              />
              <LimitInput
                label={tr(lang, "dailyImageLimit")}
                icon={Camera}
                value={bulkForm.dailyImageLimit}
                onChange={(v) => setBulkForm({ ...bulkForm, dailyImageLimit: v })}
                lang={lang}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>{tr(lang, "cancel")}</Button>
            <Button onClick={() => bulkMut.mutate()} disabled={bulkMut.isPending}>
              {tr(lang, "applyToAll")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
