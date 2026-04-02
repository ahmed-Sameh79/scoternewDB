import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Search, Filter, X, Zap, Gauge, Fuel, Weight, ArrowUpDown, Bike } from "lucide-react";
import { useParts, useMotorcycles, useCategories, useMotorcycleBrands, formatCurrency, getImageUrl } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Motorcycle = {
  id: number;
  make: string;
  model: string;
  year: number;
  color?: string;
  engineSize?: string;
  sellingPrice: string | number;
  status: string;
  condition: string;
  imageUrl?: string;
  brandId?: number;
  brandName?: string;
  motorcycleSubcategoryId?: number;
  subcategoryName?: string;
  engineCc?: number;
  topSpeed?: number;
  fuelCapacity?: string | number;
  weight?: number;
  seatHeight?: number;
  transmission?: string;
  fuelType?: string;
  features?: string;
};

function SpecRow({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value?: string | number | null; unit?: string }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className="text-primary w-5 flex-shrink-0">{icon}</div>
      <span className="text-sm text-muted-foreground flex-1">{label}</span>
      <span className="text-sm font-semibold tabular-nums">
        {value}{unit ? <span className="text-muted-foreground font-normal ml-1">{unit}</span> : ""}
      </span>
    </div>
  );
}

function MotorcycleDetailModal({ moto, open, onClose }: { moto: Motorcycle | null; open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  if (!moto) return null;

  const hasSpecs = moto.engineCc || moto.topSpeed || moto.fuelCapacity || moto.weight || moto.seatHeight || moto.transmission || moto.fuelType;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0" dir={isRtl ? "rtl" : "ltr"}>
        <div className="relative">
          <div className="aspect-video bg-zinc-900 overflow-hidden">
            <img
              src={getImageUrl(moto.imageUrl)}
              alt={moto.model}
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-5 right-5">
              <div className="flex items-center gap-2 mb-1">
                {moto.brandName && (
                  <Badge className="bg-primary text-white uppercase text-xs font-bold border-none rounded-none">
                    {moto.brandName}
                  </Badge>
                )}
                <Badge className={`uppercase text-xs font-bold border-none rounded-none ${moto.condition === "new" ? "bg-emerald-500" : "bg-amber-500"} text-white`}>
                  {moto.condition === "new" ? t("showroom.new") : t("showroom.used")}
                </Badge>
              </div>
              <h2 className="text-white text-2xl font-black">{moto.year} {moto.brandName} {moto.model}</h2>
              {moto.color && <p className="text-zinc-300 text-sm mt-0.5">{moto.color}</p>}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-black text-primary font-mono">{formatCurrency(moto.sellingPrice)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("showroom.selling_price")}</p>
            </div>
            <Badge className={`text-sm px-3 py-1 rounded-none font-bold ${
              moto.status === "available" ? "bg-green-500 text-white" :
              moto.status === "sold" ? "bg-red-500 text-white" :
              "bg-zinc-500 text-white"
            }`}>
              {moto.status === "available" ? t("showroom.available") :
               moto.status === "sold" ? t("showroom.sold") :
               moto.status}
            </Badge>
          </div>

          {hasSpecs && (
            <>
              <Separator />
              <div>
                <h3 className="font-bold uppercase tracking-wider text-sm mb-3 flex items-center gap-2">
                  <Bike className="h-4 w-4 text-primary" />
                  {t("showroom.specifications")}
                </h3>
                <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                  <SpecRow icon={<Zap className="h-4 w-4" />} label={t("showroom.spec_engine_cc")} value={moto.engineCc} unit="CC" />
                  <SpecRow icon={<Gauge className="h-4 w-4" />} label={t("showroom.spec_top_speed")} value={moto.topSpeed} unit="km/h" />
                  <SpecRow icon={<Fuel className="h-4 w-4" />} label={t("showroom.spec_fuel_capacity")} value={moto.fuelCapacity ? parseFloat(String(moto.fuelCapacity)).toFixed(1) : undefined} unit="L" />
                  <SpecRow icon={<Weight className="h-4 w-4" />} label={t("showroom.spec_weight")} value={moto.weight} unit="kg" />
                  <SpecRow icon={<ArrowUpDown className="h-4 w-4" />} label={t("showroom.spec_seat_height")} value={moto.seatHeight} unit="mm" />
                  <SpecRow icon={<ArrowUpDown className="h-4 w-4" />} label={t("showroom.spec_transmission")} value={moto.transmission} />
                  <SpecRow icon={<Fuel className="h-4 w-4" />} label={t("showroom.spec_fuel_type")} value={moto.fuelType} />
                  {moto.engineSize && <SpecRow icon={<Zap className="h-4 w-4" />} label={t("showroom.spec_engine_size")} value={moto.engineSize} />}
                </div>
              </div>
            </>
          )}

          {moto.features && (
            <>
              <Separator />
              <div>
                <h3 className="font-bold uppercase tracking-wider text-sm mb-3">{t("showroom.features")}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{moto.features}</p>
              </div>
            </>
          )}

          {moto.subcategoryName && (
            <p className="text-xs text-muted-foreground">
              {t("showroom.category")}: <span className="font-medium text-foreground">{moto.subcategoryName}</span>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MotorcycleCard({ item, onClick }: { item: Motorcycle; onClick: () => void }) {
  return (
    <Card
      className="group overflow-hidden rounded-none border-zinc-200 dark:border-zinc-800 transition-all hover:border-primary cursor-pointer"
      onClick={onClick}
    >
      <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden">
        <img
          src={getImageUrl(item.imageUrl)}
          alt={item.model}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <Badge className="bg-zinc-900 text-white uppercase text-xs font-bold border-none rounded-none">{item.brandName}</Badge>
        </div>
        {item.condition && (
          <Badge className="absolute top-3 right-3 bg-primary text-white uppercase text-xs font-bold border-none rounded-none">
            {item.condition}
          </Badge>
        )}
        {(item.engineCc || item.topSpeed) && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-3 py-1.5 flex gap-3 text-white text-xs">
            {item.engineCc && <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-primary" />{item.engineCc}cc</span>}
            {item.topSpeed && <span className="flex items-center gap-1"><Gauge className="h-3 w-3 text-primary" />{item.topSpeed} km/h</span>}
          </div>
        )}
      </div>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground mb-1 font-mono">{item.year}</p>
        <h3 className="font-bold text-lg mb-3 line-clamp-2">{item.model}</h3>
        <div className="flex items-center justify-between mt-auto">
          <p className="font-mono text-2xl font-black text-primary">{formatCurrency(item.sellingPrice)}</p>
          {item.transmission && <p className="text-xs text-muted-foreground">{item.transmission}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Showroom() {
  const { t } = useTranslation();
  const { data: parts, isLoading: partsLoading } = useParts();
  const { data: motorcycles, isLoading: motosLoading } = useMotorcycles();
  const { data: categories } = useCategories();
  const { data: brands } = useMotorcycleBrands();

  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedMoto, setSelectedMoto] = useState<Motorcycle | null>(null);

  const filteredMotos: Motorcycle[] = (motorcycles as Motorcycle[] | undefined)?.filter((m) => {
    if (search && !m.model.toLowerCase().includes(search.toLowerCase()) && !m.make?.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedBrand !== "all" && m.brandId?.toString() !== selectedBrand) return false;
    return true;
  }) || [];

  const filteredParts = (parts as any[] | undefined)?.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedCategory !== "all" && p.categoryId?.toString() !== selectedCategory) return false;
    return true;
  }) || [];

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4 md:px-8 max-w-screen-2xl border-none">

        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">{t("showroom.title")}</h1>
          <div className="h-1 w-24 bg-primary mb-8"></div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder={t("showroom.search")}
                className="pl-10 h-12 text-base bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <div className="flex gap-4">
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="w-[180px] h-12 bg-background">
                  <SelectValue placeholder={t("showroom.all_brands")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("showroom.all_brands")}</SelectItem>
                  {(brands as any[])?.map((brand: any) => (
                    <SelectItem key={`brand-${brand.id}`} value={brand.id.toString()}>{brand.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px] h-12 bg-background">
                  <SelectValue placeholder={t("showroom.all_categories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("showroom.all_categories")}</SelectItem>
                  {(categories as any[])?.map((cat: any) => (
                    <SelectItem key={`cat-${cat.id}`} value={cat.id.toString()}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="h-12 bg-zinc-100 dark:bg-zinc-900 border mb-8 p-1">
            <TabsTrigger value="all" className="px-6 h-full uppercase tracking-wider font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All Inventory</TabsTrigger>
            <TabsTrigger value="motorcycles" className="px-6 h-full uppercase tracking-wider font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Motorcycles</TabsTrigger>
            <TabsTrigger value="parts" className="px-6 h-full uppercase tracking-wider font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Parts</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="m-0 border-none outline-none">
            {motosLoading || partsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredMotos.length === 0 && filteredParts.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <Filter className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg">{t("showroom.no_results")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredMotos.map((item) => (
                  <MotorcycleCard key={`moto-${item.id}`} item={item} onClick={() => setSelectedMoto(item)} />
                ))}
                {(filteredParts as any[]).map((item: any) => (
                  <Card key={`part-${item.id}`} className="group overflow-hidden rounded-none border-zinc-200 dark:border-zinc-800 transition-all hover:border-primary">
                    <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden p-6 flex items-center justify-center">
                      <img
                        src={getImageUrl(item.imageUrl)}
                        alt={item.name}
                        className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-xl"
                      />
                      <Badge variant="outline" className="absolute top-3 left-3 bg-background/80 backdrop-blur uppercase text-[10px] font-bold border-none tracking-wider rounded-none">
                        Part
                      </Badge>
                      {item.quantityOnHand <= 0 && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10">
                          <Badge variant="destructive" className="uppercase font-bold tracking-widest px-4 py-2 text-sm rounded-none">{t("showroom.out_of_stock")}</Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5 flex flex-col h-[140px]">
                      <p className="text-xs text-muted-foreground mb-1 uppercase font-mono">{item.sku}</p>
                      <h3 className="font-bold text-base mb-2 line-clamp-2 leading-snug flex-1">{item.name}</h3>
                      <div className="flex items-center justify-between mt-auto">
                        <p className="font-mono text-xl font-black text-primary">{formatCurrency(item.sellingPrice)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="motorcycles" className="m-0 border-none outline-none">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredMotos.map((item) => (
                <MotorcycleCard key={`moto-tab-${item.id}`} item={item} onClick={() => setSelectedMoto(item)} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="parts" className="m-0 border-none outline-none">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {(filteredParts as any[]).map((item: any) => (
                <Card key={`part-tab-${item.id}`} className="group overflow-hidden rounded-none border-zinc-200 dark:border-zinc-800 transition-all hover:border-primary">
                  <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden p-6 flex items-center justify-center">
                    <img
                      src={getImageUrl(item.imageUrl)}
                      alt={item.name}
                      className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-xl"
                    />
                    <Badge variant="outline" className="absolute top-3 left-3 bg-background/80 backdrop-blur uppercase text-[10px] font-bold border-none tracking-wider rounded-none">
                      Part
                    </Badge>
                  </div>
                  <CardContent className="p-5 flex flex-col h-[140px]">
                    <p className="text-xs text-muted-foreground mb-1 uppercase font-mono">{item.sku}</p>
                    <h3 className="font-bold text-base mb-2 line-clamp-2 leading-snug flex-1">{item.name}</h3>
                    <p className="font-mono text-xl font-black text-primary mt-auto">{formatCurrency(item.sellingPrice)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <MotorcycleDetailModal
        moto={selectedMoto}
        open={!!selectedMoto}
        onClose={() => setSelectedMoto(null)}
      />
    </div>
  );
}
