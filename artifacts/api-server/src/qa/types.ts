export type TestCategory =
  | "EXACT_CANONICAL"
  | "NORMALIZED_EXACT"
  | "SYNONYMS_DIALECTS"
  | "SPECIFIC_VARIANTS"
  | "GENERIC_QUERIES"
  | "FALSE_POSITIVES"
  | "MULTI_WORD"
  | "ENGLISH"
  | "FUZZY_TYPOS";

export type ExpectedBehavior = "RESOLVE_DIRECT" | "SHOW_CHOICES" | "NOT_RESOLVE_TO";

export interface TestCase {
  id: string;
  category: TestCategory;
  query: string;
  expectedBehavior: ExpectedBehavior;
  expectedEntityId?: number | string;
  expectedEntityName?: string;
  expectedEntityType?: "food" | "dish" | "product";
  allowedAlternatives?: (number | string)[];
  forbiddenEntities?: (number | string)[]; // E.g. IDs or names that MUST NOT be primary result
  notes?: string;
  isMandatory?: boolean;
}

export type FailureCategory =
  | "EXACT_MATCH_OVERRIDDEN"
  | "FALSE_POSITIVE_VARIANT"
  | "GENERIC_QUERY_NOT_AMBIGUOUS"
  | "SPECIFIC_QUERY_MADE_AMBIGUOUS"
  | "WRONG_ENTITY_RESOLVED"
  | "UNRESOLVED_VALID_QUERY"
  | "UNKNOWN_FAILURE";

export interface TestEvaluation {
  testId: string;
  category: TestCategory;
  query: string;
  passed: boolean;
  expectedBehavior: ExpectedBehavior;
  expectedEntity?: string;
  actualEntity?: string;
  actualEntityType?: string;
  actualEntityId?: number | string;
  matchType?: string;
  searchMethod?: string;
  confidence?: number;
  isAmbiguous?: boolean;
  choicesCount?: number;
  choices?: string[];
  failureCategory?: FailureCategory;
  failureReason?: string;
}

export interface QARunSummary {
  timestamp: string;
  mode: "BASELINE" | "AFTER_FIX";
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  byCategory: Record<TestCategory, { total: number; passed: number; failed: number; passRate: number }>;
  byFailureCategory: Record<FailureCategory, number>;
  topProblematicQueries: {
    query: string;
    expected: string;
    actual: string;
    failureCategory: FailureCategory;
    reason: string;
  }[];
}

export interface QARegressionComparison {
  timestamp: string;
  baseline: { total: number; passed: number; failed: number; passRate: number };
  afterFix: { total: number; passed: number; failed: number; passRate: number };
  persistedPassCount: number;
  fixedCount: number;
  regressionCount: number; // Tests that passed in baseline but now fail
  persistedFailureCount: number;
  regressions: {
    query: string;
    category: TestCategory;
    baselineEntity: string;
    afterEntity: string;
    reason: string;
  }[];
  newlyFixed: {
    query: string;
    category: TestCategory;
    previousActual: string;
    nowResolved: string;
  }[];
}
