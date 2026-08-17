import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { fetchCatalog, NetworkError } from "@/lib/api";
import { getCachedCatalog, setCachedCatalog, CatalogFoodItem } from "@/lib/catalogCache";
import { useAuth } from "@/context/AuthContext";
import { AuthRequiredDialog } from "@/components/AuthRequiredDialog";
import { isRTL } from "@/lib/i18n";

interface DisplayCategoryGroup {
  categoryKey: string;
  nameAr: string;
  foods: CatalogFoodItem[];
}

const FoodRow = React.memo(({ food, isLast, colors, rtl }: { food: CatalogFoodItem; isLast: boolean; colors: any; rtl: boolean }) => {
  const badge = useMemo(() => {
    switch (food.status) {
      case "allowed":
        return {
          bg: "#E6F4EA",
          border: "#34A853",
          text: "#137333",
          label: rtl ? "مسموح" : "Allowed",
        };
      case "forbidden":
        return {
          bg: "#FCE8E6",
          border: "#EA4335",
          text: "#C5221F",
          label: rtl ? "ممنوع" : "Forbidden",
        };
      case "conditional":
        return {
          bg: "#FEF7E0",
          border: "#FBBC04",
          text: "#B06000",
          label: rtl ? "مشروط" : "Conditional",
        };
      default:
        return {
          bg: colors.muted,
          border: colors.border,
          text: colors.mutedForeground,
          label: food.status,
        };
    }
  }, [food.status, colors, rtl]);

  return (
    <View
      style={[
        styles.tableRow,
        { flexDirection: rtl ? "row-reverse" : "row" },
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[styles.foodNameText, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
        {food.nameAr}
      </Text>

      <View style={styles.statusCol}>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Text style={[styles.statusBadgeText, { color: badge.text }]}>
            {badge.label}
          </Text>
        </View>
      </View>
    </View>
  );
});

export default function BrowseScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const userId = user?.id || "guest";
  const [foods, setFoods] = useState<CatalogFoodItem[]>([]);
  const [isPremium, setIsPremium] = useState<boolean>(true);
  const [catalogVersion, setCatalogVersion] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  // Premium Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const rtl = isRTL();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  // Step A & Step B: Read Cache First (0ms), then Sync in Background
  useEffect(() => {
    let isMounted = true;

    async function syncCatalog() {
      // 1. Read AsyncStorage cache immediately
      const cached = await getCachedCatalog(userId);
      if (cached && isMounted) {
        setFoods(cached.foods || []);
        setIsPremium(cached.isPremium);
        setCatalogVersion(cached.version);
        setLoading(false);
      }

      // 2. Perform background sync with ETag / version check
      try {
        const res = await fetchCatalog(cached?.version);
        if (!isMounted) return;

        if (res.status === 200 && res.foods && res.version) {
          setFoods(res.foods);
          setIsPremium(Boolean(res.isPremium));
          setCatalogVersion(res.version);
          setLoading(false);
          setError(null);
          // Persist fresh catalog to AsyncStorage
          await setCachedCatalog(userId, res.version, Boolean(res.isPremium), res.foods);
        } else if (res.status === 304) {
          // Cache is up to date!
          setLoading(false);
          setError(null);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setLoading(false);
        if (err?.message === "UNAUTHENTICATED") {
          setAuthModalVisible(true);
        } else if (!cached || cached.foods.length === 0) {
          // Only show error if there is NO valid cache available
          if (err instanceof NetworkError || err?.isNetworkError) {
            setError(err.message);
          } else {
            setError(rtl ? "فشل في تحميل قائمة الأغذية." : "Failed to load foods list.");
          }
        }
      }
    }

    syncCatalog();

    return () => {
      isMounted = false;
    };
  }, [userId, rtl]);

  // Derived Category Options for Filter Chips
  const categoryOptions = useMemo(() => {
    const categoriesSet = new Set<string>();
    for (const f of foods) {
      if (f.category) categoriesSet.add(f.category);
    }
    return Array.from(categoriesSet).map((catKey) => ({
      key: catKey,
      label: catKey,
    }));
  }, [foods]);

  // Client-Side Instant Local Filtering & Grouping
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // 1. Filter foods array
    const matchingFoods = foods.filter((food) => {
      // Category filter
      if (selectedCategory !== "all" && food.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "all" && food.status !== selectedStatus) {
        return false;
      }
      // Search query filter (Arabic name)
      if (q.length > 0) {
        const normAr = (food.nameAr || "").toLowerCase();
        if (!normAr.includes(q)) {
          return false;
        }
      }
      return true;
    });

    // 2. Group into categories
    const groupsMap = new Map<string, CatalogFoodItem[]>();
    for (const food of matchingFoods) {
      const cat = food.category || "أخرى";
      if (!groupsMap.has(cat)) groupsMap.set(cat, []);
      groupsMap.get(cat)!.push(food);
    }

    const groups: DisplayCategoryGroup[] = [];
    for (const [catKey, groupFoods] of groupsMap.entries()) {
      groups.push({
        categoryKey: catKey,
        nameAr: catKey,
        foods: groupFoods,
      });
    }

    return groups;
  }, [foods, searchQuery, selectedCategory, selectedStatus]);

  const hasActiveFilters = searchQuery !== "" || selectedCategory !== "all" || selectedStatus !== "all";

  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedStatus("all");
  }, []);

  const renderCategoryBlock = useCallback(
    ({ item }: { item: DisplayCategoryGroup }) => {
      return (
        <View style={styles.categoryBlock}>
          <View style={[styles.categoryHeader, { flexDirection: rtl ? "row-reverse" : "row" }]}>
            <View style={[styles.categoryIndicator, { backgroundColor: colors.primary }]} />
            <Text style={[styles.categoryTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {item.nameAr}
            </Text>
          </View>

          <View style={[styles.tableContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.tableHeaderRow, { backgroundColor: colors.muted, flexDirection: rtl ? "row-reverse" : "row" }]}>
              <Text style={[styles.tableHeaderColName, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left" }]}>
                {rtl ? "الصنف" : "Food Item"}
              </Text>
              <Text style={[styles.tableHeaderColStatus, { color: colors.mutedForeground, textAlign: "center" }]}>
                {rtl ? "الحكم" : "Ruling"}
              </Text>
            </View>

            {item.foods.map((food, fIdx) => (
              <FoodRow
                key={food.id}
                food={food}
                isLast={fIdx === item.foods.length - 1}
                colors={colors}
                rtl={rtl}
              />
            ))}
          </View>
        </View>
      );
    },
    [colors, rtl]
  );

  const renderListHeader = useMemo(() => {
    return (
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.titleRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.muted }]}
          >
            <View>
              <Icon name={rtl ? "arrow-forward" : "arrow-back"} size={20} color={colors.foreground} />
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: rtl ? "flex-end" : "flex-start" }}>
            <Text style={[styles.pageTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl ? "قائمة المسموح والممنوع" : "Allowed & Forbidden List"}
            </Text>
            <Text style={[styles.pageSubtitle, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left" }]}>
              {rtl
                ? "تصفح قائمة الأغذية المسموحة والممنوعة والمشروطة في نظام الطيبات"
                : "Browse allowed, forbidden, and conditional foods in Tayyibati system"}
            </Text>
          </View>
        </View>

        {/* Premium Filter Section */}
        {isPremium && (
          <View style={styles.filterSection}>
            {/* Search Box */}
            <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border, flexDirection: rtl ? "row-reverse" : "row" }]}>
              <Icon name="search" size={20} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}
                placeholder={rtl ? "ابحث عن طعام..." : "Search food..."}
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Icon name="close-circle" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>

            {/* Status Filter Chips */}
            <View style={styles.filterRowBlock}>
              <Text style={[styles.filterLabel, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left" }]}>
                {rtl ? "الحكم:" : "Ruling:"}
              </Text>
              <View style={[styles.chipsContainer, { flexDirection: rtl ? "row-reverse" : "row" }]}>
                {[
                  { id: "all", label: rtl ? "الكل" : "All", color: colors.primary },
                  { id: "allowed", label: rtl ? "مسموح" : "Allowed", color: "#34A853" },
                  { id: "forbidden", label: rtl ? "ممنوع" : "Forbidden", color: "#EA4335" },
                  { id: "conditional", label: rtl ? "مشروط" : "Conditional", color: "#FBBC04" },
                ].map((chip) => {
                  const isActive = selectedStatus === chip.id;
                  return (
                    <TouchableOpacity
                      key={chip.id}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isActive ? chip.color : colors.background,
                          borderColor: isActive ? chip.color : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedStatus(chip.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isActive ? "#FFFFFF" : colors.foreground, fontWeight: isActive ? "700" : "400" },
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Category Filter Chips */}
            <View style={styles.filterRowBlock}>
              <Text style={[styles.filterLabel, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left" }]}>
                {rtl ? "التصنيف:" : "Category:"}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, flexDirection: rtl ? "row-reverse" : "row" }}
              >
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedCategory === "all" ? colors.primary : colors.background,
                      borderColor: selectedCategory === "all" ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedCategory("all")}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selectedCategory === "all" ? "#FFFFFF" : colors.foreground },
                    ]}
                  >
                    {rtl ? "الكل" : "All"}
                  </Text>
                </TouchableOpacity>

                {categoryOptions.map((cat) => {
                  const isActive = selectedCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isActive ? colors.primary : colors.background,
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedCategory(cat.key)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isActive ? "#FFFFFF" : colors.foreground },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Active Filter Clear Button */}
            {hasActiveFilters && (
              <TouchableOpacity
                style={[styles.resetBtn, { flexDirection: rtl ? "row-reverse" : "row" }]}
                onPress={handleResetFilters}
              >
                <Icon name="refresh" size={14} color={colors.primary} />
                <Text style={[styles.resetBtnText, { color: colors.primary }]}>
                  {rtl ? "مسح الفلاتر" : "Clear filters"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }, [
    colors,
    rtl,
    topPadding,
    router,
    isPremium,
    searchQuery,
    selectedStatus,
    selectedCategory,
    categoryOptions,
    hasActiveFilters,
    handleResetFilters,
  ]);

  const renderListFooter = useMemo(() => {
    if (!isPremium) {
      return (
        <View style={[styles.ctaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.ctaIconWrap}>
            <Icon name="star" size={28} color="#B06000" />
          </View>
          <Text style={[styles.ctaTitle, { color: colors.foreground }]}>
            {rtl ? "استعرض قائمة المسموح والممنوع كاملة" : "Explore Complete Allowed & Forbidden List"}
          </Text>
          <Text style={[styles.ctaSubtitle, { color: colors.mutedForeground }]}>
            {rtl
              ? "اشترك في Premium للوصول إلى جميع التصنيفات والأغذية في القائمة."
              : "Subscribe to Premium to access all categories and foods in the list."}
          </Text>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
            onPress={() => router.push("/pricing")}
          >
            <Text style={styles.ctaButtonText}>
              {rtl ? "الترقية إلى Premium" : "Upgrade to Premium"}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (filteredCategories.length === 0 && !loading && !error) {
      return (
        <View style={styles.noResultsBox}>
          <Icon name="search-outline" size={44} color={colors.mutedForeground} />
          <Text style={[styles.noResultsText, { color: colors.foreground }]}>
            {rtl ? "لا توجد أصناف مطابقة." : "No matching foods found."}
          </Text>
          <TouchableOpacity
            style={[styles.resetBtnInline, { backgroundColor: colors.primary }]}
            onPress={handleResetFilters}
          >
            <Text style={styles.resetBtnInlineText}>
              {rtl ? "مسح الفلاتر" : "Clear filters"}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  }, [isPremium, colors, rtl, router, filteredCategories.length, loading, error, handleResetFilters]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && foods.length === 0 ? (
        <View style={{ flex: 1 }}>
          {renderListHeader}
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </View>
      ) : error && foods.length === 0 ? (
        <View style={{ flex: 1 }}>
          {renderListHeader}
          <View style={styles.errorBox}>
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => item.categoryKey}
          renderItem={renderCategoryBlock}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={renderListFooter}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
        />
      )}

      {/* Auth modal when unauthenticated */}
      <AuthRequiredDialog
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  titleRow: {
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
  },
  pageSubtitle: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    marginTop: 2,
  },
  filterSection: {
    marginTop: 14,
    gap: 10,
  },
  searchBox: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
  },
  filterRowBlock: {
    gap: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
  },
  chipsContainer: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
  },
  resetBtn: {
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 4,
    marginTop: 2,
  },
  resetBtnText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
  loaderBox: {
    paddingVertical: 40,
    alignItems: "center",
  },
  errorBox: {
    padding: 24,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
  },
  categoryBlock: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  categoryHeader: {
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  categoryIndicator: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  categoryTitle: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
  },
  tableContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  tableHeaderRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  tableHeaderColName: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
  },
  tableHeaderColStatus: {
    width: 84,
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
  },
  tableRow: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: "center",
  },
  foodNameText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Tajawal_500Medium",
  },
  statusCol: {
    width: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 70,
    alignItems: "center",
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  noResultsBox: {
    padding: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  noResultsText: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  resetBtnInline: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    marginTop: 4,
  },
  resetBtnInlineText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
  },
  ctaCard: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    marginTop: 20,
  },
  ctaIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEF7E0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  ctaTitle: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    marginBottom: 6,
    textAlign: "center",
  },
  ctaSubtitle: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
  },
  ctaButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  ctaButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
  },
});
