import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Warehouse,
  Package,
  Tag,
  Layers,
  Bike,
  Building2,
  ShoppingCart,
  PackageCheck,
  Wrench,
  CreditCard,
  Receipt,
  RefreshCcw,
  ClipboardCheck,
  Users,
  Shield,
  LogOut,
  Menu,
  Moon,
  Sun,
  Settings,
  Languages,
  Globe,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useTranslation } from "react-i18next";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const { t, i18n } = useTranslation();

  const isRtl = i18n.language === "ar";

  const toggleLanguage = () => {
    const next = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
  };

  const navItems = [
    { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard, roles: ["admin", "storekeeper", "technician", "sales"] },
    { href: "/warehouses", label: t("nav.warehouses"), icon: Warehouse, roles: ["admin", "storekeeper"] },
    { href: "/categories", label: t("nav.categories"), icon: Tag, roles: ["admin", "storekeeper"] },
    { href: "/subcategories", label: t("nav.subcategories"), icon: Layers, roles: ["admin", "storekeeper"] },
    { href: "/parts", label: t("nav.parts"), icon: Package, roles: ["admin", "storekeeper"] },
    { href: "/motorcycle-categories", label: t("nav.motorcycleCategories"), icon: Tag, roles: ["admin", "sales"] },
    { href: "/motorcycle-subcategories", label: t("nav.motorcycleSubcategories"), icon: Layers, roles: ["admin", "sales"] },
    { href: "/motorcycle-brands", label: t("nav.motorcycleBrands"), icon: Bike, roles: ["admin", "sales"] },
    { href: "/motorcycles", label: t("nav.motorcycles"), icon: Bike, roles: ["admin", "sales"] },
    { href: "/vendors", label: t("nav.vendors"), icon: Building2, roles: ["admin", "storekeeper"] },
    { href: "/purchase-orders", label: t("nav.purchaseOrders"), icon: ShoppingCart, roles: ["admin", "storekeeper"] },
    { href: "/grn", label: t("nav.grn"), icon: PackageCheck, roles: ["admin", "storekeeper"] },
    { href: "/work-orders", label: t("nav.workOrders"), icon: Wrench, roles: ["admin", "technician"] },
    { href: "/pos", label: t("nav.pos"), icon: CreditCard, roles: ["admin", "sales"] },
    { href: "/invoices", label: t("nav.invoices"), icon: Receipt, roles: ["admin", "sales"] },
    { href: "/returns", label: t("nav.returns"), icon: RefreshCcw, roles: ["admin", "sales"] },
    { href: "/inspections", label: t("nav.inspections"), icon: ClipboardCheck, roles: ["admin", "technician"] },
    { href: "/users", label: t("nav.users"), icon: Users, roles: ["admin"] },
    { href: "/audit", label: t("nav.auditLog"), icon: Shield, roles: ["admin"] },
    { href: "/website-cms", label: t("nav.websiteCms"), icon: Globe, roles: ["admin"] },
    { href: "/settings", label: t("nav.settings"), icon: Settings, roles: ["admin", "storekeeper", "technician", "sales"] },
  ];

  const filteredNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-6 py-6 bg-orange-500 text-white">
        <Bike className="h-8 w-8 shrink-0" />
        <span className="text-xl font-bold tracking-tight">MotoERP</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? "bg-orange-100 text-orange-600" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              } ${isRtl ? "flex-row-reverse text-right" : ""}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden ${isRtl ? "flex-row-reverse" : ""}`}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-white dark:bg-gray-950 border-r dark:border-gray-800">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-white dark:bg-gray-950 border-b dark:border-gray-800 shrink-0">
          <div className={`flex items-center md:hidden ${isRtl ? "flex-row-reverse" : ""}`}>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={isRtl ? "right" : "left"} className="p-0 w-64">
                <Sidebar />
              </SheetContent>
            </Sheet>
            <span className={`${isRtl ? "mr-3" : "ml-3"} text-lg font-bold text-orange-600`}>MotoERP</span>
          </div>

          <div className="flex-1" />

          <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
            <div className={`hidden sm:block ${isRtl ? "text-right" : "text-left"}`}>
              <p className="text-sm font-medium leading-none dark:text-gray-100">{user?.fullName}</p>
              <Badge variant="secondary" className="mt-1 text-[10px] uppercase">
                {user?.role}
              </Badge>
            </div>

            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              title={t("common.language")}
              className="gap-1.5 text-xs font-semibold px-2"
            >
              <Languages className="h-4 w-4 text-orange-500" />
              {i18n.language === "ar" ? "EN" : "عربي"}
            </Button>

            {/* Theme toggle */}
            <Button variant="ghost" size="icon" onClick={toggleTheme} title={t("common.toggleTheme")}>
              {theme === "dark"
                ? <Sun className="h-5 w-5 text-yellow-400" />
                : <Moon className="h-5 w-5 text-gray-500" />}
            </Button>

            {/* Logout */}
            <Button variant="ghost" size="icon" onClick={logout} title={t("common.logout")}>
              <LogOut className="h-5 w-5 text-gray-500" />
            </Button>
          </div>
        </header>

        {/* Main content */}
        <main className={`flex-1 overflow-y-auto p-4 md:p-8 ${isRtl ? "text-right" : "text-left"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
