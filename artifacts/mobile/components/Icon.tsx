/**
 * SVG-based icon component using lucide-react-native.
 * Drop-in replacement for @expo/vector-icons Ionicons/Feather —
 * no font loading required, works on all platforms including Android.
 */
import React from "react";
import {
  Home, Search, Camera, Clock, User, X, XCircle,
  RotateCcw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  ImageIcon, Images, HelpCircle, CheckCircle2, AlertCircle,
  Info, Trash2, Star, BarChart2, LogOut, ShieldCheck,
  Lightbulb, QrCode, Mail, Lock, Eye, EyeOff,
  ArrowLeft, ArrowRight, Filter, PlusCircle, MinusCircle,
  Server, Grid2x2, AlertTriangle, Bell, Settings, Pencil,
  CheckCheck, Plus,
} from "lucide-react-native";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const ICON_MAP: Record<string, LucideIcon> = {
  // Navigation
  "home": Home,
  "home-outline": Home,
  "search": Search,
  "search-outline": Search,
  "camera": Camera,
  "camera-outline": Camera,
  "time": Clock,
  "time-outline": Clock,
  "person": User,
  "person-outline": User,

  // Actions
  "close": X,
  "close-outline": X,
  "close-circle": XCircle,
  "close-circle-outline": XCircle,
  "refresh": RotateCcw,
  "refresh-outline": RotateCcw,
  "trash-outline": Trash2,
  "trash": Trash2,
  "create-outline": Pencil,
  "add-circle": PlusCircle,
  "add-circle-outline": PlusCircle,
  "remove-circle": MinusCircle,
  "log-out-outline": LogOut,
  "log-out": LogOut,
  "filter-outline": Filter,
  "filter": Filter,

  // Chevrons (RTL: "back" = chevron pointing LEFT on screen because layout is mirrored)
  "chevron-back": ChevronLeft,
  "chevron-forward": ChevronRight,
  "chevron-up": ChevronUp,
  "chevron-down": ChevronDown,

  // Arrows
  "arrow-back": ArrowLeft,
  "arrow-forward": ArrowRight,

  // Status
  "checkmark-circle": CheckCircle2,
  "checkmark-circle-outline": CheckCircle2,
  "alert-circle": AlertCircle,
  "alert-circle-outline": AlertCircle,
  "help-circle": HelpCircle,
  "help-circle-outline": HelpCircle,
  "information-circle": Info,
  "information-circle-outline": Info,

  // Media
  "image-outline": ImageIcon,
  "image": ImageIcon,
  "images": Images,
  "barcode-outline": QrCode,

  // Misc
  "star": Star,
  "star-outline": Star,
  "analytics-outline": BarChart2,
  "shield-checkmark": ShieldCheck,
  "shield-checkmark-outline": ShieldCheck,
  "bulb": Lightbulb,
  "bulb-outline": Lightbulb,
  "mail-outline": Mail,
  "mail": Mail,
  "lock-closed": Lock,
  "lock-closed-outline": Lock,
  "eye": Eye,
  "eye-outline": Eye,
  "eye-off": EyeOff,
  "eye-off-outline": EyeOff,
  "server-outline": Server,
  "server": Server,
  "keypad-outline": Grid2x2,
  "notifications-outline": Bell,
  "settings-outline": Settings,
  "checkmark": CheckCheck,
  "add": Plus,

  // Feather aliases
  "alert-circle-feather": AlertCircle,
  "x": X,
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: any;
}

export function Icon({ name, size = 20, color = "#000", strokeWidth }: IconProps) {
  const LucideComponent = ICON_MAP[name];
  if (!LucideComponent) {
    return null;
  }
  return (
    <LucideComponent
      size={size}
      color={color}
      strokeWidth={strokeWidth ?? (name.endsWith("-outline") ? 1.5 : 2)}
    />
  );
}
