import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Edit, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { ImageUpload } from "@/components/ImageUpload";

const partSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  condition: z.enum(["new", "used"]),
  category_id: z.number().optional().nullable(),
  subcategory_id: z.number().optional().nullable(),
  quantity_on_hand: z.number().min(0),
  reorder_point: z.number().min(0),
  cost_price: z.number().min(0),
  selling_price: z.number().min(0),
  warehouse_id: z.number().optional().nullable(),
  bin_id: z.number().optional().nullable(),
  image_url: z.string().nullable().optional(),
});
type PartFormValues = z.infer<typeof partSchema>;

function mapPart(p: any) {
  return {
    ...p,
    sku: p.sku,
    name: p.name,
    imageUrl: p.image_url,
    subcategoryId: p.subcategory_id,
    subcategoryName: p.subcategories?.name ?? null,
    categoryName: p.subcategories?.categories?.name ?? null,
    quantityOnHand: p.quantity_on_hand,
    reorderPoint: p.reorder_point,
    costPrice: p.cost_price,
    sellingPrice: p.selling_price,
    warehouseId: p.warehouse_id,
    warehouseName: p.warehouses?.name ?? null,
    binId: p.bin_id,
    binLabel: p.bins?.label ?? null,
  };
}

export default function PartsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<any | null>(null);

  const { data: parts, isLoading } = useQuery({
    queryKey: ["/parts", search],
    queryFn: async () => {
      let q = supabase
        .from("parts")
        .select("*, subcategories(name, category_id, categories(name)), warehouses(name), bins(label)")
        .order("name");
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapPart);
    },
  });

  const { data: warehouses } = useQuery({
    queryKey: ["/warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: bins } = useQuery({
    queryKey: ["/bins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bins").select("id, label, warehouse_id").order("label");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["/categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: subcategories } = useQuery({
    queryKey: ["/subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subcategories").select("id, name, category_id").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const form = useForm<PartFormValues>({
    resolver: zodResolver(partSchema),
    defaultValues: {
      sku: "", name: "", condition: "new", category_id: null, subcategory_id: null,
      quantity_on_hand: 0, reorder_point: 5, cost_price: 0, selling_price: 0,
      warehouse_id: null, bin_id: null, image_url: null,
    },
  });

  const selectedWarehouseId = form.watch("warehouse_id");
  const selectedCategoryId = form.watch("category_id");
  const filteredBins = bins?.filter((b: any) => b.warehouse_id === selectedWarehouseId) ?? [];
  const filteredSubcategories = subcategories?.filter((s: any) => s.category_id === selectedCategoryId) ?? [];

  useEffect(() => { form.setValue("bin_id", null); }, [selectedWarehouseId]);
  useEffect(() => { form.setValue("subcategory_id", null); }, [selectedCategoryId]);

  const createMutation = useMutation({
    mutationFn: async (values: PartFormValues) => {
      const { category_id, ...rest } = values;
      const { error } = await supabase.from("parts").insert(rest);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/parts"] });
      toast.success(t("parts.partCreated"));
      setIsAddOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: PartFormValues) => {
      const { category_id, ...rest } = values;
      const { error } = await supabase.from("parts").update(rest).eq("id", editingPart!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/parts"] });
      toast.success(t("parts.partUpdated"));
      setEditingPart(null);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("parts").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/parts"] });
      toast.success(t("parts.partDeleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = (values: PartFormValues) => {
    if (editingPart) updateMutation.mutate(values);
    else createMutation.mutate(values);
  };

  const startEdit = (part: any) => {
    setEditingPart(part);
    const sub = subcategories?.find((s: any) => s.id === part.subcategoryId);
    form.reset({
      sku: part.sku, name: part.name, description: part.description ?? "",
      condition: part.condition, category_id: sub?.category_id ?? null,
      subcategory_id: part.subcategoryId ?? null,
      quantity_on_hand: part.quantityOnHand, reorder_point: part.reorderPoint,
      cost_price: parseFloat(part.costPrice), selling_price: parseFloat(part.sellingPrice),
      warehouse_id: part.warehouseId ?? null, bin_id: part.binId ?? null, image_url: part.imageUrl ?? null,
    });
  };

  const closeDialog = () => { setIsAddOpen(false); setEditingPart(null); form.reset(); };

  const getSubcategoryLabel = (part: any) => {
    if (part.subcategoryName) return part.categoryName ? `${part.categoryName} › ${part.subcategoryName}` : part.subcategoryName;
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("parts.title")}</h1>
          <p className="text-muted-foreground">{t("parts.subtitle")}</p>
        </div>
        <Dialog open={isAddOpen || !!editingPart} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsAddOpen(true)} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />{t("parts.addPart")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingPart ? t("parts.editPart") : t("parts.addPart")}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="sku" render={({ field }) => (
                    <FormItem><FormLabel>{t("parts.sku")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>{t("parts.partName")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="category_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("parts.category")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></FormLabel>
                      <Select onValueChange={v => field.onChange(v === "none" ? null : parseInt(v))} value={field.value != null ? String(field.value) : "none"}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t("subcategories.selectCategory")} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">— {t("parts.noSubcategory")}</SelectItem>
                          {categories?.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="subcategory_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("parts.subcategory")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></FormLabel>
                      <Select onValueChange={v => field.onChange(v === "none" ? null : parseInt(v))} value={field.value != null ? String(field.value) : "none"} disabled={!selectedCategoryId}>
                        <FormControl><SelectTrigger><SelectValue placeholder={selectedCategoryId ? t("parts.selectSubcategory") : t("parts.selectCategoryFirst")} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">— {t("parts.noSubcategory")}</SelectItem>
                          {filteredSubcategories.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="condition" render={({ field }) => (
                    <FormItem><FormLabel>{t("parts.condition")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="new">{t("parts.conditionNew")}</SelectItem>
                          <SelectItem value="used">{t("parts.conditionUsed")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="quantity_on_hand" render={({ field }) => (
                    <FormItem><FormLabel>{t("parts.quantityOnHand")}</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="reorder_point" render={({ field }) => (
                    <FormItem><FormLabel>{t("parts.reorderPoint")}</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="cost_price" render={({ field }) => (
                    <FormItem><FormLabel>{t("parts.costPrice")}</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="selling_price" render={({ field }) => (
                    <FormItem><FormLabel>{t("parts.sellingPrice")}</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="warehouse_id" render={({ field }) => (
                    <FormItem><FormLabel>{t("parts.warehouse")}</FormLabel>
                      <Select onValueChange={v => field.onChange(v === "none" ? null : parseInt(v))} value={field.value != null ? String(field.value) : "none"}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t("parts.warehouse")} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t("parts.noWarehouse")}</SelectItem>
                          {warehouses?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="bin_id" render={({ field }) => (
                    <FormItem><FormLabel>{t("parts.bin")}</FormLabel>
                      <Select onValueChange={v => field.onChange(v === "none" ? null : parseInt(v))} value={field.value != null ? String(field.value) : "none"} disabled={!selectedWarehouseId}>
                        <FormControl><SelectTrigger><SelectValue placeholder={selectedWarehouseId ? t("parts.selectBin") : t("parts.selectWarehouseFirst")} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t("parts.noBin")}</SelectItem>
                          {filteredBins.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="image_url" render={({ field }) => (
                  <FormItem><FormLabel>{t("common.image")} ({t("common.optional")})</FormLabel><FormControl>
                    <ImageUpload value={field.value} onChange={field.onChange} disabled={createMutation.isPending || updateMutation.isPending} />
                  </FormControl></FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog}>{t("common.cancel")}</Button>
                  <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingPart ? t("parts.updatePart") : t("parts.createPart")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-white dark:bg-gray-950 p-4 rounded-lg border dark:border-gray-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("parts.searchParts")} className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-950 border dark:border-gray-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">{t("common.image")}</TableHead>
              <TableHead>{t("parts.sku")}</TableHead>
              <TableHead>{t("parts.partName")}</TableHead>
              <TableHead>{t("parts.category")} / {t("parts.subcategory")}</TableHead>
              <TableHead>{t("parts.condition")}</TableHead>
              <TableHead className="text-right">{t("invoices.qty")}</TableHead>
              <TableHead className="text-right">{t("parts.costPrice")}</TableHead>
              <TableHead className="text-right">{t("parts.sellingPrice")}</TableHead>
              <TableHead>{t("parts.warehouse")}</TableHead>
              <TableHead>{t("parts.bin")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(5)].map((_, i) => (
                <TableRow key={i}>{[...Array(10)].map((_, j) => <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>)}</TableRow>
              ))
              : parts?.length === 0
                ? <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">{t("parts.noParts")}</TableCell></TableRow>
                : parts?.map((part: any) => (
                  <TableRow key={part.id}>
                    <TableCell>
                      {part.imageUrl
                        ? <img src={part.imageUrl} alt={part.name} className="h-9 w-9 rounded object-cover border" />
                        : <div className="h-9 w-9 rounded bg-muted" />
                      }
                    </TableCell>
                    <TableCell className="font-mono text-xs">{part.sku}</TableCell>
                    <TableCell className="font-medium">{part.name}</TableCell>
                    <TableCell>
                      {getSubcategoryLabel(part)
                        ? <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/20 text-xs font-normal">{getSubcategoryLabel(part)}</Badge>
                        : <span className="text-muted-foreground text-sm">-</span>
                      }
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{part.condition}</Badge></TableCell>
                    <TableCell className="text-right">
                      <span className={part.quantityOnHand <= part.reorderPoint ? "text-red-600 font-bold" : ""}>{part.quantityOnHand}</span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(parseFloat(part.costPrice))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(parseFloat(part.sellingPrice))}</TableCell>
                    <TableCell>{part.warehouseName ?? "-"}</TableCell>
                    <TableCell>{part.binLabel ? <Badge variant="outline" className="font-mono text-xs">{part.binLabel}</Badge> : "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(part)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-600"
                          onClick={() => { if (confirm(t("parts.confirmDelete"))) deleteMutation.mutate(part.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
