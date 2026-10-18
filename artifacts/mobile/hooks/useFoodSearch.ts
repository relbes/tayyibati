import { useState, useEffect, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { analyzeText, analyzeDish, analyzeBarcode, fetchAutocomplete, AnalysisError } from "@/lib/api";

export interface AutocompleteSuggestion {
  labelAr: string;
  labelEn?: string;
  query: string;
  entityType?: "food" | "dish" | "product" | string;
  canonicalId?: number | string;
  sectionHeader?: string;
  source?: string;
}

export interface UseFoodSearchOptions {
  onDefinitiveResult?: (report: any) => void;
}

export function useFoodSearch(options?: UseFoodSearchOptions) {
  const router = useRouter();
  const { user, refreshUsage } = useAuth();
  const { setCurrentReport, isAnalyzing, setIsAnalyzing } = useAnalysis();

  const onDefinitiveResultRef = useRef(options?.onDefinitiveResult);
  useEffect(() => {
    onDefinitiveResultRef.current = options?.onDefinitiveResult;
  }, [options?.onDefinitiveResult]);

  // The raw text the user typed — never overwritten by selection
  const [query, setQuery] = useState("");

  // The analysis result (null = no result yet, or cleared)
  const [result, setResult] = useState<any>(null);

  // Autocomplete dropdown
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  // Limit / Auth
  const [limitReached, setLimitReached] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const latestQueryRef = useRef("");

  // ─── Autocomplete (debounced, cancellable) ────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
      activeControllerRef.current = null;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsFetchingSuggestions(false);
      return;
    }

    latestQueryRef.current = trimmed;

    debounceRef.current = setTimeout(async () => {
      setIsFetchingSuggestions(true);
      const controller = new AbortController();
      activeControllerRef.current = controller;

      try {
        const response = await fetchAutocomplete(trimmed, controller.signal);
        if (latestQueryRef.current === trimmed) {
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.log("[SEARCH UI]", {
              query: trimmed,
              queryIntent: response.queryIntent,
              foods: response.displayFoods?.map((x: any) => ({
                id: x.canonicalId,
                nameAr: x.canonicalName,
                entityType: x.canonicalEntityType || "food",
              })),
              dishes: response.displayDishes?.map((x: any) => ({
                id: x.canonicalId,
                nameAr: x.canonicalName,
                entityType: x.canonicalEntityType || "dish",
              })),
            });
          }

          let finalSuggestions: AutocompleteSuggestion[] = [];

          // STRICT QUERY INTENT DISPLAY POLICY
          if (response.queryIntent === "FOOD" || (response.displayFoods && response.displayFoods.length > 0)) {
            // FOOD intent: render ONLY food entities! Completely ignore dishes to prevent dish flooding.
            finalSuggestions = (response.displayFoods || []).map((f: any, idx: number) => ({
              labelAr: f.canonicalName,
              labelEn: f.canonicalName,
              query: f.canonicalName,
              entityType: "food",
              canonicalId: f.canonicalId,
              sectionHeader: idx === 0 ? "الأطعمة" : undefined,
            }));
          } else if (response.queryIntent === "DISH") {
            finalSuggestions = (response.displayDishes || []).map((d: any, idx: number) => ({
              labelAr: d.canonicalName,
              labelEn: d.canonicalName,
              query: d.canonicalName,
              entityType: "dish",
              canonicalId: d.canonicalId,
              sectionHeader: idx === 0 ? "الأطباق" : undefined,
            }));
          } else {
            finalSuggestions = response.suggestions ?? [];
          }

          setSuggestions(finalSuggestions);
          setShowSuggestions(finalSuggestions.length > 0);
        }
      } catch (err: any) {
        if (err.name !== "AbortError" && latestQueryRef.current === trimmed) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (latestQueryRef.current === trimmed) {
          setIsFetchingSuggestions(false);
          activeControllerRef.current = null;
        }
      }
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (activeControllerRef.current) activeControllerRef.current.abort();
    };
  }, [query]);

  // ─── Internal: shared analysis runner ────────────────────────────────────
  const _runAnalysis = useCallback(
    async (run: () => Promise<any>, label = "unknown") => {
      if (!user) {
        console.warn("[AUTH] _runAnalysis aborted — no user (auth modal will show)");
        setAuthModalVisible(true);
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }

      setShowSuggestions(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsAnalyzing(true);
      setResult(null);
      setLimitReached(false);

      try {
        const report = await run();
        setResult(report);
        setCurrentReport(report);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Always refresh usage counters immediately after a search completes
        refreshUsage().catch(() => {});

        // Category Browsing Intent: Route directly to the existing category/catalog screen
        if (
          report?.action?.type === "NAVIGATE_BROWSE" &&
          (report.action.category || report.queryIntent === "CATEGORY_SEARCH" || report.resultMode === "CATEGORY_REPORT")
        ) {
          const targetRoute =
            report.action.route ||
            `/(tabs)/browse?category=${encodeURIComponent(report.action.category || "خضروات")}`;
          router.push(targetRoute as any);
          return;
        }

        const isAmbiguous =
          !report ||
          report.notFound === true ||
          report.resultMode === "MULTIPLE_DISHES" ||
          report.resultMode === "LIST_ALLOWED" ||
          report.resultMode === "LIST_RESTRICTED" ||
          report.resultMode === "CATEGORY_REPORT" ||
          report.queryIntent === "CATEGORY_SEARCH" ||
          report.requiresSelection ||
          report.needsClarification;

        if (!isAmbiguous && onDefinitiveResultRef.current) {
          onDefinitiveResultRef.current(report);
        }
      } catch (err: unknown) {
        // Always refresh usage counters when a limit error or any analysis error occurs
        refreshUsage().catch(() => {});

        if (err instanceof AnalysisError && err.limitReached) {
          setLimitReached(true);
        } else {
          console.error("[TRACE ERROR] _runAnalysis threw:", err);
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.error("[useFoodSearch Error]", err);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } finally {
        setIsAnalyzing(false);
      }
    },
    [user, refreshUsage, setCurrentReport, setIsAnalyzing, router]
  );

  // ─── RULE 1 & 3: Text search (user presses Search button) ────────────────
  const handleAnalyze = useCallback(
    async (overrideText?: string) => {
      const text = (typeof overrideText === "string" ? overrideText : query).trim();
      if (!text || isAnalyzing) return;
      const cleanedDigits = text.replace(/[-\s]/g, "");
      if (/^\d{6}$|^\d{8}$|^\d{12,14}$/.test(cleanedDigits)) {
        if (!user?.isPremium) {
          Alert.alert(
            "ميزة خاصة بالباقة المميزة",
            "فحص وتحليل الباركود متاح حصرياً لمشتركي الباقة المميزة.\nقم بالترقية للوصول إلى فحص وقراءة المنتجات التجارية.",
            [
              { text: "لاحقاً", style: "cancel" },
              { text: "ترقية الحساب", onPress: () => router.push("/pricing") },
            ]
          );
          return;
        }
        await _runAnalysis(() => analyzeBarcode(cleanedDigits), `analyzeBarcode("${cleanedDigits}")`);
      } else {
        await _runAnalysis(() => analyzeText(text), `analyzeText("${text}")`);
      }
    },
    [query, isAnalyzing, user, router, _runAnalysis]
  );

  // ─── RULE 2 & 4: Direct dish selection → analyze by canonical ID ──────────
  const handleSelectDish = useCallback(
    async (dish: any) => {
      const dishId: number | undefined =
        typeof dish === "number"
          ? dish
          : typeof dish === "object" && (dish?.id || dish?.canonicalId)
          ? Number(dish.id || dish.canonicalId)
          : undefined;

      const variantName: string =
        typeof dish === "object"
          ? (dish?.nameAr || dish?.canonicalName || dish?.name || "")
          : typeof dish === "string"
          ? dish
          : "";

      if (!dishId || isNaN(dishId)) {
        const nameAr = variantName || (typeof dish === "string" ? dish : dish?.nameAr ?? "");
        console.warn("[TRACE FALLBACK] No dishId — falling back to analyzeText:", nameAr);
        if (!nameAr) return;
        await _runAnalysis(() => analyzeText(nameAr), `fallback("${nameAr}")`);
        return;
      }

      await _runAnalysis(() => analyzeDish(dishId, variantName), `analyzeDish(${dishId}, "${variantName}")`);
    },
    [_runAnalysis]
  );

  // ─── Autocomplete suggestion tap: fill textbox + analyze canonical entity ──
  const handleSelectSuggestion = useCallback(
    (sug: AutocompleteSuggestion) => {
      const canonicalText = sug.query || sug.labelAr;
      const displayTitle = sug.labelAr || canonicalText;
      setQuery(displayTitle);
      setShowSuggestions(false);
      if (sug.entityType === "dish" && sug.canonicalId) {
        _runAnalysis(() => analyzeDish(Number(sug.canonicalId)), `analyzeDish(${sug.canonicalId})`);
      } else {
        _runAnalysis(
          () =>
            analyzeText({
              query: canonicalText,
              displayQuery: displayTitle,
              entityType: sug.entityType || "food",
              canonicalId: sug.canonicalId,
            }),
          `analyzeText("${canonicalText}", entity=${sug.entityType})`
        );
      }
    },
    [_runAnalysis]
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setResult(null);
    setLimitReached(false);
  }, []);

  return {
    query,
    setQuery,
    result,
    setResult,
    suggestions,
    setSuggestions,
    showSuggestions,
    setShowSuggestions,
    isFetchingSuggestions,
    limitReached,
    setLimitReached,
    authModalVisible,
    setAuthModalVisible,
    isAnalyzing,
    handleAnalyze,
    handleSelectDish,
    handleSelectSuggestion,
    clearSearch,
  };
}
