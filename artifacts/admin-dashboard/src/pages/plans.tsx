import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Star, CheckCircle } from "lucide-react";

const API_BASE = () => {
  const stored = localStorage.getItem("tayyibati_api_url");
  return stored || "";
};
const adminHeaders = (): HeadersInit => {
  const token = localStorage.getItem("tayyibati_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface Plan {
  id: number;
  name: string;
  nameEn: string;
  dailyLimit: number;
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

function parseFeatures(features: string): string {
  try {
    const arr = JSON.parse(features);
    return Array.isArray(arr) ? arr.join("\n") : features;
  } catch {
    return features;
  }
}

export default function Plans() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);

  const { data: plans = [], isLoading } = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });

  const createMut = useMutation({
    mutationFn: createPlan,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plans"] }); setDialogOpen(false); toast({ title: "Plan created" }); },
    onError: () => toast({ title: "Failed to create plan", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PlanForm> }) => updatePlan(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plans"] }); setDialogOpen(false); toast({ title: "Plan updated" }); },
    onError: () => toast({ title: "Failed to update plan", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: deletePlan,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plans"] }); toast({ title: "Plan deleted" }); },
    onError: () => toast({ title: "Failed to delete plan", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({ ...plan, features: parseFeatures(plan.features) });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name || !form.nameEn) return;
    if (editingPlan) {
      updateMut.mutate({ id: editingPlan.id, data: form });
    } else {
      createMut.mutate(form);
    }
  };

  const handleToggleActive = (plan: Plan) => {
    updateMut.mutate({ id: plan.id, data: { isActive: plan.isActive === "true" ? "false" : "true" } });
  };

  const handleDelete = (plan: Plan) => {
    if (confirm(`Delete plan "${plan.nameEn}"?`)) deleteMut.mutate(plan.id);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage free and paid plans shown in the mobile app</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : plans.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Star className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No plans yet. Create your first plan.</p>
          <Button onClick={openCreate} variant="outline" className="mt-4">
            <Plus className="h-4 w-4 mr-2" /> Create Plan
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Daily Limit</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {plan.dailyLimit < 0 || plan.dailyLimit > 20 ? (
                          <Star className="h-3.5 w-3.5 text-amber-500" />
                        ) : null}
                        {plan.nameEn}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5" dir="rtl">{plan.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {parseFloat(plan.price) > 0
                      ? `${plan.price} ${plan.currency}`
                      : <span className="text-muted-foreground">Free</span>}
                  </TableCell>
                  <TableCell>
                    {plan.dailyLimit < 0
                      ? <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Unlimited</span>
                      : `${plan.dailyLimit} / day`}
                  </TableCell>
                  <TableCell className="capitalize">{plan.billingCycle}</TableCell>
                  <TableCell>
                    <Badge
                      variant={plan.isActive === "true" ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleToggleActive(plan)}
                    >
                      {plan.isActive === "true" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "New Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name (Arabic)</Label>
                <Input
                  dir="rtl"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="بريميوم"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Name (English)</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  placeholder="Premium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Price</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="9.99"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  placeholder="SAR"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Daily Limit (-1 = unlimited)</Label>
                <Input
                  type="number"
                  value={form.dailyLimit}
                  onChange={(e) => setForm({ ...form, dailyLimit: parseInt(e.target.value) || -1 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Billing Cycle</Label>
                <Select value={form.billingCycle} onValueChange={(v) => setForm({ ...form, billingCycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Features (one per line, Arabic)</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[100px]"
                dir="rtl"
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                placeholder={"تحليلات غير محدودة\nبحث بالنص\nتحليل الصور"}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.name || !form.nameEn || createMut.isPending || updateMut.isPending}
            >
              {editingPlan ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
