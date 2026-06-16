import { useState } from "react";
import {
  useListAdminHistory, useDeleteHistoryItem, getListAdminHistoryQueryKey,
} from "@workspace/api-client-react";
import type { HistoryItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LangContext";
import { tr } from "@/lib/i18n";
import { ChevronLeft, ChevronRight, Trash2, Eye, FileText, Camera, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    allowed: "bg-green-100 text-green-800 border-green-200",
    forbidden: "bg-red-100 text-red-800 border-red-200",
    conditional: "bg-amber-100 text-amber-800 border-amber-200",
    unknown: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return map[status] ?? map.unknown;
}

function TypeIcon({ type }: { type: string }) {
  if (type === "text") return <FileText className="h-3.5 w-3.5" />;
  if (type === "image") return <Camera className="h-3.5 w-3.5" />;
  return <Tag className="h-3.5 w-3.5" />;
}

function TypeLabel({ type, lang }: { type: string; lang: "ar" | "en" }) {
  if (type === "text") return <span>{tr(lang, "text")}</span>;
  if (type === "image") return <span>{tr(lang, "image")}</span>;
  return <span>{tr(lang, "label")}</span>;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 71 ? "bg-green-100 text-green-800" : score >= 51 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", color)}>
      {score}%
    </span>
  );
}

function HistoryDetailDialog({ item, open, onClose, lang }: {
  item: HistoryItem | null; open: boolean; onClose: () => void; lang: "ar" | "en";
}) {
  if (!item) return null;
  const { report } = item;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon type={item.analysisType} />
            <span className="truncate">{item.query}</span>
            <ScoreBadge score={item.compatibilityScore} />
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">User ID</span>
              <p className="font-mono mt-0.5 truncate">{item.userId}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">{tr(lang, "date")}</span>
              <p className="mt-0.5">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
          </div>
          <p className="text-muted-foreground">{report.explanation}</p>
          {report.forbidden.length > 0 && (
            <div>
              <p className="font-semibold text-destructive mb-2">{tr(lang, "forbidden")} ({report.forbidden.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {report.forbidden.map((ing) => (
                  <span key={ing.name} className="rounded-full border bg-red-50 px-2.5 py-0.5 text-xs text-red-800 border-red-200">
                    {ing.nameAr || ing.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {report.conditional.length > 0 && (
            <div>
              <p className="font-semibold text-amber-600 mb-2">{tr(lang, "conditional")} ({report.conditional.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {report.conditional.map((ing) => (
                  <span key={ing.name} className="rounded-full border bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800 border-amber-200">
                    {ing.nameAr || ing.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {report.allowed.length > 0 && (
            <div>
              <p className="font-semibold text-green-700 mb-2">{tr(lang, "allowed")} ({report.allowed.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {report.allowed.map((ing) => (
                  <span key={ing.name} className="rounded-full border bg-green-50 px-2.5 py-0.5 text-xs text-green-800 border-green-200">
                    {ing.nameAr || ing.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {report.unknown.length > 0 && (
            <div>
              <p className="font-semibold text-muted-foreground mb-2">{tr(lang, "unknown")} ({report.unknown.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {report.unknown.map((ing) => (
                  <span key={ing.name} className="rounded-full border bg-gray-50 px-2.5 py-0.5 text-xs text-gray-700 border-gray-200">
                    {ing.nameAr || ing.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function History() {
  const [offset, setOffset] = useState(0);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HistoryItem | null>(null);
  const { toast } = useToast();
  const { lang } = useLang();
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useListAdminHistory({ limit: PAGE_SIZE, offset });

  const deleteMutation = useDeleteHistoryItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminHistoryQueryKey() });
        toast({ title: tr(lang, "itemDeleted") });
        setDeleteTarget(null);
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    },
  });

  const hasPrev = offset > 0;
  const hasNext = (items?.length ?? 0) === PAGE_SIZE;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tr(lang, "analysisHistory")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {lang === "ar" ? "جميع تحليلات المستخدمين على المنصة" : "All user food analyses across the platform"}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr(lang, "type")}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr(lang, "query")}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr(lang, "score")}</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">{tr(lang, "date")}</th>
                  <th className="px-4 py-3 text-end font-medium text-muted-foreground">{tr(lang, "actions")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      ))}
                    </tr>
                  ))
                ) : items?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      {tr(lang, "noHistory")}
                    </td>
                  </tr>
                ) : (
                  items?.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <TypeIcon type={item.analysisType} />
                          <TypeLabel type={item.analysisType} lang={lang} />
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate font-medium">{item.query}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">{item.userId}</p>
                      </td>
                      <td className="px-4 py-3"><ScoreBadge score={item.compatibilityScore} /></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedItem(item)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(item)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              {offset + 1}–{offset + (items?.length ?? 0)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                <ChevronLeft className="h-4 w-4" />
                {tr(lang, "prev")}
              </Button>
              <Button variant="outline" size="sm" disabled={!hasNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}>
                {tr(lang, "next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <HistoryDetailDialog item={selectedItem} open={!!selectedItem} onClose={() => setSelectedItem(null)} lang={lang} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "ar" ? "حذف هذا السجل؟" : "Delete this record?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "ar"
                ? `سيتم حذف تحليل "${deleteTarget?.query}" نهائياً.`
                : `This will permanently remove the analysis record for "${deleteTarget?.query}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr(lang, "cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}>
              {tr(lang, "delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
