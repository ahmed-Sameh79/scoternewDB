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
import { Plus, Edit, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";

const schema = z.object({
  motorcycle_category_id: z.string().optional(),
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  image_url: z.string().nullable().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function MotorcycleBrandsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const { data: brands, isLoading } = useQuery({
    queryKey: ["/motorcycle-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycle_brands")
        .select("*, motorcycle_categories(name)")
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((b: any) => ({ ...b, categoryName: b.motorcycle_categories?.name }));
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["/motorcycle-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorcycle_categories").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { motorcycle_category_id: "", name: "", description: "", image_url: null },
  });

  const closeDialog = () => { setIsAddOpen(false); setEditingItem(null); form.reset(); };

  const createMutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const { error } = await supabase.from("motorcycle_brands").insert({
        ...v,
        motorcycle_category_id: v.motorcycle_category_id ? parseInt(v.motorcycle_category_id) : null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/motorcycle-brands"] }); toast.success(t("motorcycleBrands.created")); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const { error } = await supabase.from("motorcycle_brands").update({
        ...v,
        motorcycle_category_id: v.motorcycle_category_id ? parseInt(v.motorcycle_category_id) : null,
      }).eq("id", editingItem.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/motorcycle-brands"] }); toast.success(t("motorcycleBrands.updated")); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("motorcycle_brands").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/motorcycle-brands"] }); toast.success(t("motorcycleBrands.deleted")); },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = (v: FormValues) => editingItem ? updateMutation.mutate(v) : createMutation.mutate(v);

  const startEdit = (item: any) => {
    setEditingItem(item);
    form.reset({
      motorcycle_category_id: item.motorcycle_category_id ? String(item.motorcycle_category_id) : "",
      name: item.name,
      description: item.description ?? "",
      image_url: item.image_url ?? null,
    });
    setIsAddOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("motorcycleBrands.title")}</h1>
          <p className="text-muted-foreground">{t("motorcycleBrands.subtitle")}</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> {t("motorcycleBrands.addBrand")}
        </Button>
      </div>

      <div className="bg-white border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.image")}</TableHead>
              <TableHead>{t("motorcycleBrands.brandName")}</TableHead>
              <TableHead>{t("motorcycleBrands.category")}</TableHead>
              <TableHead>{t("common.description")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(4)].map((_, i) => (
                <TableRow key={i}>{[...Array(4)].map((_, j) => <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>)}</TableRow>
              ))
              : brands?.length === 0
                ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("motorcycleBrands.empty")}</TableCell></TableRow>
                : brands?.map((brand: any) => (
                  <TableRow key={brand.id}>
                    <TableCell>
                      {brand.image_url
                        ? <img src={brand.image_url} alt={brand.name} className="h-9 w-9 rounded object-cover border" />
                        : <div className="h-9 w-9 rounded bg-muted" />
                      }
                    </TableCell>
                    <TableCell><div className="font-semibold text-base">{brand.name}</div></TableCell>
                    <TableCell>
                      {brand.categoryName
                        ? <Badge className="bg-orange-100 text-orange-700 border-orange-200">{brand.categoryName}</Badge>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{brand.description || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(brand)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700"
                          onClick={() => { if (confirm(t("common.confirmDelete"))) deleteMutation.mutate(brand.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setIsAddOpen(true); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? t("motorcycleBrands.editBrand") : t("motorcycleBrands.addBrand")}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="motorcycle_category_id" render={({ field }) => (
                <FormItem><FormLabel>{t("motorcycleBrands.category")} ({t("common.optional")})</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t("motorcycleBrands.selectCategory")} /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">{t("common.none")}</SelectItem>
                      {categories?.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>{t("motorcycleBrands.brandName")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
                  {editingItem ? t("motorcycleBrands.updateBrand") : t("motorcycleBrands.createBrand")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
