import React from "react";
import { View, Text, StyleSheet, Platform, StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle, Rect, Ellipse, Defs, RadialGradient, LinearGradient, Stop } from "react-native-svg";
import { BackButton } from "@/components/BackButton";

/* ----------------------------------------------------
 * SVG Center Badges: Consistent Deep Emerald + Mint Look
 * ---------------------------------------------------- */
export function HistoryBadgeSvg({
  size = 42,
  color = "#0C724D",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Rect
        x="9"
        y="8"
        width="22"
        height="26"
        rx="4"
        stroke={color}
        strokeWidth={2.4}
        fill="none"
      />
      <Path d="M14 15 L23 15" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M14 20 L21 20" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M14 25 L19 25" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Circle
        cx="28"
        cy="27"
        r="8"
        fill="#E8F8EF"
        stroke={color}
        strokeWidth={2.2}
      />
      <Path
        d="M28 23 L28 27 L31.5 27"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const DefaultCenterBadgeSvg = HistoryBadgeSvg;

export function SearchBadgeSvg({
  size = 42,
  color = "#0C724D",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Circle
        cx="18"
        cy="18"
        r="10"
        stroke={color}
        strokeWidth={2.5}
        fill="#E8F8EF"
      />
      {/* Search lens reflection / shine */}
      <Path
        d="M14 14 A 5 5 0 0 1 18 13"
        stroke="#10B981"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      {/* Magnifier Handle */}
      <Path
        d="M25.5 25.5 L33 33"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Handle grip accent */}
      <Path
        d="M28.5 28.5 L31.5 31.5"
        stroke="#10B981"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BrowseBadgeSvg({
  size = 42,
  color = "#0C724D",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Checklist / Board */}
      <Rect
        x="9"
        y="8"
        width="22"
        height="26"
        rx="4"
        stroke={color}
        strokeWidth={2.4}
        fill="#E8F8EF"
      />
      {/* Top Clip */}
      <Path
        d="M15 8 L15 6 C15 5 16 4 17 4 L23 4 C24 4 25 5 25 6 L25 8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Row 1: Checkmark + Line */}
      <Path
        d="M13 16 L15.5 18.5 L19.5 14"
        stroke="#10B981"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M22 16 L27 16" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Row 2: Checkmark + Line */}
      <Path
        d="M13 23 L15.5 25.5 L19.5 21"
        stroke="#10B981"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M22 23 L27 23" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Row 3: Bottom line */}
      <Path d="M14 29 L26 29" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function CameraBadgeSvg({
  size = 42,
  color = "#008C5A",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Solid Camera Silhouette matching Home "افحص طعامك" */}
      <Path
        d="M14 8h12l2.8 4h4.7A5.3 5.3 0 0 1 38.8 17.3v13.6a5.3 5.3 0 0 1-5.3 5.3H6.5A5.3 5.3 0 0 1 1.2 30.9V17.3A5.3 5.3 0 0 1 6.5 12h4.7L14 8z"
        fill={color}
      />
      <Circle cx="20" cy="24" r="6.2" fill="#E8F8EF" />
      <Circle cx="20" cy="24" r="3.5" fill={color} />
      <Circle cx="31.5" cy="17.6" r="1.8" fill="#E8F8EF" />
    </Svg>
  );
}

export function ProfileBadgeSvg({
  size = 42,
  color = "#0C724D",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Head */}
      <Circle
        cx="20"
        cy="15"
        r="6.5"
        stroke={color}
        strokeWidth={2.4}
        fill="#E8F8EF"
      />
      {/* Shoulders */}
      <Path
        d="M9.5 32 C9.5 26.5 14.2 24.5 20 24.5 C25.8 24.5 30.5 26.5 30.5 32"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      {/* Sparkle Accent */}
      <Circle
        cx="28"
        cy="11"
        r="2"
        fill="#10B981"
      />
    </Svg>
  );
}

export function AboutBadgeSvg({
  size = 42,
  color = "#0C724D",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Open Guide Book */}
      <Path
        d="M20 13 C16 10 11 10 7 12 L7 29 C11 27 16 27 20 30 C24 27 29 27 33 29 L33 12 C29 10 24 10 20 13 Z"
        stroke={color}
        strokeWidth={2.4}
        strokeLinejoin="round"
        fill="#E8F8EF"
      />
      <Path
        d="M20 13 L20 30"
        stroke={color}
        strokeWidth={2.2}
      />
      {/* Top Leaf Accent */}
      <Path
        d="M20 7 C18 4 14 5 15 8 C17 11 20 11 20 7 Z"
        fill="#10B981"
      />
    </Svg>
  );
}

export function PricingBadgeSvg({
  size = 42,
  color = "#0C724D",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Crown */}
      <Path
        d="M8 27 L10 15 L16 20 L20 12 L24 20 L30 15 L32 27 Z"
        stroke={color}
        strokeWidth={2.3}
        strokeLinejoin="round"
        fill="#E8F8EF"
      />
      {/* Base Bar */}
      <Path
        d="M9 29 L31 29"
        stroke={color}
        strokeWidth={2.3}
        strokeLinecap="round"
      />
      {/* Crown Jewels */}
      <Circle cx="10" cy="14" r="1.5" fill="#10B981" />
      <Circle cx="20" cy="11" r="1.8" fill="#10B981" />
      <Circle cx="30" cy="14" r="1.5" fill="#10B981" />
    </Svg>
  );
}

export function PrivacyBadgeSvg({
  size = 42,
  color = "#0C724D",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Shield */}
      <Path
        d="M20 8 L31 12 C31 21 26 28.5 20 33 C14 28.5 9 21 9 12 Z"
        stroke={color}
        strokeWidth={2.4}
        strokeLinejoin="round"
        fill="#E8F8EF"
      />
      {/* Verified Checkmark */}
      <Path
        d="M15.5 20 L18.5 23 L24.5 16.5"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function AuthBadgeSvg({
  size = 42,
  color = "#0C724D",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Lock Shackle */}
      <Path
        d="M14 17 L14 13 C14 9.7 16.7 7 20 7 C23.3 7 26 9.7 26 13 L26 17"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      {/* Lock Body */}
      <Rect
        x="10"
        y="17"
        width="20"
        height="15"
        rx="4"
        stroke={color}
        strokeWidth={2.4}
        fill="#E8F8EF"
      />
      {/* Keyhole */}
      <Circle cx="20" cy="23.5" r="2" fill={color} />
      <Path d="M20 24.5 L20 27.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function ForgotPasswordBadgeSvg({
  size = 42,
  color = "#0C724D",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Key Head */}
      <Circle
        cx="16"
        cy="18"
        r="6.5"
        stroke={color}
        strokeWidth={2.4}
        fill="#E8F8EF"
      />
      <Circle cx="16" cy="18" r="2.2" fill={color} />
      {/* Key Stem */}
      <Path
        d="M20.5 22.5 L30 32"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Key Teeth */}
      <Path
        d="M26 28 L29 25 M28 30 L31 27"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Circle cx="28" cy="11" r="1.5" fill="#10B981" />
    </Svg>
  );
}

export function AdminBadgeSvg({
  size = 42,
  color = "#0C724D",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Slider 1 */}
      <Path d="M9 13 L31 13" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx="16" cy="13" r="3.2" stroke={color} strokeWidth={2} fill="#E8F8EF" />

      {/* Slider 2 */}
      <Path d="M9 20 L31 20" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx="25" cy="20" r="3.2" stroke={color} strokeWidth={2} fill="#E8F8EF" />

      {/* Slider 3 */}
      <Path d="M9 27 L31 27" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx="18" cy="27" r="3.2" stroke={color} strokeWidth={2} fill="#E8F8EF" />
    </Svg>
  );
}

export function ResultBadgeSvg({
  size = 42,
  color = "#0C724D",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Analysis Rosette */}
      <Circle
        cx="20"
        cy="18"
        r="10"
        stroke={color}
        strokeWidth={2.4}
        fill="#E8F8EF"
      />
      {/* Verified Checkmark */}
      <Path
        d="M15.5 18 L18.5 21 L24.5 15"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Ribbon Tails */}
      <Path
        d="M15 27 L13 34 L18 31.5 L20 27"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        fill="#E8F8EF"
      />
      <Path
        d="M25 27 L27 34 L22 31.5 L20 27"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        fill="#E8F8EF"
      />
    </Svg>
  );
}

/* ----------------------------------------------------
 * SVG Component 2: Half Cut Lemon with Mint Sprig (3D Look)
 * ---------------------------------------------------- */
function LemonWithMintSvg({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <Defs>
        <RadialGradient id="lemon3DPeelH" cx="30%" cy="30%" r="70%">
          <Stop offset="0%" stopColor="#FEF08A" />
          <Stop offset="45%" stopColor="#FACC15" />
          <Stop offset="85%" stopColor="#EAB308" />
          <Stop offset="100%" stopColor="#CA8A04" />
        </RadialGradient>
        <RadialGradient id="pulpGradH" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FEF9C3" />
          <Stop offset="40%" stopColor="#FDE047" />
          <Stop offset="85%" stopColor="#FACC15" />
          <Stop offset="100%" stopColor="#EAB308" />
        </RadialGradient>
        <LinearGradient id="mintGradH" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#4ADE80" />
          <Stop offset="50%" stopColor="#16A34A" />
          <Stop offset="100%" stopColor="#15803D" />
        </LinearGradient>
      </Defs>

      {/* Mint Leaves */}
      <Path
        d="M38 16 C48 8 62 10 65 18 C64 28 53 30 42 24 Z"
        fill="url(#mintGradH)"
        stroke="#166534"
        strokeWidth={0.8}
      />
      <Path d="M40 18 C48 14 55 13 62 16" stroke="#86EFAC" strokeWidth={1} strokeLinecap="round" />
      <Path
        d="M40 25 C52 22 64 28 66 38 C56 42 46 39 39 30 Z"
        fill="url(#mintGradH)"
        stroke="#166534"
        strokeWidth={0.8}
      />
      <Path d="M42 27 C50 31 56 34 62 36" stroke="#86EFAC" strokeWidth={1} strokeLinecap="round" />

      {/* 3D Lemon Body */}
      <Circle cx="26" cy="35" r="23" fill="url(#lemon3DPeelH)" />
      <Circle cx="26" cy="35" r="20" fill="#FEFCE8" />
      <Circle cx="26" cy="35" r="17.5" fill="url(#pulpGradH)" />
      <Circle cx="26" cy="35" r="2.8" fill="#FEFCE8" />

      {/* 8 Radial Segments */}
      <Path
        d="M26 18 L26 52 M9 35 L43 35 M14 23 L38 47 M14 47 L38 23"
        stroke="#FEFCE8"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Circle cx="19" cy="28" r="1.5" fill="#FEF9C3" opacity={0.8} />
      <Circle cx="33" cy="28" r="1.5" fill="#FEF9C3" opacity={0.8} />
      <Circle cx="19" cy="42" r="1.5" fill="#FEF9C3" opacity={0.8} />
      <Circle cx="33" cy="42" r="1.5" fill="#FEF9C3" opacity={0.8} />
    </Svg>
  );
}

/* ----------------------------------------------------
 * SVG Component 3: Green Detox Smoothie Jar with Straw
 * ---------------------------------------------------- */
function GreenSmoothieJarSvg({
  width = 44,
  height = 58,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 46 62" fill="none">
      <Defs>
        <LinearGradient id="smoothieLiquid3DH" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#3F6212" />
          <Stop offset="25%" stopColor="#65A30D" />
          <Stop offset="70%" stopColor="#84CC16" />
          <Stop offset="100%" stopColor="#4D7C0F" />
        </LinearGradient>
      </Defs>

      {/* Striped Straw */}
      <Path d="M29 2 L22 26" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" />
      <Path d="M28.5 4 L27.2 8" stroke="#22C55E" strokeWidth={5} strokeLinecap="round" />
      <Path d="M26.2 12 L24.9 16" stroke="#22C55E" strokeWidth={5} strokeLinecap="round" />
      <Path d="M23.9 20 L22.6 24" stroke="#22C55E" strokeWidth={5} strokeLinecap="round" />

      {/* Jar Glass Lip */}
      <Rect x="12" y="18" width="22" height="6" rx="2.5" fill="#F1F5F9" stroke="#94A3B8" strokeWidth={1} />
      <Rect x="14" y="24" width="18" height="3" fill="#E2E8F0" />

      {/* Jar Body */}
      <Path
        d="M10 27 C6 29.5 5 33.5 5 38 L5 53 C5 58 9 61 15 61 L29 61 C35 61 39 58 39 53 L39 38 C39 33.5 38 29.5 34 27 Z"
        fill="url(#smoothieLiquid3DH)"
        stroke="#64748B"
        strokeWidth={1.2}
      />
      <Ellipse cx="22" cy="29" rx="11" ry="2.8" fill="#A3E635" />
      <Path d="M13 26 C9 22 11 17 15 19 C17 21 16 25 13 26 Z" fill="#15803D" />
      <Path
        d="M8 32 L8 53 C8 56 10 58 13 58"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/* ----------------------------------------------------
 * SVG Component 4: Blueberries Pair
 * ---------------------------------------------------- */
function BlueberriesSvg({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.75} viewBox="0 0 40 30" fill="none">
      <Defs>
        <RadialGradient id="berryGrad1H" cx="35%" cy="30%" r="70%">
          <Stop offset="0%" stopColor="#93C5FD" />
          <Stop offset="25%" stopColor="#3B82F6" />
          <Stop offset="65%" stopColor="#1E3A8A" />
          <Stop offset="100%" stopColor="#0B132B" />
        </RadialGradient>
        <RadialGradient id="berryGrad2H" cx="35%" cy="30%" r="70%">
          <Stop offset="0%" stopColor="#BFDBFE" />
          <Stop offset="30%" stopColor="#60A5FA" />
          <Stop offset="70%" stopColor="#2563EB" />
          <Stop offset="100%" stopColor="#0F172A" />
        </RadialGradient>
      </Defs>
      <Circle cx="14" cy="16" r="12" fill="url(#berryGrad1H)" />
      <Circle cx="12" cy="14" r="3.6" fill="#0B132B" />
      <Circle cx="10.5" cy="12.5" r="1.2" fill="#DBEAFE" opacity={0.8} />
      <Circle cx="28" cy="17" r="10.5" fill="url(#berryGrad2H)" />
      <Circle cx="27" cy="16" r="3" fill="#0F172A" />
      <Circle cx="25.5" cy="14.5" r="1" fill="#E0F2FE" opacity={0.8} />
    </Svg>
  );
}

/* ----------------------------------------------------
 * SVG Component 5: Glossy Red Tomato
 * ---------------------------------------------------- */
function TomatoSvg({ size = 42 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <Defs>
        <RadialGradient id="tomato3DGradH" cx="35%" cy="30%" r="70%">
          <Stop offset="0%" stopColor="#FCA5A5" />
          <Stop offset="25%" stopColor="#EF4444" />
          <Stop offset="70%" stopColor="#DC2626" />
          <Stop offset="100%" stopColor="#881337" />
        </RadialGradient>
      </Defs>
      <Circle cx="22" cy="24" r="18" fill="url(#tomato3DGradH)" />
      <Path
        d="M14 15 C18 12 23 12 27 14"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="22" r="1.6" fill="rgba(255,255,255,0.4)" />
      <Path d="M22 8 C22 4 24 3 26 2" stroke="#15803D" strokeWidth={2.4} strokeLinecap="round" />
      <Path
        d="M22 8 L22 14 M22 8 L17 9 M22 8 L27 9 M22 8 L18 13 M22 8 L25 13"
        stroke="#16A34A"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ----------------------------------------------------
 * SVG Component 6: Parsley Sprig
 * ---------------------------------------------------- */
function ParsleySprigSvg({ size = 42 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <Path d="M34 39 C27 30 20 22 13 11" stroke="#15803D" strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M25 27 C31 24 36 28 34 33 C31 36 27 35 24 31 Z" fill="#22C55E" stroke="#15803D" strokeWidth={0.8} />
      <Path d="M18 20 C14 24 9 27 7 23 C5 19 9 17 15 18 Z" fill="#16A34A" stroke="#15803D" strokeWidth={0.8} />
      <Path d="M13 11 C8 8 9 2 14 5 C18 2 21 7 18 10 C19 14 15 15 12 12 Z" fill="#22C55E" stroke="#15803D" strokeWidth={0.8} />
    </Svg>
  );
}

/* ----------------------------------------------------
 * SVG Component 7: Basil Leaf
 * ---------------------------------------------------- */
function BasilLeafSvg({
  width = 28,
  height = 40,
  rotate = 0,
}: {
  width?: number;
  height?: number;
  rotate?: number;
}) {
  return (
    <View style={{ transform: [{ rotate: String(rotate) + "deg" }] }}>
      <Svg width={width} height={height} viewBox="0 0 26 38" fill="none">
        <Defs>
          <LinearGradient id="basilGradH" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4ADE80" />
            <Stop offset="40%" stopColor="#16A34A" />
            <Stop offset="100%" stopColor="#14532D" />
          </LinearGradient>
        </Defs>
        <Path
          d="M13 2 C7 8 2 18 4 28 C6 34 10 36 13 36 C16 36 20 34 22 28 C24 18 19 8 13 2 Z"
          fill="url(#basilGradH)"
          stroke="#14532D"
          strokeWidth={0.8}
        />
        <Path d="M13 5 L13 34" stroke="#86EFAC" strokeWidth={0.9} strokeLinecap="round" opacity={0.7} />
      </Svg>
    </View>
  );
}

/* ----------------------------------------------------
 * SVG Component 8: Floating Botanical Leaf
 * ---------------------------------------------------- */
function FloatingLeafSvg({
  size = 16,
  rotate = 0,
}: {
  size?: number;
  rotate?: number;
}) {
  return (
    <View style={{ transform: [{ rotate: String(rotate) + "deg" }] }}>
      <Svg width={size} height={size * 0.75} viewBox="0 0 24 18" fill="none">
        <Path
          d="M2 9 C8 2 16 1 22 3 C20 10 14 16 6 15 C3 14 2 11 2 9 Z"
          fill="#34A853"
          stroke="#1E7E34"
          strokeWidth={0.8}
        />
        <Path d="M4 10 C10 8 15 6 20 4" stroke="#A7F3D0" strokeWidth={0.8} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/* ----------------------------------------------------
 * SVG Component 9: Soft Decorative Dot
 * ---------------------------------------------------- */
function SoftDotSvg({
  size = 8,
  color = "rgba(52, 168, 83, 0.28)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Circle cx="5" cy="5" r="5" fill={color} />
    </Svg>
  );
}

/* ----------------------------------------------------
 * Botanical Background Composition (Pure Visual)
 * ---------------------------------------------------- */
const BotanicalBackground = React.memo(function BotanicalBackground({
  topOffset = 44,
}: {
  topOffset?: number;
}) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* 1. Halos */}
      <View style={[styles.bgHaloLeft, { top: topOffset + 15 }]} />
      <View style={[styles.bgHaloRight, { top: topOffset + 50 }]} />

      {/* 2. Left side: Smoothie Jar, Berries, Tomato, Parsley */}
      <View style={[styles.posAbsolute, { left: 48, top: topOffset + 2 }]}>
        <FloatingLeafSvg size={14} rotate={30} />
      </View>
      <View style={[styles.posAbsolute, { left: 8, top: topOffset + 12 }]}>
        <GreenSmoothieJarSvg width={44} height={58} />
      </View>
      <View style={[styles.posAbsolute, { left: 76, top: topOffset + 16 }]}>
        <FloatingLeafSvg size={16} rotate={-25} />
      </View>
      <View style={[styles.posAbsolute, { left: 32, top: topOffset + 70 }]}>
        <BlueberriesSvg size={34} />
      </View>
      <View style={[styles.posAbsolute, { left: 4, top: topOffset + 94 }]}>
        <TomatoSvg size={42} />
      </View>
      <View style={[styles.posAbsolute, { left: 34, top: topOffset + 124 }]}>
        <ParsleySprigSvg size={42} />
      </View>
      <View style={[styles.posAbsolute, { left: 20, top: topOffset + 172 }]}>
        <FloatingLeafSvg size={16} rotate={60} />
      </View>

      {/* Left Soft Dots */}
      <View style={[styles.posAbsolute, { left: 78, top: topOffset + 74 }]}>
        <SoftDotSvg size={9} />
      </View>
      <View style={[styles.posAbsolute, { left: 14, top: topOffset + 138 }]}>
        <SoftDotSvg size={6} />
      </View>
      <View style={[styles.posAbsolute, { left: 104, top: topOffset + 114 }]}>
        <SoftDotSvg size={7} />
      </View>

      {/* 3. Right side: BackButton space above, Lemon & Leaves below */}
      <View style={[styles.posAbsolute, { right: 68, top: topOffset + 12 }]}>
        <FloatingLeafSvg size={16} rotate={35} />
      </View>
      <View style={[styles.posAbsolute, { right: 2, top: topOffset + 58 }]}>
        <LemonWithMintSvg size={64} />
      </View>
      <View style={[styles.posAbsolute, { right: 22, top: topOffset + 124 }]}>
        <FloatingLeafSvg size={12} rotate={-15} />
      </View>
      <View style={[styles.posAbsolute, { right: 32, top: topOffset + 130 }]}>
        <BasilLeafSvg width={28} height={40} rotate={-35} />
      </View>

      {/* Right Soft Dots */}
      <View style={[styles.posAbsolute, { right: 16, top: topOffset - 2 }]}>
        <SoftDotSvg size={8} />
      </View>
      <View style={[styles.posAbsolute, { right: 82, top: topOffset + 86 }]}>
        <SoftDotSvg size={9} />
      </View>
      <View style={[styles.posAbsolute, { right: 24, top: topOffset + 176 }]}>
        <SoftDotSvg size={7} />
      </View>
    </View>
  );
});

/* ----------------------------------------------------
 * PageHeader: Purely Visual Reusable Header
 * ---------------------------------------------------- */
export type PageHeaderBadgeType =
  | "history"
  | "search"
  | "browse"
  | "camera"
  | "profile"
  | "about"
  | "pricing"
  | "privacy"
  | "auth"
  | "forgot-password"
  | "admin"
  | "result";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badgeType?: PageHeaderBadgeType;
  badgeIcon?: React.ReactNode;
  onBackPress?: () => void;
  showBackButton?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export const PageHeader = React.memo(function PageHeader({
  title,
  subtitle,
  badgeType = "history",
  badgeIcon,
  onBackPress,
  showBackButton = true,
  style,
  children,
}: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 16 : Math.max(insets.top, 44);

  const renderBadge = () => {
    if (badgeIcon !== undefined) {
      return badgeIcon;
    }
    switch (badgeType) {
      case "search":
        return <SearchBadgeSvg size={42} color="#0C724D" />;
      case "browse":
        return <BrowseBadgeSvg size={42} color="#0C724D" />;
      case "camera":
        return <CameraBadgeSvg size={42} color="#0C724D" />;
      case "profile":
        return <ProfileBadgeSvg size={42} color="#0C724D" />;
      case "about":
        return <AboutBadgeSvg size={42} color="#0C724D" />;
      case "pricing":
        return <PricingBadgeSvg size={42} color="#0C724D" />;
      case "privacy":
        return <PrivacyBadgeSvg size={42} color="#0C724D" />;
      case "auth":
        return <AuthBadgeSvg size={42} color="#0C724D" />;
      case "forgot-password":
        return <ForgotPasswordBadgeSvg size={42} color="#0C724D" />;
      case "admin":
        return <AdminBadgeSvg size={42} color="#0C724D" />;
      case "result":
        return <ResultBadgeSvg size={42} color="#0C724D" />;
      case "history":
      default:
        return <HistoryBadgeSvg size={42} color="#0C724D" />;
    }
  };

  const badgeElement = renderBadge();

  return (
    <View
      style={[
        styles.headerContainer,
        {
          paddingTop: topPadding + 4,
          paddingBottom: 22,
        },
        style,
      ]}
    >
      {/* 1. Botanical Background Elements */}
      <BotanicalBackground topOffset={topPadding} />

      {/* 2. Standardized Squircle Dark Emerald Back Button */}
      {showBackButton && (
        <BackButton
          onPress={onBackPress}
          style={[styles.backBtn, { top: topPadding + 6 }]}
        />
      )}

      {/* 3. Center Section: Badge + Title + Subtitle */}
      <View style={styles.headerCenterSection}>
        {badgeElement !== null && (
          <View style={styles.headerCenterBadge}>
            {badgeElement}
          </View>
        )}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: "#F8FEF9",
    position: "relative",
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  posAbsolute: {
    position: "absolute",
  },
  bgHaloLeft: {
    position: "absolute",
    left: -25,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#EDFBF2",
    opacity: 0.85,
  },
  bgHaloRight: {
    position: "absolute",
    right: -25,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#EDFBF2",
    opacity: 0.85,
  },
  backBtn: {
    position: "absolute",
    right: 18,
    zIndex: 20,
  },
  headerCenterSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 75,
    zIndex: 5,
  },
  headerCenterBadge: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "rgba(230, 247, 237, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(13, 118, 78, 0.12)",
    shadowColor: "#0D764E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 26,
    fontFamily: "Tajawal_700Bold",
    color: "#0C6246",
    textAlign: "center",
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    color: "#64748B",
    textAlign: "center",
    marginTop: 5,
  },
});
