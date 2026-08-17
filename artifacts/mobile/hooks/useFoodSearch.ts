import { useState, useEffect, useRef, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { analyzeText, analyzeDish, fetchAutocomplete, AnalysisError } from "@/lib/api";

export interface AutocompleteSuggestion {
  labelAr: string;
  labelEn?: string;
  query: string;
  entityType?: "food" | "dish" | "product" | string;
  canonicalId?: number | string;
  sectionHeader?: string;
  source?: string;
}

export function useFoodSearch() {
  const { user, refreshUsage } = useAuth();
  const { setCurrentReport, isAnalyzing, setIsAnalyzing } = useAnalysis();

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
      } catch (err: unknown) {
        console.error("[TRACE ERROR] _runAnalysis threw:", err);
        if (err instanceof AnalysisError && err.limitReached) {
          setLimitReached(true);
        } else {
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.error("[useFoodSearch Error]", err);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } finally {
        setIsAnalyzing(false);
      }
    },
    [user, setCurrentReport, setIsAnalyzing]
  );

  // ─── RULE 1 & 3: Text search (user presses Search button) ────────────────
  const handleAnalyze = useCallback(
    async (overrideText?: string) => {
      const text = (typeof overrideText === "string" ? overrideText : query).trim();
      if (!text || isAnalyzing) return;
      await _runAnalysis(() => analyzeText(text), `analyzeText("${text}")`);
    },
    [query, isAnalyzing, _runAnalysis]
  );

  // ─── RULE 2 & 4: Direct dish selection → analyze by canonical ID ──────────
  const handleSelectDish = useCallback(
    async (dish: any) => {
      const dishId: number | undefined =
        typeof dish === "number" ? dish : typeof dish === "object" && dish?.id ? Number(dish.id) : undefined;

      if (!dishId || isNaN(dishId)) {
        const nameAr = typeof dish === "string" ? dish : dish?.nameAr ?? "";
        console.warn("[TRACE FALLBACK] No dishId — falling back to analyzeText:", nameAr);
        if (!nameAr) return;
        await _runAnalysis(() => analyzeText(nameAr), `fallback("${nameAr}")`);
        return;
      }

      await _runAnalysis(() => analyzeDish(dishId), `analyzeDish(${dishId})`);
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
