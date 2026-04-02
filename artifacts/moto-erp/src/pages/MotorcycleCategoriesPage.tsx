import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  image_url: z.string().nullable().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function MotorcycleCategoriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data: categories, isLoading } = useQuery({
    queryKey: ["/motorcycle-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycle_categories").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: subcategories } = useQuery({
    queryKey: ["/motorcycle-subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycle_subcategories").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: brands } = useQuery({
    queryKey: ["/motorcycle-brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycle_brands").select("*, motorcycle_categories(name)").order("name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((b: any) => ({ ...b, categoryName: b.motorcycle_categories?.name }));
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", image_url: null },
  });

  const closeDialog = () => { setIsAddOpen(false); setEditingItem(null); form.reset(); };

  const createMutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const { error } = await supabase.from("motorcycle_categories").insert(v);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/motorcycle-categories"] }); toast.success(t("motorcycleCategories.created")); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const { error } = await supabase.from("motorcycle_categories").update(v).eq("id", editingItem.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/motorcycle-categories"] }); toast.success(t("motorcycleCategories.updated")); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("motorcycle_categories").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/motorcycle-categories"] }); toast.success(t("motorcycleCategories.deleted")); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onSubmit = (v: FormValues) => editingItem ? updateMutation.mutate(v) : createMutation.mutate(v);

  const startEdit = (item: any) => {
    setEditingItem(item);
    form.reset({ name: item.name, description: item.description ?? "", image_url: item.image_url ?? null });
    setIsAddOpen(true);
  };

  const getSubsForCat = (catId: number) => subcategories?.filter((s: any) => s.motorcycle_category_id === catId) ?? [];
  const getBrandsForCat = (catId: number) => brands?.filter((b: any) => b.motorcycle_category_id === catId) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("motorcycleCategories.title")}</h1>
          <p className="text-muted-foreground">{t("motorcycleCategories.subtitle")}</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> {t("motorcycleCategories.addCategory")}
        </Button>
      </div>

      <div className="bg-white border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>{t("common.image")}</TableHead>
              <TableHead>{t("motorcycleCategories.categoryName")}</TableHead>
              <TableHead>{t("common.description")}</TableHead>
              <TableHead>{t("motorcycleCategories.subcategories")}</TableHead>
              <TableHead>{t("motorcycleCategories.brands")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(3)].map((_, i) => (
                <TableRow key={i}>{[...Array(7)].map((_, j) => <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>)}</TableRow>
              ))
              : categories?.length === 0
                ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("motorcycleCategories.empty")}</TableCell></TableRow>
                : categories?.map((cat: any) => {
                  const subs = getSubsForCat(cat.id);
                  const catBrands = getBrandsForCat(cat.id);
                  const isExpanded = expandedIds.has(cat.id);
                  return (
                    <>
                      <TableRow key={cat.id}>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(cat.id)}>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {cat.image_url
                            ? <img src={cat.image_url} alt={cat.name} className="h-9 w-9 rounded object-cover border" />
                            : <div className="h-9 w-9 rounded bg-muted" />
                          }
                        </TableCell>
                        <TableCell className="font-semibold text-base">{cat.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{cat.description || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{subs.length}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{catBrands.length}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => startEdit(cat)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700"
                              onClick={() => { if (confirm(t("common.confirmDelete"))) deleteMutation.mutate(cat.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && subs.map((sub: any) => (
                        <TableRow key={`sub-${sub.id}`} className="bg-orange-50/40">
                          <TableCell />
                          <TableCell>
                            {sub.image_url
                              ? <img src={sub.image_url} alt={sub.name} className="h-7 w-7 rounded object-cover border" />
                              : <div className="h-7 w-7 rounded bg-muted" />
                            }
                          </TableCell>
                          <TableCell className="pl-6 text-sm font-medium text-orange-700">{sub.name}</TableCell>
                          <TableCell colSpan={4} className="text-xs text-muted-foreground">{sub.description || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </>
                  );
                })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setIsAddOpen(true); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? t("motorcycleCategories.editCategory") : t("motorcycleCategories.addCategory")}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>{t("motorcycleCategories.categoryName")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>{t("common.description")} ({t("common.optional")})</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="image_url" render={({ field }) => (
                <FormItem><FormLabel>{t("common.image")} ({t("common.optional")})</FormLabel><FormControl>
                  <ImageUpload value={field.value} onChange={field.onChange} disabled={createMutation.isPending || updateMutation.isPending} />
                </FormControl></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>{t("common.cancel")}</Button>
                <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingItem ? t("motorcycleCategories.updateCategory") : t("motorcycleCategories.createCategory")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
