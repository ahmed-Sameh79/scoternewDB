import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useSiteSettings, useParts, useMotorcycles, useMotorcycleBrands, formatCurrency, getImageUrl } from "@/lib/api";
import { ArrowRight, Wrench, Settings, Search } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { t, i18n } = useTranslation();
  const { data: settings } = useSiteSettings();
  const { data: parts } = useParts();
  const { data: motorcycles } = useMotorcycles();
  const { data: brands } = useMotorcycleBrands();
  
  const [selectedBrand, setSelectedBrand] = useState<string>("");

  const isArabic = i18n.language === "ar";
  
  const title = isArabic ? settings?.hero_title_ar : settings?.hero_title_en;
  const subtitle = isArabic ? settings?.hero_subtitle_ar : settings?.hero_subtitle_en;
  
  const featuredParts = parts?.slice(0, 4) || [];
  const featuredMotorcycles = motorcycles?.slice(0, 4) || [];

  const partsForBrand = selectedBrand ? parts?.filter(p => p.categoryId === selectedBrand /* Approximation for mock */) : [];
  const hasParts = partsForBrand && partsForBrand.length > 0;

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative w-full h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/hero.svg" 
            alt="Motorcycle Showroom" 
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-zinc-950/80 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
        
        <div className="container relative z-10 mx-auto px-4 md:px-8 max-w-screen-2xl">
          <div className="max-w-3xl">
            <Badge className="bg-primary/20 text-primary hover:bg-primary/30 mb-6 border-primary/50 uppercase tracking-widest text-xs px-3 py-1">
              Premium Performance
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight leading-[1.1]">
              {title || "Unleash Your Machine"}
            </h1>
            <p className="text-xl text-zinc-300 mb-10 max-w-2xl leading-relaxed">
              {subtitle || "Premium parts and service for serious riders. If it burns gas, we make it faster."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/showroom">
                <Button size="lg" className="h-14 px-8 text-base font-bold uppercase tracking-wider w-full sm:w-auto">
                  {t("nav.showroom")} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Compatibility Checker */}
      <section className="py-24 bg-zinc-100 dark:bg-zinc-900 border-y">
        <div className="container mx-auto px-4 md:px-8 max-w-screen-2xl">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-4">
              {t("home.compatibility_checker")}
            </h2>
            <p className="text-muted-foreground text-lg">
              Find exactly what you need for your specific make and model.
            </p>
          </div>
          
          <Card className="max-w-4xl mx-auto shadow-2xl border-none">
            <CardContent className="p-8 md:p-12 flex flex-col md:flex-row items-center gap-6">
              <div className="w-full md:w-2/3">
                <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                  <SelectTrigger className="h-14 text-lg bg-background">
                    <SelectValue placeholder={t("home.select_brand")} />
                  </SelectTrigger>
                  <SelectContent>
                    {brands?.map((brand: any) => (
                      <SelectItem key={brand.id} value={brand.id.toString()}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-1/3">
                <Button className="w-full h-14 text-lg font-bold" onClick={() => {}}>
                  <Search className="mr-2 h-5 w-5" /> {t("home.check_parts")}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {selectedBrand && (
            <div className="max-w-4xl mx-auto mt-8 text-center animate-in fade-in slide-in-from-bottom-4">
              {hasParts ? (
                <div className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold text-lg bg-emerald-100 dark:bg-emerald-950/50 px-6 py-3 rounded-full">
                  <Wrench className="mr-2 h-5 w-5" /> {t("home.parts_available")}
                </div>
              ) : (
                <div className="inline-flex items-center text-muted-foreground font-medium text-lg px-6 py-3">
                  {t("home.no_parts")}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-8 max-w-screen-2xl">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4">
                {t("home.featured_products")}
              </h2>
              <div className="h-1 w-24 bg-primary"></div>
            </div>
            <Link href="/showroom">
              <Button variant="ghost" className="font-bold uppercase tracking-wider hidden md:flex">
                {t("home.view_all")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredMotorcycles.map((item: any) => (
              <Link key={`moto-${item.id}`} href="/showroom">
                <Card className="group overflow-hidden cursor-pointer border-zinc-200 dark:border-zinc-800 transition-all hover:border-primary hover:shadow-xl hover:shadow-primary/5">
                  <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden">
                    <img 
                      src={getImageUrl(item.imageUrl)} 
                      alt={item.model} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                      <Badge className="bg-zinc-900 text-white uppercase text-xs font-bold border-none">
                        {item.brandName}
                      </Badge>
                      <Badge variant="outline" className="bg-background/80 backdrop-blur font-mono text-xs uppercase border-none">
                        {item.year}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-5">
                    <h3 className="font-bold text-lg mb-2 line-clamp-1 group-hover:text-primary transition-colors">{item.model}</h3>
                    <p className="font-mono text-xl font-bold text-primary">{formatCurrency(item.sellingPrice)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
            
            {featuredParts.map((item: any) => (
              <Link key={`part-${item.id}`} href="/showroom">
                <Card className="group overflow-hidden cursor-pointer border-zinc-200 dark:border-zinc-800 transition-all hover:border-primary hover:shadow-xl hover:shadow-primary/5">
                  <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden p-6 flex items-center justify-center">
                    <img 
                      src={getImageUrl(item.imageUrl)} 
                      alt={item.name} 
                      className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-xl"
                    />
                    <Badge variant="outline" className="absolute top-3 left-3 bg-background/80 backdrop-blur uppercase text-[10px] font-bold border-none tracking-wider">
                      Part
                    </Badge>
                  </div>
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground mb-1 uppercase font-mono">{item.sku}</p>
                    <h3 className="font-bold text-base mb-2 line-clamp-1 group-hover:text-primary transition-colors">{item.name}</h3>
                    <p className="font-mono text-xl font-bold text-primary">{formatCurrency(item.sellingPrice)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          
          <div className="mt-8 md:hidden">
            <Link href="/showroom">
              <Button variant="outline" className="w-full font-bold uppercase tracking-wider">
                {t("home.view_all")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* App Download */}
      {(settings?.google_play_url || settings?.app_store_url) && (
        <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 opacity-10 pointer-events-none">
            <Settings className="w-96 h-96 animate-[spin_60s_linear_infinite]" />
          </div>
          <div className="container relative z-10 mx-auto px-4 md:px-8 max-w-screen-2xl text-center">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-6">
              {t("home.download_app")}
            </h2>
            <p className="text-xl md:text-2xl mb-10 max-w-2xl mx-auto opacity-90">
              {t("home.app_desc")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {settings?.google_play_url && (
                <a href={settings.google_play_url} target="_blank" rel="noreferrer">
                  <Button size="lg" variant="secondary" className="h-14 px-8 text-base font-bold uppercase tracking-wider w-full sm:w-auto text-primary">
                    Google Play
                  </Button>
                </a>
              )}
              {settings?.app_store_url && (
                <a href={settings.app_store_url} target="_blank" rel="noreferrer">
                  <Button size="lg" variant="secondary" className="h-14 px-8 text-base font-bold uppercase tracking-wider w-full sm:w-auto text-primary">
                    App Store
                  </Button>
                </a>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}