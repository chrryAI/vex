/**
 * Native Icon Exports
 * Uses lucide-react-native for iOS/Android environments
 * Automatically resolves CSS variable colors like var(--accent-1)
 */

import React from "react"
import * as LucideIcons from "lucide-react-native"
import { resolveThemeValue } from "../styles/resolveThemeValue"
import { useTheme } from "../context/ThemeContext"

// AI Brand Icons (simple emoji-based for React Native)
export * from "./BrandIcons.native"

// lucide-react-native doesn't export IconProps, so we define it
export type IconProps = {
  size?: number
  color?: string
  strokeWidth?: number
  fill?: string
  [key: string]: any
}

// Helper to resolve CSS variable colors
function useResolveIconColor(color: string | undefined): string | undefined {
  const themeContext = useTheme()

  if (!color) return color

  // If it's a CSS variable, resolve it
  if (color.startsWith("var(--")) {
    return resolveThemeValue(color, themeContext.theme) as string
  }

  // Otherwise return as-is
  return color
}

// Create wrapped versions of all Lucide icons that auto-resolve colors
const wrappedIcons: Record<string, React.ComponentType<any>> = {}

Object.keys(LucideIcons).forEach((iconName) => {
  const OriginalIcon = (LucideIcons as any)[iconName]

  // Only wrap if it's a component (not types or other exports)
  if (typeof OriginalIcon === "function") {
    wrappedIcons[iconName] = React.forwardRef((props: IconProps, ref) => {
      const resolvedColor = useResolveIconColor(props.color)
      const resolvedStroke = useResolveIconColor(props.stroke as string)
      const resolvedFill = useResolveIconColor(props.fill)

      return (
        <OriginalIcon
          {...props}
          ref={ref}
          color={resolvedColor}
          stroke={resolvedStroke}
          fill={resolvedFill}
        />
      )
    })
    wrappedIcons[iconName].displayName = `Wrapped${iconName}`
  }
})

// Export all wrapped icons
export const {
  Activity,
  Airplay,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Anchor,
  Aperture,
  Archive,
  ArrowDown,
  ArrowDownCircle,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowLeftCircle,
  ArrowRight,
  ArrowRightCircle,
  ArrowUp,
  ArrowUpCircle,
  ArrowUpLeft,
  ArrowUpRight,
  AtSign,
  Award,
  BarChart,
  BarChart2,
  Battery,
  BatteryCharging,
  Bell,
  BellOff,
  Bluetooth,
  Bold,
  Book,
  BookOpen,
  Bookmark,
  Box,
  Briefcase,
  Calendar,
  Camera,
  CameraOff,
  Cast,
  Check,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUp,
  Chrome,
  Circle,
  CircleEllipsis,
  Clipboard,
  Clock,
  Cloud,
  CloudDrizzle,
  CloudLightning,
  CloudOff,
  CloudRain,
  CloudSnow,
  Code,
  Codepen,
  Codesandbox,
  Coffee,
  Coins,
  Columns,
  Command,
  Compass,
  Copy,
  CornerDownLeft,
  CornerDownRight,
  CornerLeftDown,
  CornerLeftUp,
  CornerRightDown,
  CornerRightUp,
  CornerUpLeft,
  CornerUpRight,
  Cpu,
  CreditCard,
  Crop,
  Crosshair,
  Database,
  Delete,
  Disc,
  DollarSign,
  Download,
  DownloadCloud,
  Droplet,
  Edit,
  Edit2,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Facebook,
  FastForward,
  Feather,
  Figma,
  File,
  FileText,
  Film,
  Filter,
  Flag,
  Folder,
  FolderMinus,
  FolderPlus,
  Framer,
  Frown,
  Gift,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Github,
  Gitlab,
  Glasses,
  Globe,
  Grid,
  HardDrive,
  Hash,
  Headphones,
  Heart,
  HelpCircle,
  Hexagon,
  Home,
  Image,
  Inbox,
  Info,
  Instagram,
  Italic,
  Key,
  Layers,
  Layout,
  LifeBuoy,
  Link,
  Link2,
  Linkedin,
  List,
  Loader,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Map,
  MapPin,
  Maximize,
  Maximize2,
  Meh,
  Menu,
  MessageCircle,
  MessageSquare,
  Mic,
  MicOff,
  Minimize,
  Minimize2,
  Minus,
  MinusCircle,
  MinusSquare,
  Monitor,
  Moon,
  MoreHorizontal,
  MoreVertical,
  MousePointer,
  Move,
  Music,
  Navigation,
  Navigation2,
  Octagon,
  Package,
  Paperclip,
  Pause,
  PauseCircle,
  PenTool,
  Percent,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  PieChart,
  Play,
  PlayCircle,
  Plus,
  PlusCircle,
  PlusSquare,
  Pocket,
  Power,
  Printer,
  Radio,
  RefreshCcw,
  RefreshCw,
  Repeat,
  Rewind,
  RotateCcw,
  RotateCw,
  Rss,
  Save,
  Scissors,
  Search,
  Send,
  Server,
  Settings,
  Share,
  Share2,
  Shield,
  ShieldOff,
  ShoppingBag,
  ShoppingCart,
  Shuffle,
  Sidebar,
  SkipBack,
  SkipForward,
  Slack,
  Slash,
  Sliders,
  Smartphone,
  Smile,
  Speaker,
  Square,
  Star,
  StopCircle,
  Sun,
  Sunrise,
  Sunset,
  Tablet,
  Tag,
  Target,
  Terminal,
  Thermometer,
  ThumbsDown,
  ThumbsUp,
  ToggleLeft,
  ToggleRight,
  Tool,
  Trash,
  Trash2,
  Trello,
  TrendingDown,
  TrendingUp,
  Triangle,
  Truck,
  Tv,
  Twitch,
  Twitter,
  Type,
  Umbrella,
  Underline,
  Unlock,
  Upload,
  UploadCloud,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  Users,
  Video,
  VideoOff,
  Voicemail,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
  Watch,
  Wifi,
  WifiOff,
  Wind,
  X,
  XCircle,
  XOctagon,
  XSquare,
  Youtube,
  Zap,
  ZapOff,
  ZoomIn,
  ZoomOut,
  Sparkles,
} = wrappedIcons

// Custom icons that don't exist in lucide-react-native
// Use Glasses as fallback for HatGlasses (incognito mode)
export const HatGlasses = wrappedIcons.Glasses || LucideIcons.Glasses

// Custom icons
export { WannathisIcon } from "./WannathisIcon"
