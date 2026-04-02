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
import { Textarea } from "@/components/ui/textarea";
import React from "react";
import { Plus, Edit, Trash2, Tag, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  image_url: z.string().nullable().optional(),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

export default function CategoriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["/categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: allSubcategories } = useQuery({
    queryKey: ["/subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subcategories").select("*, categories(name)").order("name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((s: any) => ({
        ...s,
        categoryId: s.category_id,
        imageUrl: s.image_url,
        categoryName: s.categories?.name ?? null,
      }));
    },
  });

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", description: "", image_url: null },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const { error } = await supabase.from("categories").insert(values);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/categories"] });
      toast.success(t("categories.categoryCreated"));
      setIsAddOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: CategoryFormValues }) => {
      const { error } = await supabase.from("categories").update(values).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/categories"] });
      toast.success(t("categories.categoryUpdated"));
      setEditingCategory(null);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/categories"] });
      toast.success(t("categories.categoryDeleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openAdd = () => {
    form.reset({ name: "", description: "", image_url: null });
    setIsAddOpen(true);
  };

  const startEdit = (cat: any) => {
    form.reset({ name: cat.name, description: cat.description ?? "", image_url: cat.image_url ?? null });
    setEditingCategory(cat);
  };

  const onSubmit = (values: CategoryFormValues) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const closeDialog = () => { setIsAddOpen(false); setEditingCategory(null); form.reset(); };
  const getSubcategoriesForCategory = (categoryId: number) => allSubcategories?.filter(s => s.categoryId === categoryId) ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">{t("categories.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("categories.subtitle")}</p>
        </div>
        <Button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600 shrink-0">
          <Plus className="h-4 w-4 mr-2" />{t("categories.addCategory")}
        </Button>
      </div>

      <div className="rounded-lg border dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-14">{t("common.image")}</TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.description")}</TableHead>
              <TableHead>{t("categories.subcategoriesCount")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
              : categories?.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>{t("categories.noCategories")}</p>
                    </TableCell>
                  </TableRow>
                )
                : categories?.map((cat: any) => {
                  const subs = getSubcategoriesForCategory(cat.id);
                  const isExpanded = expandedCategory === cat.id;
                  return (
                    <React.Fragment key={cat.id}>
                      <TableRow className="hover:bg-gray-50 dark:hover:bg-gray-900">
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                            disabled={subs.length === 0}>
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""} ${subs.length === 0 ? "opacity-20" : ""}`} />
                          </Button>
                        </TableCell>
                        <TableCell>
                          {cat.image_url
                            ? <img src={cat.image_url} alt={cat.name} className="h-9 w-9 rounded object-cover border" />
                            : <div className="h-9 w-9 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs"><Tag className="h-4 w-4" /></div>
                          }
                        </TableCell>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{cat.description ?? "-"}</TableCell>
                        <TableCell><Badge variant="secondary">{subs.length}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => startEdit(cat)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-red-600"
                              onClick={() => { if (confirm(t("categories.confirmDelete"))) deleteMutation.mutate(cat.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && subs.length > 0 && subs.map((sub: any) => (
                        <TableRow key={`sub-${sub.id}`} className="bg-orange-50/50 dark:bg-orange-950/10">
                          <TableCell></TableCell>
                          <TableCell>{sub.imageUrl ? <img src={sub.imageUrl} alt={sub.name} className="h-8 w-8 rounded object-cover border" /> : null}</TableCell>
                          <TableCell colSpan={3} className="text-sm text-muted-foreground pl-8">
                            <span className="text-orange-500 mr-2">└</span>
                            <span className="font-medium text-foreground">{sub.name}</span>
                            {sub.description && <span className="ml-2 text-muted-foreground">— {sub.description}</span>}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })
            }
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddOpen || !!editingCategory} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingCategory ? t("categories.editCategory") : t("categories.addCategory")}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>{t("categories.categoryName")}</FormLabel><FormControl><Input placeholder={t("categories.categoryName")} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>{t("common.description")} ({t("common.optional")})</FormLabel><FormControl><Textarea placeholder={t("common.description")} rows={3} {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="image_url" render={({ field }) => (
                <FormItem><FormLabel>{t("common.image")} ({t("common.optional")})</FormLabel><FormControl>
                  <ImageUpload value={field.value} onChange={field.onChange} disabled={createMutation.isPending || updateMutation.isPending} />
                </FormControl></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>{t("common.cancel")}</Button>
                <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingCategory ? t("categories.updateCategory") : t("categories.createCategory")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
