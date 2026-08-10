import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CATEGORY_TAXONOMY,
  getCanonicalCategory,
  getCategoryLabel,
  CategoryOption,
} from "@/lib/categories";
import { cn } from "@/lib/utils";

interface CategorySelectProps {
  value?: string;
  onChange: (value: string) => void;
  lang?: "ar" | "en";
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  allowAll?: boolean;
  allLabel?: string;
}

export function CategorySelect({
  value,
  onChange,
  lang = "ar",
  placeholder,
  id,
  disabled = false,
  className,
  allowAll = false,
  allLabel,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const canonicalVal = getCanonicalCategory(value);

  const searchPlaceholder =
    lang === "ar" ? "ابحث عن تصنيف..." : "Search categories...";
  const emptyText =
    lang === "ar" ? "لا توجد تصنيفات مطابقة" : "No matching categories";
  const defaultPlaceholder =
    placeholder || (lang === "ar" ? "اختر تصنيفاً" : "Select category");
  const defaultAllLabel =
    allLabel || (lang === "ar" ? "جميع التصنيفات" : "All Categories");

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm("");
    }
  }, [open]);

  const filteredCategories = CATEGORY_TAXONOMY.filter((item) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      item.ar.toLowerCase().includes(q) ||
      item.en.toLowerCase().includes(q) ||
      item.canonical.toLowerCase().includes(q)
    );
  });

  const selectedLabel = canonicalVal
    ? getCategoryLabel(canonicalVal, lang)
    : allowAll
    ? defaultAllLabel
    : defaultPlaceholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-start bg-background",
            !canonicalVal && !allowAll && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 z-50 shadow-md max-h-[320px] flex flex-col"
        align="start"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <div className="flex items-center border-b px-3 py-2 shrink-0">
          <Search className="me-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={inputRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-full border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {searchTerm && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-transparent"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="overflow-y-auto p-1 max-h-[240px]">
          {allowAll && (
            <div
              key="all-categories"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={cn(
                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                !canonicalVal && "bg-accent text-accent-foreground font-medium"
              )}
            >
              <Check
                className={cn(
                  "me-2 h-4 w-4",
                  !canonicalVal ? "opacity-100" : "opacity-0"
                )}
              />
              <span>{defaultAllLabel}</span>
            </div>
          )}
          {filteredCategories.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            filteredCategories.map((cat) => {
              const isSelected = canonicalVal === cat.canonical;
              const displayLabel = lang === "ar" ? cat.ar : cat.en;
              return (
                <div
                  key={cat.canonical}
                  onClick={() => {
                    onChange(cat.canonical);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent text-accent-foreground font-medium"
                  )}
                >
                  <Check
                    className={cn(
                      "me-2 h-4 w-4",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{displayLabel}</span>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
