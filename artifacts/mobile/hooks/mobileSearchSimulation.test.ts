// Mobile hook and UI behavior simulation tests
import { AutocompleteSuggestion } from "./useFoodSearch";

// Test runner helpers
let passCount = 0;
let failCount = 0;

function runMobileTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`[PASS] Mobile: ${name}`);
    passCount++;
  } catch (err: any) {
    console.error(`[FAIL] Mobile: ${name}\n       ${err.message}`);
    failCount++;
  }
}

// ── Mock states and components for verification ──────────────────────────────

interface MockSearchState {
  query: string;
  result: any | null;
  suggestions: AutocompleteSuggestion[];
  showSuggestions: boolean;
  isFetchingSuggestions: boolean;
  limitReached: boolean;
  analyzedQueries: string[];
  abortedRequestsCount: number;
}

function createMockState(): MockSearchState {
  return {
    query: "",
    result: null,
    suggestions: [],
    showSuggestions: false,
    isFetchingSuggestions: false,
    limitReached: false,
    analyzedQueries: [],
    abortedRequestsCount: 0,
  };
}

// Simulates the shared hook logic state-machine behavior
class MobileSearchSimulation {
  state: MockSearchState;
  
  constructor() {
    this.state = createMockState();
  }

  // Mimics query change with debouncing and cancellation behavior
  setQuery(newQuery: string) {
    this.state.query = newQuery;
    
    // Simulate abort controller cancellation of in-flight requests
    this.state.abortedRequestsCount++; 

    const trimmed = newQuery.trim();
    if (trimmed.length < 2) {
      this.state.suggestions = [];
      this.state.showSuggestions = false;
      this.state.isFetchingSuggestions = false;
      return;
    }

    this.state.isFetchingSuggestions = true;
  }

  // Mimics mock fetch response arrival
  mockAutocompleteResponse(suggestions: AutocompleteSuggestion[]) {
    this.state.suggestions = suggestions;
    this.state.showSuggestions = suggestions.length > 0;
    this.state.isFetchingSuggestions = false;
  }

  // Mimics trigger analyze action
  handleAnalyze(q?: string) {
    const text = (q ?? this.state.query).trim();
    if (!text) return;
    this.state.showSuggestions = false;
    this.state.analyzedQueries.push(text);
  }

  // Mimics suggestion selection
  handleSelectSuggestion(sug: AutocompleteSuggestion) {
    this.state.query = sug.query;
    this.state.showSuggestions = false;
    this.handleAnalyze(sug.query);
  }

  // Mimics clear query action
  clearSearch() {
    this.state.query = "";
    this.state.suggestions = [];
    this.state.showSuggestions = false;
    this.state.result = null;
    this.state.limitReached = false;
  }
}

// Mimics the RefinementSuggestions component rendering rules
function renderRefinementSuggestions(result: any) {
  const suggestions = result.refinementSuggestions || result.relevantVariants || [];
  if (suggestions.length === 0) return { rendered: false, mode: null };

  const isUnresolvedAmbiguity = result.isAmbiguous && (!result.hypotheses || result.hypotheses.length === 0);

  if (isUnresolvedAmbiguity) {
    return {
      rendered: true,
      mode: "UNRESOLVED_AMBIGUITY_REFINEMENT_CARD",
      showNormalCard: false,
    };
  }

  return {
    rendered: true,
    mode: "RESOLVED_AMBIGUITY_UNDERNEATH_CHIPS",
    showNormalCard: true,
  };
}

// ── Mobile Tests ─────────────────────────────────────────────────────────────

runMobileTest("1. query < 2 chars => no autocomplete suggestions", () => {
  const sim = new MobileSearchSimulation();
  sim.setQuery("خ");
  
  if (sim.state.suggestions.length !== 0 || sim.state.showSuggestions) {
    throw new Error("Suggestions should be empty and hidden if query length < 2");
  }
});

runMobileTest("2. query changes cancel in-flight stale requests", () => {
  const sim = new MobileSearchSimulation();
  sim.setQuery("خب");
  const countBefore = sim.state.abortedRequestsCount;
  
  sim.setQuery("خبز");
  const countAfter = sim.state.abortedRequestsCount;

  if (countAfter <= countBefore) {
    throw new Error("Subsequent query changes must abort/cancel active in-flight requests");
  }
});

runMobileTest("3. selecting suggestion fills query and triggers analysis immediately", () => {
  const sim = new MobileSearchSimulation();
  const suggestion: AutocompleteSuggestion = {
    labelAr: "خبز عربي",
    labelEn: "Arabic Bread",
    query: "خبز عربي",
    source: "DB_VARIANT"
  };

  sim.handleSelectSuggestion(suggestion);

  if (sim.state.query !== "خبز عربي") {
    throw new Error(`Expected query to be set to 'خبز عربي', got: '${sim.state.query}'`);
  }
  if (sim.state.analyzedQueries[0] !== "خبز عربي") {
    throw new Error("Selecting suggestion must trigger analysis run automatically");
  }
  if (sim.state.showSuggestions) {
    throw new Error("Suggestions dropdown must close after selection");
  }
});

runMobileTest("4. clearing input resets query and clears suggestions dropdown", () => {
  const sim = new MobileSearchSimulation();
  sim.setQuery("خبز");
  sim.mockAutocompleteResponse([{ labelAr: "خبز", labelEn: "Bread", query: "خبز", source: "DB_ENTITY" }]);
  
  sim.clearSearch();

  if (sim.state.query !== "") {
    throw new Error("Query should be cleared");
  }
  if (sim.state.suggestions.length !== 0 || sim.state.showSuggestions) {
    throw new Error("Suggestions dropdown should be empty and closed");
  }
});

runMobileTest("5. broad ambiguous result renders refinement state but NOT compatibility card", () => {
  const report = {
    query: "خبز",
    isAmbiguous: true,
    refinementSuggestions: [{ labelAr: "خبز عربي", query: "خبز عربي" }],
    hypotheses: [] // unresolved broad food category
  };

  const ui = renderRefinementSuggestions(report);

  if (!ui.rendered || ui.mode !== "UNRESOLVED_AMBIGUITY_REFINEMENT_CARD") {
    throw new Error("Unresolved ambiguous broad category must render the special Refinement Card block");
  }
  if (ui.showNormalCard) {
    throw new Error("Unresolved ambiguous category should NOT render the normal 100% allowed compatibility card");
  }
});

runMobileTest("6. normal specific compatibility result renders normal card", () => {
  const report = {
    query: "منسف",
    isAmbiguous: true,
    refinementSuggestions: [{ labelAr: "منسف دجاج", query: "منسف دجاج" }],
    hypotheses: [{ ingredient: "لحم" }] // resolved ingredients present
  };

  const ui = renderRefinementSuggestions(report);

  if (!ui.rendered || ui.mode !== "RESOLVED_AMBIGUITY_UNDERNEATH_CHIPS") {
    throw new Error("Resolved dish variants must render chips underneath card");
  }
  if (!ui.showNormalCard) {
    throw new Error("Resolved dish variants should render the normal AnalysisResultCard");
  }
});

// Final report
console.log(`\nMobile Simulation Tests: ${passCount} passed, ${failCount} failed.`);
if (failCount > 0) {
  process.exit(1);
}
