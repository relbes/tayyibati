import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { BackButton } from "@/components/BackButton";
import { PageHeader } from "@/components/PageHeader";
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

const FoodRow = React.memo(
  ({
    food,
    isLast,
    rtl,
  }: {
    food: CatalogFoodItem;
    isLast: boolean;
    colors: any;
    rtl: boolean;
  }) => {
    const badge = useMemo(() => {
      switch (food.status) {
        case "allowed":
          return {
            bg: "#DCFCE7",
            border: "#86EFAC",
            text: "#15803D",
            label: rtl ? "مسموح" : "Allowed",
          };
        case "forbidden":
          return {
            bg: "#FEE2E2",
            border: "#FECDD3",
            text: "#DC2626",
            label: rtl ? "ممنوع" : "Forbidden",
          };
        case "conditional":
          return {
            bg: "#FEF3C7",
            border: "#FDE68A",
            text: "#D97706",
            label: rtl ? "مشروط" : "Conditional",
          };
        default:
          return {
            bg: "#F3F4F6",
            border: "#E5E7EB",
            text: "#4B5563",
            label: food.status,
          };
      }
    }, [food.status, rtl]);

    return (
      <View
        style={[
          styles.tableRow,
          { flexDirection: rtl ? "row-reverse" : "row" },
          !isLast && styles.tableRowBorder,
        ]}
      >
        <Text
          style={[
            styles.foodNameText,
            { textAlign: rtl ? "right" : "left" },
          ]}
          numberOfLines={1}
        >
          {food.nameAr}
        </Text>

        <View style={styles.statusCol}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: badge.bg, borderColor: badge.border },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>
      </View>
    );
  }
);

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
  const categoryScrollRef = useRef<ScrollView>(null);

  const rtl = isRTL();
  const topPadding = Platform.OS === "web" ? 16 : Math.max(insets.top, 12);

  // Read Cache First (0ms), then Sync in Background
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
          // Cache is up to date
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
    const categoriesMap = new Map<string, string>();
    for (const f of foods) {
      const rawCat = f.category || "أخرى";
      const displayCat = f.categoryAr || f.category || "أخرى";
      if (!categoriesMap.has(rawCat)) {
        categoriesMap.set(rawCat, displayCat);
      }
    }
    return Array.from(categoriesMap.entries()).map(([rawKey, displayLabel]) => ({
      key: rawKey,
      label: displayLabel,
    }));
  }, [foods]);

  // Client-Side Instant Local Filtering & Grouping
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // 1. Filter foods array
    const matchingFoods = foods.filter((food) => {
      if (
        selectedCategory !== "all" &&
        food.category !== selectedCategory &&
        food.categoryAr !== selectedCategory
      ) {
        return false;
      }
      if (selectedStatus !== "all" && food.status !== selectedStatus) {
        return false;
      }
      if (q.length > 0) {
        const normAr = (food.nameAr || "").toLowerCase();
        if (!normAr.includes(q)) {
          return false;
        }
      }
      return true;
    });

    // 2. Group into categories with Arabic display titles
    const groupsMap = new Map<string, { displayAr: string; foods: CatalogFoodItem[] }>();
    for (const food of matchingFoods) {
      const rawCat = food.category || "أخرى";
      const displayAr = food.categoryAr || food.category || "أخرى";
      if (!groupsMap.has(rawCat)) {
        groupsMap.set(rawCat, { displayAr, foods: [] });
      }
      groupsMap.get(rawCat)!.foods.push(food);
    }

    const groups: DisplayCategoryGroup[] = [];
    for (const [catKey, groupData] of groupsMap.entries()) {
      groups.push({
        categoryKey: catKey,
        nameAr: groupData.displayAr,
        foods: groupData.foods,
      });
    }

    return groups;
  }, [foods, searchQuery, selectedCategory, selectedStatus]);

  const hasActiveFilters =
    searchQuery !== "" || selectedCategory !== "all" || selectedStatus !== "all";

  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedStatus("all");
  }, []);

  const renderCategoryBlock = useCallback(
    ({ item }: { item: DisplayCategoryGroup }) => {
      return (
        <View style={styles.categoryBlock}>
          {/* Main Tayyibati Category Card */}
          <View style={styles.tableContainer}>
            {/* Category Card Header */}
            <View
              style={[
                styles.categoryCardHeader,
                { flexDirection: rtl ? "row-reverse" : "row" },
              ]}
            >
              <View
                style={[
                  styles.categoryTitleBox,
                  { flexDirection: rtl ? "row-reverse" : "row" },
                ]}
              >
                <View style={styles.categoryIconCircle}>
                  <Icon name="leaf" size={16} color="#008C5A" />
                </View>
                <Text
                  style={[
                    styles.categoryTitle,
                    { textAlign: rtl ? "right" : "left" },
                  ]}
                >
                  {item.nameAr}
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {item.foods.length} {rtl ? "صنف" : "items"}
                </Text>
              </View>
            </View>

            {/* Sub-Header Row */}
            <View
              style={[
                styles.tableHeaderRow,
                { flexDirection: rtl ? "row-reverse" : "row" },
              ]}
            >
              <Text
                style={[
                  styles.tableHeaderColName,
                  { textAlign: rtl ? "right" : "left" },
                ]}
              >
                {rtl ? "الصنف" : "Food Item"}
              </Text>
              <Text
                style={[
                  styles.tableHeaderColStatus,
                  { textAlign: "center" },
                ]}
              >
                {rtl ? "الحكم" : "Ruling"}
              </Text>
            </View>

            {/* Food Rows */}
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
      <View style={styles.header}>
        {/* Unified Standard Botanical Header */}
        <PageHeader
          title={rtl ? "قائمة المسموح والممنوع" : "Allowed & Forbidden List"}
          subtitle={
            rtl
              ? "تصفح الأغذية المسموحة والممنوعة والمشروطة وفق نظام الطيبات"
              : "Browse allowed, forbidden, and conditional foods in Tayyibati system"
          }
          badgeType="browse"
        />

        {/* Premium Filter Section */}
        {isPremium && (
          <View style={[styles.filterSection, { paddingHorizontal: 16 }]}>
            {/* Search Input Box */}
            <View
              style={[
                styles.searchBox,
                { flexDirection: rtl ? "row-reverse" : "row" },
              ]}
            >
              <Icon name="search" size={20} color="#008C5A" strokeWidth={2.2} />
              <TextInput
                style={[
                  styles.searchInput,
                  { textAlign: rtl ? "right" : "left" },
                ]}
                placeholder={rtl ? "ابحث عن طعام أو صنف..." : "Search food..."}
                placeholderTextColor="#6B7280"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor="#16A34A"
              />
              {!!searchQuery && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Status Filter Chips */}
            <View style={styles.filterRowBlock}>
              <Text
                style={[
                  styles.filterLabel,
                  { textAlign: rtl ? "right" : "left" },
                ]}
              >
                {rtl ? "الحكم:" : "Ruling:"}
              </Text>
              <View
                style={[
                  styles.chipsContainer,
                  { flexDirection: rtl ? "row-reverse" : "row" },
                ]}
              >
                {[
                  {
                    id: "all",
                    label: rtl ? "الكل" : "All",
                    activeBg: "#16A34A",
                    activeText: "#FFFFFF",
                    inactiveBg: "#FFFFFF",
                    inactiveBorder: "#DCFCE7",
                    inactiveText: "#4B5563",
                  },
                  {
                    id: "allowed",
                    label: rtl ? "مسموح" : "Allowed",
                    activeBg: "#15803D",
                    activeText: "#FFFFFF",
                    inactiveBg: "#DCFCE7",
                    inactiveBorder: "#86EFAC",
                    inactiveText: "#15803D",
                  },
                  {
                    id: "forbidden",
                    label: rtl ? "ممنوع" : "Forbidden",
                    activeBg: "#DC2626",
                    activeText: "#FFFFFF",
                    inactiveBg: "#FEE2E2",
                    inactiveBorder: "#FECDD3",
                    inactiveText: "#DC2626",
                  },
                  {
                    id: "conditional",
                    label: rtl ? "مشروط" : "Conditional",
                    activeBg: "#D97706",
                    activeText: "#FFFFFF",
                    inactiveBg: "#FEF3C7",
                    inactiveBorder: "#FDE68A",
                    inactiveText: "#D97706",
                  },
                ].map((chip) => {
                  const isActive = selectedStatus === chip.id;
                  return (
                    <TouchableOpacity
                      key={chip.id}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isActive ? chip.activeBg : chip.inactiveBg,
                          borderColor: isActive ? chip.activeBg : chip.inactiveBorder,
                        },
                      ]}
                      onPress={() => setSelectedStatus(chip.id)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isActive ? chip.activeText : chip.inactiveText,
                            fontFamily: isActive ? "Tajawal_700Bold" : "Tajawal_500Medium",
                          },
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
              <View
                style={[
                  styles.filterHeaderRow,
                  { flexDirection: rtl ? "row-reverse" : "row" },
                ]}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    { textAlign: rtl ? "right" : "left" },
                  ]}
                >
                  {rtl ? "التصنيف:" : "Category:"}
                </Text>

                {/* Reset Filters CTA */}
                {hasActiveFilters && (
                  <TouchableOpacity
                    style={[
                      styles.resetBtn,
                      { flexDirection: rtl ? "row-reverse" : "row" },
                    ]}
                    onPress={handleResetFilters}
                    activeOpacity={0.7}
                  >
                    <Icon name="refresh" size={13} color="#008C5A" strokeWidth={2} />
                    <Text style={styles.resetBtnText}>
                      {rtl ? "مسح الفلاتر" : "Clear filters"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                ref={categoryScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  styles.categoryScrollContent,
                  { flexDirection: rtl ? "row-reverse" : "row", flexGrow: 1 },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedCategory === "all" ? "#16A34A" : "#FFFFFF",
                      borderColor: selectedCategory === "all" ? "#16A34A" : "#DCFCE7",
                    },
                  ]}
                  onPress={() => setSelectedCategory("all")}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: selectedCategory === "all" ? "#FFFFFF" : "#4B5563",
                        fontFamily: selectedCategory === "all" ? "Tajawal_700Bold" : "Tajawal_500Medium",
                      },
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
                          backgroundColor: isActive ? "#16A34A" : "#FFFFFF",
                          borderColor: isActive ? "#16A34A" : "#DCFCE7",
                        },
                      ]}
                      onPress={() => setSelectedCategory(cat.key)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isActive ? "#FFFFFF" : "#4B5563",
                            fontFamily: isActive ? "Tajawal_700Bold" : "Tajawal_500Medium",
                          },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    );
  }, [
    rtl,
    topPadding,
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
        <View style={styles.ctaCard}>
          <View style={styles.ctaIconWrap}>
            <Icon name="crown" size={26} color="#F59E0B" />
          </View>
          <Text style={styles.ctaTitle}>
            {rtl ? "استعرض قائمة المسموح والممنوع كاملة" : "Explore Complete Allowed & Forbidden List"}
          </Text>
          <Text style={styles.ctaSubtitle}>
            {rtl
              ? "اشترك في Premium للوصول إلى جميع التصنيفات والأغذية في القائمة."
              : "Subscribe to Premium to access all categories and foods in the list."}
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
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
          <View style={styles.noResultsIconWrap}>
            <Icon name="search" size={28} color="#008C5A" />
          </View>
          <Text style={styles.noResultsText}>
            {rtl ? "لا توجد أصناف مطابقة" : "No matching foods found"}
          </Text>
          <Text style={styles.noResultsSubtext}>
            {rtl
              ? "جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر للاطلاع على قائمة الأغذية."
              : "Try adjusting your search terms or reset filters to view foods."}
          </Text>
          <TouchableOpacity
            style={styles.resetBtnInline}
            onPress={handleResetFilters}
            activeOpacity={0.8}
          >
            <Text style={styles.resetBtnInlineText}>
              {rtl ? "إعادة ضبط الفلاتر" : "Reset filters"}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  }, [isPremium, rtl, router, filteredCategories.length, loading, error, handleResetFilters]);

  return (
    <View style={styles.container}>
      {loading && foods.length === 0 ? (
        <View style={{ flex: 1 }}>
          {renderListHeader}
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color="#16A34A" />
          </View>
        </View>
      ) : error && foods.length === 0 ? (
        <View style={{ flex: 1 }}>
          {renderListHeader}
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={32} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => item.categoryKey}
          renderItem={renderCategoryBlock}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={renderListFooter}
          contentContainerStyle={{ paddingBottom: 110 }}
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
    backgroundColor: "#F8FEF9",
  },
  header: {
    paddingHorizontal: 0,
    paddingBottom: 16,
    backgroundColor: "#F8FEF9",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  titleRow: {
    alignItems: "center",
    gap: 12,
  },
  titleTextBox: {
    flex: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DCFCE7",
    borderColor: "#DCFCE7",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 24,
    fontFamily: "Tajawal_700Bold",
    color: "#11674E",
  },
  pageSubtitle: {
    fontSize: 13.5,
    fontFamily: "Tajawal_500Medium",
    color: "#4B5563",
    marginTop: 2,
    lineHeight: 19,
  },
  filterSection: {
    marginTop: 14,
    gap: 12,
  },
  searchBox: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    height: 50,
    gap: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: "Tajawal_500Medium",
    color: "#111827",
    height: 46,
  },
  filterRowBlock: {
    gap: 6,
  },
  filterHeaderRow: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterLabel: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
    color: "#111827",
  },
  chipsContainer: {
    gap: 8,
    flexWrap: "wrap",
  },
  categoryScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  chipText: {
    fontSize: 13,
  },
  resetBtn: {
    alignItems: "center",
    gap: 4,
  },
  resetBtnText: {
    fontSize: 12.5,
    fontFamily: "Tajawal_700Bold",
    color: "#15803D",
  },
  loaderBox: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FECDD3",
    alignItems: "center",
    gap: 10,
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    color: "#DC2626",
    textAlign: "center",
    lineHeight: 20,
  },
  categoryBlock: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  tableContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryCardHeader: {
    backgroundColor: "#F4FAF5",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#DCFCE7",
  },
  categoryTitleBox: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTitle: {
    fontSize: 16.5,
    fontFamily: "Tajawal_700Bold",
    color: "#11674E",
    flex: 1,
  },
  countBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    color: "#15803D",
  },
  tableHeaderRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#F9FDF7",
    borderBottomWidth: 1,
    borderBottomColor: "#DCFCE7",
  },
  tableHeaderColName: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Tajawal_700Bold",
    color: "#4B5563",
  },
  tableHeaderColStatus: {
    width: 84,
    fontSize: 12.5,
    fontFamily: "Tajawal_700Bold",
    color: "#4B5563",
  },
  tableRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  foodNameText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: "#1F2937",
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
    marginHorizontal: 16,
    marginTop: 24,
    padding: 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  noResultsIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  noResultsText: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
    color: "#111827",
    textAlign: "center",
  },
  noResultsSubtext: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 19,
  },
  resetBtnInline: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#16A34A",
    marginTop: 6,
  },
  resetBtnInlineText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Tajawal_700Bold",
  },
  ctaCard: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    backgroundColor: "#FDFBF7",
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  ctaIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  ctaTitle: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
    color: "#11674E",
    marginBottom: 6,
    textAlign: "center",
  },
  ctaSubtitle: {
    fontSize: 13.5,
    fontFamily: "Tajawal_500Medium",
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  ctaButton: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: "#16A34A",
  },
  ctaButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
  },
});
