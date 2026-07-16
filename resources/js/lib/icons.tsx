import {
    LayoutDashboard,
    FolderKanban,
    FolderOpen,
    CalendarDays,
    Handshake,
    HardHat,
    Users,
    Truck,
    Package,
    Wallet,
    FileText,
    ClipboardList,
    ShieldCheck,
    ListChecks,
    MessageSquare,
    BarChart3,
    UserCog,
    Circle,
    type LucideIcon,
} from 'lucide-react';

/**
 * Maps the icon names stored in App\Support\Modules to lucide-react components.
 */
const iconMap: Record<string, LucideIcon> = {
    LayoutDashboard,
    FolderKanban,
    FolderOpen,
    CalendarDays,
    Handshake,
    HardHat,
    Users,
    Truck,
    Package,
    Wallet,
    FileText,
    ClipboardList,
    ShieldCheck,
    ListChecks,
    MessageSquare,
    BarChart3,
    UserCog,
};

export function moduleIcon(name: string): LucideIcon {
    return iconMap[name] ?? Circle;
}
