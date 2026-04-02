import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Moon, Sun, Globe, Menu, X } from "lucide-react";
import { useTheme } from "./theme-provider";
import { useSiteSettings } from "@/lib/api";
import { useState } from "react";
import { Button } from "./ui/button";

export function Header() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { data: settings } = useSiteSettings();
  const [location] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isArabic = i18n.language === "ar";
  const companyName = isArabic
    ? settings?.company_name_ar || "MotoWebsite"
    : settings?.company_name_en || "MotoWebsite";

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "ar" : "en";
    i18n.changeLanguage(newLang);
  };

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/showroom", label: t("nav.showroom") },
    { href: "/about", label: t("nav.about") },
    { href: "/contact", label: t("nav.contact") },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-8">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-black text-xl text-primary md:inline-block">
              {companyName}
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors hover:text-foreground/80 ${
                  location === link.href ? "text-foreground" : "text-foreground/60"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <button
          className="inline-flex items-center justify-center rounded-md p-2.5 text-foreground/60 hover:text-foreground md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <span className="sr-only">Toggle menu</span>
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
          </div>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleLanguage} aria-label="Toggle language">
              <Globe className="h-5 w-5" />
              <span className="sr-only">Toggle language</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Link href="/signin">
              <Button size="sm" variant="outline">{t("nav.signin")}</Button>
            </Link>
          </nav>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="border-b border-border bg-background p-4 md:hidden">
          <nav className="flex flex-col space-y-4">
            <Link href="/" className="text-xl font-bold text-primary mb-4">
              {companyName}
            </Link>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={`text-lg transition-colors hover:text-primary ${
                  location === link.href ? "text-primary font-bold" : "text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}