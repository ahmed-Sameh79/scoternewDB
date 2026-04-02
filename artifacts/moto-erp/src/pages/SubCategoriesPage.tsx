import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";

const subcategorySchema = z.object({
  category_id: z.number({ required_error: "Category is required" }),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  image_url: z.string().nullable().optional(),
});
type SubcategoryFormValues = z.infer<typeof subcategorySchema>;

export default function SubCategoriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<any | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");

  const { data: categories } = useQuery({
    queryKey: ["/categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: subcategories, isLoading } = useQuery({
    queryKey: ["/subcategories", filterCategoryId],
    queryFn: async () => {
      let q = supabase.from("subcategories").select("*, categories(name)").order("name");
      if (filterCategoryId !== "all") q = q.eq("category_id", parseInt(filterCategoryId));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((s: any) => ({
        ...s,
        categoryName: s.categories?.name ?? null,
      }));
    },
  });

  const form = useForm<SubcategoryFormValues>({
    resolver: zodResolver(subcategorySchema),
    defaultValues: { name: "", description: "", image_url: null },
  });

  const createMutation = useMutation({
    mutationFn: async (values: SubcategoryFormValues) => {
      const { error } = await supabase.from("subcategories").insert(values);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/subcategories"] });
      toast.success(t("subcategories.subcategoryCreated"));
      setIsAddOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: SubcategoryFormValues }) => {
      const { error } = await supabase.from("subcategories").update(values).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/subcategories"] });
      toast.success(t("subcategories.subcategoryUpdated"));
      setEditingSub(null);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("subcategories").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/subcategories"] });
      toast.success(t("subcategories.subcategoryDeleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openAdd = () => {
    form.reset({ name: "", description: "", image_url: null });
    setIsAddOpen(true);
  };

  const startEdit = (sub: any) => {
    form.reset({ name: sub.name, description: sub.description ?? "", category_id: sub.category_id, image_url: sub.image_url ?? null });
    setEditingSub(sub);
  };

  const onSubmit = (values: SubcategoryFormValues) => {
    if (editingSub) updateMutation.mutate({ id: editingSub.id, values });
    else createMutation.mutate(values);
  };

  const closeDialog = () => { setIsAddOpen(false); setEditingSub(null); form.reset(); };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">{t("subcategories.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subcategories.subtitle")}</p>
        </div>
        <Button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600 shrink-0">
          <Plus className="h-4 w-4 mr-2" />{t("subcategories.addSubcategory")}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">{t("subcategories.filterByCategory")}:</span>
        <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("subcategories.allCategories")}</SelectItem>
            {categories?.map((cat: any) => <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">{t("common.image")}</TableHead>
              <TableHead>{t("subcategories.subcategoryName")}</TableHead>
              <TableHead>{t("subcategories.category")}</TableHead>
              <TableHead>{t("common.description")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
              : subcategories?.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>{t("subcategories.noSubcategories")}</p>
                    </TableCell>
                  </TableRow>
                )
                : subcategories?.map((sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      {sub.image_url
                        ? <img src={sub.image_url} alt={sub.name} className="h-9 w-9 rounded object-cover border" />
                        : <div className="h-9 w-9 rounded bg-muted flex items-center justify-center"><Layers className="h-4 w-4 text-muted-foreground" /></div>
                      }
                    </TableCell>
                    <TableCell className="font-medium">{sub.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                        {sub.categoryName ?? "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{sub.description ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(sub)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-600"
                          onClick={() => { if (confirm(t("subcategories.confirmDelete"))) deleteMutation.mutate(sub.id); }}>
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

      <Dialog open={isAddOpen || !!editingSub} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingSub ? t("subcategories.editSubcategory") : t("subcategories.addSubcategory")}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="category_id" render={({ field }) => (
                <FormItem><FormLabel>{t("subcategories.category")}</FormLabel>
                  <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t("subcategories.selectCategory")} /></SelectTrigger></FormControl>
                    <SelectContent>{categories?.map((cat: any) => <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>{t("subcategories.subcategoryName")}</FormLabel><FormControl><Input placeholder={t("subcategories.subcategoryName")} {...field} /></FormControl><FormMessage /></FormItem>
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
                  {editingSub ? t("subcategories.updateSubcategory") : t("subcategories.createSubcategory")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
