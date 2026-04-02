import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Warehouse as WarehouseIcon, Plus, MapPin, ChevronRight, ChevronDown, Grid3X3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const warehouseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  location: z.string().min(1, "Location is required"),
});

const binSchema = z.object({
  warehouse_id: z.string().min(1, "Warehouse is required"),
  zone: z.string().min(1, "Zone is required"),
  aisle: z.string().min(1, "Aisle is required"),
  shelf: z.string().min(1, "Shelf is required"),
  bin: z.string().min(1, "Bin is required"),
});

interface BinRecord {
  id: number;
  warehouse_id: number;
  zone: string;
  aisle: string;
  shelf: string;
  bin: string;
  label: string;
}

interface ZoneTree {
  [zone: string]: { [aisle: string]: { [shelf: string]: BinRecord[] } };
}

function buildZoneTree(bins: BinRecord[]): ZoneTree {
  const tree: ZoneTree = {};
  for (const b of bins) {
    if (!tree[b.zone]) tree[b.zone] = {};
    if (!tree[b.zone][b.aisle]) tree[b.zone][b.aisle] = {};
    if (!tree[b.zone][b.aisle][b.shelf]) tree[b.zone][b.aisle][b.shelf] = [];
    tree[b.zone][b.aisle][b.shelf].push(b);
  }
  return tree;
}

function BinTree({ bins }: { bins: BinRecord[] }) {
  const [openZones, setOpenZones] = useState<Record<string, boolean>>({});
  const [openAisles, setOpenAisles] = useState<Record<string, boolean>>({});
  const tree = buildZoneTree(bins);
  const zones = Object.keys(tree).sort();
  if (bins.length === 0) {
    return <p className="text-center text-muted-foreground py-4 text-sm">No bins configured for this warehouse.</p>;
  }
  const toggleZone = (zone: string) => setOpenZones(p => ({ ...p, [zone]: !p[zone] }));
  const toggleAisle = (key: string) => setOpenAisles(p => ({ ...p, [key]: !p[key] }));
  return (
    <div className="space-y-2">
      {zones.map(zone => {
        const aisles = Object.keys(tree[zone]).sort();
        const zoneBinCount = aisles.reduce((s, a) => s + Object.values(tree[zone][a]).reduce((ss, bs) => ss + bs.length, 0), 0);
        const zoneOpen = openZones[zone] !== false;
        return (
          <div key={zone} className="border rounded-md overflow-hidden">
            <button type="button" className="w-full flex items-center justify-between px-3 py-2 bg-orange-50 hover:bg-orange-100 transition-colors text-sm font-semibold" onClick={() => toggleZone(zone)}>
              <span className="flex items-center gap-2">
                {zoneOpen ? <ChevronDown className="h-4 w-4 text-orange-600" /> : <ChevronRight className="h-4 w-4 text-orange-600" />}
                <Grid3X3 className="h-4 w-4 text-orange-600" /> Zone {zone}
              </span>
              <Badge variant="outline" className="text-xs">{zoneBinCount} bins</Badge>
            </button>
            {zoneOpen && (
              <div className="pl-4 py-1 space-y-1">
                {aisles.map(aisle => {
                  const shelves = Object.keys(tree[zone][aisle]).sort();
                  const aisleKey = `${zone}-${aisle}`;
                  const aisleOpen = openAisles[aisleKey] !== false;
                  const aisleBinCount = shelves.reduce((s, sh) => s + tree[zone][aisle][sh].length, 0);
                  return (
                    <div key={aisle} className="border-l-2 border-orange-200 pl-2">
                      <button type="button" className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded text-sm" onClick={() => toggleAisle(aisleKey)}>
                        <span className="flex items-center gap-2 text-muted-foreground">
                          {aisleOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Aisle {aisle}
                        </span>
                        <span className="text-xs text-muted-foreground">{aisleBinCount} bins</span>
                      </button>
                      {aisleOpen && (
                        <div className="pl-4 py-1 space-y-1">
                          {shelves.map(shelf => {
                            const binsInShelf = tree[zone][aisle][shelf];
                            return (
                              <div key={shelf} className="border-l-2 border-gray-200 pl-2">
                                <p className="text-xs text-muted-foreground px-2 py-1 font-medium">Shelf {shelf}</p>
                                <div className="flex flex-wrap gap-1 px-2 pb-2">
                                  {binsInShelf.map(b => (
                                    <Badge key={b.id} variant="outline" className="font-mono text-xs cursor-default">{b.label}</Badge>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function WarehousesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const [isAddBinOpen, setIsAddBinOpen] = useState(false);

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ["/warehouses"],
    queryFn: async () => {
      const { data: wh, error: whError } = await supabase.from("warehouses").select("*").order("name");
      if (whError) throw new Error(whError.message);
      const { data: bins } = await supabase.from("bins").select("warehouse_id");
      const binCounts: Record<number, number> = {};
      for (const b of bins ?? []) { binCounts[b.warehouse_id] = (binCounts[b.warehouse_id] ?? 0) + 1; }
      return (wh ?? []).map(w => ({ ...w, binCount: binCounts[w.id] ?? 0 }));
    },
  });

  const { data: bins, isLoading: isBinsLoading } = useQuery({
    queryKey: ["/bins", selectedWarehouseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bins").select("*").eq("warehouse_id", selectedWarehouseId!).order("label");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!selectedWarehouseId,
  });

  const warehouseForm = useForm<z.infer<typeof warehouseSchema>>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: { name: "", location: "" },
  });

  const binForm = useForm<z.infer<typeof binSchema>>({
    resolver: zodResolver(binSchema),
    defaultValues: { warehouse_id: selectedWarehouseId ? String(selectedWarehouseId) : "", zone: "", aisle: "", shelf: "", bin: "" },
  });

  const createWarehouseMutation = useMutation({
    mutationFn: async (values: z.infer<typeof warehouseSchema>) => {
      const { error } = await supabase.from("warehouses").insert(values);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/warehouses"] });
      toast.success("Warehouse created");
      setIsAddWarehouseOpen(false);
      warehouseForm.reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createBinMutation = useMutation({
    mutationFn: async (values: z.infer<typeof binSchema>) => {
      const label = `${values.zone}-${values.aisle}-${values.shelf}-${values.bin}`;
      const { error } = await supabase.from("bins").insert({
        warehouse_id: parseInt(values.warehouse_id),
        zone: values.zone,
        aisle: values.aisle,
        shelf: values.shelf,
        bin: values.bin,
        label,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/bins"] });
      queryClient.invalidateQueries({ queryKey: ["/warehouses"] });
      toast.success("Bin created");
      setIsAddBinOpen(false);
      binForm.reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedWarehouse = warehouses?.find(w => w.id === selectedWarehouseId);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("warehouses.title")}</h1>
          <p className="text-muted-foreground">{t("warehouses.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddBinOpen} onOpenChange={setIsAddBinOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="h-4 w-4 mr-2" /> {t("warehouses.addBin")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("warehouses.addNewBin")}</DialogTitle></DialogHeader>
              <Form {...binForm}>
                <form onSubmit={binForm.handleSubmit(v => createBinMutation.mutate(v))} className="space-y-4">
                  <FormField control={binForm.control} name="warehouse_id" render={({ field }) => (
                    <FormItem><FormLabel>{t("parts.warehouse")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t("parts.warehouse")} /></SelectTrigger></FormControl>
                        <SelectContent>{warehouses?.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={binForm.control} name="zone" render={({ field }) => (
                      <FormItem><FormLabel>{t("warehouses.zone")}</FormLabel><FormControl><Input placeholder="A" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={binForm.control} name="aisle" render={({ field }) => (
                      <FormItem><FormLabel>{t("warehouses.aisle")}</FormLabel><FormControl><Input placeholder="01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={binForm.control} name="shelf" render={({ field }) => (
                      <FormItem><FormLabel>{t("warehouses.shelf")}</FormLabel><FormControl><Input placeholder="02" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={binForm.control} name="bin" render={({ field }) => (
                      <FormItem><FormLabel>{t("warehouses.bin")}</FormLabel><FormControl><Input placeholder="003" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <p className="text-xs text-muted-foreground">Bin code will be: <span className="font-mono">{[binForm.watch("zone"), binForm.watch("aisle"), binForm.watch("shelf"), binForm.watch("bin")].filter(Boolean).join("-") || "Zone-Aisle-Shelf-Bin"}</span></p>
                  <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={createBinMutation.isPending}>{t("warehouses.createBin")}</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddWarehouseOpen} onOpenChange={setIsAddWarehouseOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600"><Plus className="h-4 w-4 mr-2" /> {t("warehouses.addWarehouse")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("warehouses.addNewWarehouse")}</DialogTitle></DialogHeader>
              <Form {...warehouseForm}>
                <form onSubmit={warehouseForm.handleSubmit(v => createWarehouseMutation.mutate(v))} className="space-y-4">
                  <FormField control={warehouseForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>{t("warehouses.name")}</FormLabel><FormControl><Input placeholder="Main Warehouse" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={warehouseForm.control} name="location" render={({ field }) => (
                    <FormItem><FormLabel>{t("warehouses.location")}</FormLabel><FormControl><Input placeholder="Kuala Lumpur" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={createWarehouseMutation.isPending}>{t("warehouses.createWarehouse")}</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading
          ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
          : warehouses?.map(w => (
            <Card
              key={w.id}
              className={`cursor-pointer transition-all ${selectedWarehouseId === w.id ? "ring-2 ring-orange-500 shadow-md" : "hover:shadow-sm"}`}
              onClick={() => setSelectedWarehouseId(w.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="bg-orange-100 p-2 rounded-lg"><WarehouseIcon className="h-5 w-5 text-orange-600" /></div>
                  <Badge variant="outline">{w.binCount} Bins</Badge>
                </div>
                <CardTitle className="mt-2">{w.name}</CardTitle>
                <CardDescription className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {w.location}</CardDescription>
              </CardHeader>
            </Card>
          ))
        }
      </div>

      {selectedWarehouseId && selectedWarehouse && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("warehouses.storageTree")} — {selectedWarehouse.name}</CardTitle>
              <CardDescription>Zone → Aisle → Shelf → Bin hierarchy. Click zones to expand/collapse.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isBinsLoading ? <Skeleton className="h-32 w-full" /> : <BinTree bins={bins ?? []} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
