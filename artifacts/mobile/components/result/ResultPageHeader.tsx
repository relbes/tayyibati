import React from "react";
import { PageHeader } from "@/components/PageHeader";

export interface ResultPageHeaderProps {
  title?: string;
  subtitle?: string;
  methodBadgeText?: string;
  methodBadgeIcon?: string;
  centerIconType?: "search" | "camera" | "barcode" | "food";
  foodName?: string;
  onBackPress?: () => void;
  onRetry?: () => void;
}

/**
 * ResultPageHeader uses the unified, master PageHeader component
 * from the Tayyibati design system (identical to Search, Browse, Camera).
 */
export const ResultPageHeader = React.memo(function ResultPageHeader({
  title = "تحليل المكونات",
  subtitle,
  foodName,
  onBackPress,
  onRetry,
}: ResultPageHeaderProps) {
  return (
    <PageHeader
      title={title}
      subtitle={subtitle || foodName}
      badgeType="result"
      onBackPress={onBackPress}
      onRetry={onRetry}
    />
  );
});
