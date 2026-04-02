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
  motorcycle_category_id: z.string().min(1, "Category is required"),
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  image_url: z.string().nullable().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function MotorcycleSubcategoriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const { data: subcategories, isLoading } = useQuery({
    queryKey: ["/motorcycle-subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycle_subcategories")
        .select("*, motorcycle_categories(name)")
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((s: any) => ({ ...s, categoryName: s.motorcycle_categories?.name }));
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
      const { error } = await supabase.from("motorcycle_subcategories").insert({
        ...v, motorcycle_category_id: parseInt(v.motorcycle_category_id),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/motorcycle-subcategories"] }); toast.success(t("motorcycleSubcategories.created")); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const { error } = await supabase.from("motorcycle_subcategories").update({
        ...v, motorcycle_category_id: parseInt(v.motorcycle_category_id),
      }).eq("id", editingItem.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/motorcycle-subcategories"] }); toast.success(t("motorcycleSubcategories.updated")); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("motorcycle_subcategories").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/motorcycle-subcategories"] }); toast.success(t("motorcycleSubcategories.deleted")); },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = (v: FormValues) => editingItem ? updateMutation.mutate(v) : createMutation.mutate(v);

  const startEdit = (item: any) => {
    setEditingItem(item);
    form.reset({
      motorcycle_category_id: String(item.motorcycle_category_id),
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
          <h1 className="text-3xl font-bold tracking-tight">{t("motorcycleSubcategories.title")}</h1>
          <p className="text-muted-foreground">{t("motorcycleSubcategories.subtitle")}</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> {t("motorcycleSubcategories.addSubcategory")}
        </Button>
      </div>

      <div className="bg-white border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.image")}</TableHead>
              <TableHead>{t("motorcycleSubcategories.subcategoryName")}</TableHead>
              <TableHead>{t("motorcycleSubcategories.parentCategory")}</TableHead>
              <TableHead>{t("common.description")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(4)].map((_, i) => (
                <TableRow key={i}>{[...Array(5)].map((_, j) => <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>)}</TableRow>
              ))
              : subcategories?.length === 0
                ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("motorcycleSubcategories.empty")}</TableCell></TableRow>
                : subcategories?.map((sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      {sub.image_url
                        ? <img src={sub.image_url} alt={sub.name} className="h-9 w-9 rounded object-cover border" />
                        : <div className="h-9 w-9 rounded bg-muted" />
                      }
                    </TableCell>
                    <TableCell className="font-medium">{sub.name}</TableCell>
                    <TableCell>
                      {sub.categoryName
                        ? <Badge className="bg-orange-100 text-orange-700 border-orange-200">{sub.categoryName}</Badge>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{sub.description || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(sub)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700"
                          onClick={() => { if (confirm(t("common.confirmDelete"))) deleteMutation.mutate(sub.id); }}>
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
          <DialogHeader><DialogTitle>{editingItem ? t("motorcycleSubcategories.editSubcategory") : t("motorcycleSubcategories.addSubcategory")}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="motorcycle_category_id" render={({ field }) => (
                <FormItem><FormLabel>{t("motorcycleSubcategories.parentCategory")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t("motorcycleSubcategories.selectCategory")} /></SelectTrigger></FormControl>
                    <SelectContent>{categories?.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>{t("motorcycleSubcategories.subcategoryName")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
                  {editingItem ? t("motorcycleSubcategories.updateSubcategory") : t("motorcycleSubcategories.createSubcategory")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
