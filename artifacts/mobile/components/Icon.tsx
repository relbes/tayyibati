/**
 * SVG-based icon wrapper using lucide-react-native.
 * No font loading required — works on Android, iOS, and web via react-native-svg.
 * Maps Ionicons-style name strings to lucide components.
 */
import React from "react";
import {
  AlertCircle,
  BarChart3,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
  XCircle,
  HelpCircle,
  Image,
  Grid3x3,
  Lock,
  LogOut,
  Mail,
  User,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Star,
  Clock,
  Trash2,
  Home,
  History,
  Menu,
  Eye,
  EyeOff,
  Crown,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
  Upload,
  FileText,
  Settings,
  Bell,
  Heart,
  Share2,
  Copy,
  Edit,
  Filter,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react-native";

const ICON_MAP: Record<string, LucideIcon> = {
  // Navigation & UI
  "close": X,
  "x": X,
  "close-circle": XCircle,
  "close-circle-outline": XCircle,
  "chevron-back": ChevronLeft,
  "chevron-forward": ChevronRight,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  "arrow-back": ArrowRight,
  "arrow-forward": ArrowLeft,
  "menu": Menu,
  "home": Home,
  "home-outline": Home,

  // Search & content
  "search": Search,
  "search-outline": Search,

  // Camera & media
  "camera": Camera,
  "camera-outline": Camera,
  "image-outline": Image,
  "images": LayoutGrid,
  "images-outline": LayoutGrid,

  // Person & auth
  "person": User,
  "person-outline": User,
  "lock-closed": Lock,
  "lock-closed-outline": Lock,
  "mail": Mail,
  "mail-outline": Mail,
  "log-out": LogOut,
  "log-out-outline": LogOut,
  "eye": Eye,
  "eye-off": EyeOff,
  "eye-outline": Eye,
  "eye-off-outline": EyeOff,

  // Status & feedback
  "alert-circle": AlertCircle,
  "alert-circle-outline": AlertCircle,
  "checkmark-circle": CheckCircle2,
  "checkmark-circle-outline": CheckCircle2,
  "checkmark": Check,
  "help-circle": HelpCircle,
  "help-circle-outline": HelpCircle,
  "shield-checkmark": ShieldCheck,
  "shield-checkmark-outline": ShieldCheck,
  "information-circle": Info,
  "information-circle-outline": Info,

  // Data & analytics
  "analytics": BarChart3,
  "analytics-outline": BarChart3,
  "server": Server,
  "server-outline": Server,
  "keypad": Grid3x3,
  "keypad-outline": Grid3x3,

  // Actions
  "refresh": RefreshCw,
  "refresh-outline": RefreshCw,
  "trash": Trash2,
  "trash-outline": Trash2,
  "star": Star,
  "star-outline": Star,
  "time": Clock,
  "time-outline": Clock,
  "bulb": Lightbulb,
  "bulb-outline": Lightbulb,
  "upload": Upload,
  "copy": Copy,
  "create": Edit,
  "create-outline": Edit,
  "share": Share2,
  "share-outline": Share2,
  "add": Plus,
  "add-circle": Plus,
  "remove": Minus,
  "document-text": FileText,
  "document-text-outline": FileText,
  "settings": Settings,
  "settings-outline": Settings,
  "notifications": Bell,
  "notifications-outline": Bell,
  "heart": Heart,
  "heart-outline": Heart,
  "filter": Filter,
  "filter-outline": Filter,
  "crown": Crown,
  "history": History,
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color = "#000", strokeWidth = 1.75 }: IconProps) {
  const LucideIcon = ICON_MAP[name];

  if (!LucideIcon) {
    // Fallback: render an info circle so missing icons are visible during dev
    return <Info size={size} color={color} strokeWidth={strokeWidth} />;
  }

  return <LucideIcon size={size} color={color} strokeWidth={strokeWidth} />;
}
