/**
 * SVG-based icon wrapper using lucide-react-native.
 * No font loading required — works on Android, iOS, and web via react-native-svg.
 * Maps Ionicons-style name strings to lucide components.
 */
import React from "react";
import Svg, { Path, Circle } from "react-native-svg";
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
  Leaf,
  Apple,
  Wheat,
  Utensils,
  Package,
  Soup,
  CookingPot,
  ChefHat,
  Barcode,
  ScanBarcode,
  Scan,
  Sun,
  Moon,
  Target,
  BookOpen,
  Flame,
  BadgeCheck,
  SearchCheck,
  Focus,
  Sparkles,
  Code,
  Compass,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react-native";

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}

/**
 * Bold, solid Tayyibati system & food compatibility icon.
 * Features a solid Tayyibati green shield silhouette with white leaf and precision compatibility checkmark.
 */
function TayyibatSystemIcon({ size = 24, color = "#008C5A" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Solid shield silhouette representing the Tayyibat System */}
      <Path
        d="M12 2.2L4.5 5.5v5.8c0 5.4 3.2 10.4 7.5 11.6 4.3-1.2 7.5-6.2 7.5-11.6V5.5L12 2.2z"
        fill={color}
      />
      {/* White wholesome leaf representing pure natural Tayyibat food */}
      <Path
        d="M12 6.6c-2.7 1.4-3.6 3.5-3.3 5.6.3 1.9 1.8 3.4 3.3 4.6 1.5-1.2 3-2.7 3.3-4.6.3-2.1-.6-4.2-3.3-5.6z"
        fill="#FFFFFF"
      />
      {/* Precision checkmark inside leaf representing food compatibility */}
      <Path
        d="M10.4 12.3l1.2 1.3 2.6-2.7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}


/**
 * Solid Tayyibati camera with clean silhouette, negative-space lens ring, pupil, and flash detail.
 * Exactly as shown in the "افحص طعامك" home action card.
 */
function CameraFilledIcon({ size = 24, color = "#008C5A", fill }: IconProps) {
  const isLight =
    color.toLowerCase() === "#ffffff" ||
    color.toLowerCase() === "#fff" ||
    color.toLowerCase() === "white";

  const cutout = fill && fill !== "none" ? fill : isLight ? "#008C5A" : "#FFFFFF";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.5 4.8h7l1.7 2.4h2.8A3.2 3.2 0 0 1 23.2 10.4v8.2a3.2 3.2 0 0 1-3.2 3.2H4A3.2 3.2 0 0 1 0.8 18.6v-8.2a3.2 3.2 0 0 1 3.2-3.2h2.8L8.5 4.8z"
        fill={color}
      />
      <Circle cx="12" cy="14.4" r="3.7" fill={cutout} />
      <Circle cx="12" cy="14.4" r="2.1" fill={color} />
      <Circle cx="18.8" cy="10.6" r="1.1" fill={cutout} />
    </Svg>
  );
}

/**
 * Bold accuracy and verification icon with solid silhouette and white negative-space precision checkmark.
 */
function AccuracyIcon({ size = 24, color = "#008C5A" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" fill={color} />
      <Path
        d="M7.6 12.2l3 3.2 5.8-6.4"
        stroke="#FFFFFF"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Solid profile / user silhouette with filled head and body.
 */
function PersonFilledIcon({ size = 24, color = "#008C5A" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="7.5" r="4.2" fill={color} />
      <Path
        d="M3.8 20.2c0-4.2 3.7-7.6 8.2-7.6s8.2 3.4 8.2 7.6a1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Solid notification bell silhouette with filled bell body and clapper.
 */
function BellFilledIcon({ size = 24, color = "#008C5A" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2a2 2 0 0 0-2 2c0 .32.06.63.16.92C7.26 5.8 5.2 8.7 5.2 12.2v3.9L3.5 17.9a1 1 0 0 0 .8 1.6h15.4a1 1 0 0 0 .8-1.6l-1.7-1.8v-3.9c0-3.5-2.06-6.4-4.96-7.28.1-.29.16-.6.16-.92a2 2 0 0 0-2-2z"
        fill={color}
      />
      <Path
        d="M10.2 21.2a2 2 0 0 0 3.6 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const ICON_MAP: Record<string, any> = {
  // Food & Dish entity icons
  "leaf": Leaf,
  "leaf-outline": Leaf,
  "food": Leaf,
  "apple": Apple,
  "wheat": Wheat,
  "utensils": Utensils,
  "dish": Utensils,
  "package": Package,
  "soup": Soup,
  "cooking-pot": CookingPot,
  "chef-hat": ChefHat,
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
  "menu-outline": Menu,
  "home": Home,
  "home-outline": Home,
  "compass": Compass,
  "compass-outline": Compass,
  "browse": Compass,

  // Search & content
  "search": Search,
  "search-outline": Search,

  // Camera & media
  "camera": CameraFilledIcon,
  "camera-filled": CameraFilledIcon,
  "food-camera": CameraFilledIcon,
  "camera-outline": CameraFilledIcon,
  "photo-camera": CameraFilledIcon,
  "image": Image,
  "gallery": Image,
  "image-outline": Image,
  "images": LayoutGrid,
  "images-outline": LayoutGrid,

  // Person & auth
  "person": PersonFilledIcon,
  "person-filled": PersonFilledIcon,
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
  "alert-triangle": AlertTriangle,
  "checkmark-circle": CheckCircle2,
  "checkmark-circle-outline": CheckCircle2,
  "checkmark": Check,
  "help-circle": HelpCircle,
  "help-circle-outline": HelpCircle,
  "shield-checkmark": ShieldCheck,
  "shield-checkmark-outline": ShieldCheck,
  "information-circle": Info,
  "information-circle-outline": Info,
  "about-system": TayyibatSystemIcon,
  "tayyibat-system": TayyibatSystemIcon,
  "food-compatibility": TayyibatSystemIcon,
  "about": TayyibatSystemIcon,
  "system-info": TayyibatSystemIcon,

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
  "plus": Plus,
  "add": Plus,
  "add-circle": Plus,
  "minus": Minus,
  "remove": Minus,
  "code": Code,
  "code-slash": Code,
  "code-slash-outline": Code,
  "document-text": FileText,
  "document-text-outline": FileText,
  "settings": Settings,
  "notifications": BellFilledIcon,
  "notifications-filled": BellFilledIcon,
  "notifications-outline": Bell,
  "bell": BellFilledIcon,
  "bell-filled": BellFilledIcon,
  "bell-outline": Bell,
  "heart": Heart,
  "heart-outline": Heart,
  "filter": Filter,
  "filter-outline": Filter,
  "crown": Crown,
  "history": History,

  // Barcode & scanning
  "barcode": ScanBarcode,
  "barcode-outline": ScanBarcode,
  "scan": ScanBarcode,
  "scan-outline": ScanBarcode,
  "scan-barcode": ScanBarcode,
  "barcode-scan": ScanBarcode,
  "scan-box": Scan,

  // Accuracy, precision & verification
  "accuracy": AccuracyIcon,
  "precision": AccuracyIcon,
  "better-result": AccuracyIcon,
  "verify": AccuracyIcon,
  "target": AccuracyIcon,
  "target-outline": AccuracyIcon,
  "locate": AccuracyIcon,
  "locate-outline": AccuracyIcon,
  "badge-check": BadgeCheck,
  "search-check": SearchCheck,
  "focus": Focus,
  "sparkles": Sparkles,

  // Celestial & time
  "sun": Sun,
  "sun-outline": Sun,
  "moon": Moon,
  "moon-outline": Moon,

  // Knowledge & popular
  "book": BookOpen,
  "book-outline": BookOpen,
  "flame": Flame,
};

export function Icon({ name, size = 20, color = "#000", strokeWidth = 1.75, fill }: IconProps) {
  const IconComponent = ICON_MAP[name];

  if (!IconComponent) {
    // Fallback: render an info circle so missing icons are visible during dev
    return <Info size={size} color={color} strokeWidth={strokeWidth} />;
  }

  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} fill={fill || "none"} />;
}
