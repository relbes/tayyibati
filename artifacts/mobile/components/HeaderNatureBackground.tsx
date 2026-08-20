import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/Icon";

/**
 * Reusable botanical nature background overlay for Tayyibati screen headers.
 * Adds organic glowing rings, translucent leaf watermarks, depth gradients,
 * and warm gold nature sparkles to make headers feel vibrant and alive.
 */
export const HeaderNatureBackground = React.memo(function HeaderNatureBackground() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* 1. Subtle Depth Gradient */}
      <LinearGradient
        colors={["rgba(255, 255, 255, 0.12)", "rgba(0, 0, 0, 0.08)"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* 2. Top-Right Organic Sun Circle & Concentric Ring */}
      <View style={styles.sunCircleRight} />
      <View style={styles.sunCircleRingRight} />

      {/* 3. Bottom-Left Soft Gold Meadow Circle */}
      <View style={styles.meadowCircleLeft} />

      {/* 4. Translucent Botanical Leaf Watermark (Top Right) */}
      <View style={styles.leafWatermarkRight}>
        <Icon name="leaf" size={74} color="rgba(255, 255, 255, 0.12)" />
      </View>

      {/* 5. Translucent Botanical Leaf Watermark (Bottom Left) */}
      <View style={styles.leafWatermarkLeft}>
        <Icon name="leaf-outline" size={48} color="rgba(255, 255, 255, 0.10)" />
      </View>

      {/* 6. Subtle Gold Nature Sparkle Accent */}
      <View style={styles.sparkleAccent}>
        <Icon name="sparkles" size={18} color="rgba(245, 158, 11, 0.3)" />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  sunCircleRight: {
    position: "absolute",
    top: -25,
    right: -25,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.09)",
  },
  sunCircleRingRight: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  meadowCircleLeft: {
    position: "absolute",
    bottom: -30,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(245, 158, 11, 0.09)",
  },
  leafWatermarkRight: {
    position: "absolute",
    top: -8,
    right: 18,
    transform: [{ rotate: "22deg" }],
  },
  leafWatermarkLeft: {
    position: "absolute",
    bottom: -8,
    left: 18,
    transform: [{ rotate: "-35deg" }],
  },
  sparkleAccent: {
    position: "absolute",
    top: 14,
    left: "48%",
  },
});
