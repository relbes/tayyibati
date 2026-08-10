import { useState, useEffect, useRef, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { analyzeText, analyzeDish, fetchAutocomplete, AnalysisError } from "@/lib/api";

export interface AutocompleteSuggestion {
  labelAr: string;
  labelEn: string;
  query: string;
  source: "DB_ENTITY" | "DB_ALIAS" | "DB_VARIANT";
}

export function useFoodSearch() {
  const { user } = useAuth();
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
          setSuggestions(response.suggestions ?? []);
          setShowSuggestions((response.suggestions?.length ?? 0) > 0);
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
  // The query textbox is NEVER modified. No text search is performed.
  const handleSelectDish = useCallback(
    async (dish: any) => {


      const dishId: number | undefined =
        typeof dish === "number" ? dish : typeof dish === "object" && dish?.id ? Number(dish.id) : undefined;



      if (!dishId || isNaN(dishId)) {
        // Fallback: dish was a plain string — should not happen with the new architecture
        const nameAr = typeof dish === "string" ? dish : dish?.nameAr ?? "";
        console.warn("[TRACE FALLBACK] No dishId — falling back to analyzeText:", nameAr);
        if (!nameAr) return;
        await _runAnalysis(() => analyzeText(nameAr), `fallback("${nameAr}")`);
        return;
      }

      // Direct canonical dish analysis — no text search, no query overwrite
      await _runAnalysis(() => analyzeDish(dishId), `analyzeDish(${dishId})`);
    },
    [_runAnalysis]
  );

  // ─── Autocomplete suggestion tap: fill textbox + immediately analyze ───────
  // The suggestion provides the exact canonical query text, so we set the
  // textbox to that canonical form and analyze it once.
  const handleSelectSuggestion = useCallback(
    (sug: AutocompleteSuggestion) => {
      const canonicalText = sug.query || sug.labelAr;
      setQuery(canonicalText);          // update textbox to show canonical name
      setShowSuggestions(false);
      // Analyze the canonical text (one text search, no second search needed)
      _runAnalysis(() => analyzeText(canonicalText));
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
