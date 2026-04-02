import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Search, Plus, Edit, Phone, Mail, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

const vendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact_person: z.string().min(1, "Contact person is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().optional(),
});

export default function VendorsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["/vendors", search],
    queryFn: async () => {
      let q = supabase.from("vendors").select("*").order("name");
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const form = useForm<z.infer<typeof vendorSchema>>({
    resolver: zodResolver(vendorSchema),
    defaultValues: { name: "", contact_person: "", email: "", phone: "", address: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof vendorSchema>) => {
      if (editingVendor) {
        const { error } = await supabase.from("vendors").update(values).eq("id", editingVendor.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("vendors").insert(values);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/vendors"] });
      toast.success(editingVendor ? "Vendor updated" : "Vendor created");
      setIsAddOpen(false);
      setEditingVendor(null);
      form.reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = (vendor: any) => {
    setEditingVendor(vendor);
    form.reset({
      name: vendor.name,
      contact_person: vendor.contact_person,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address || "",
    });
    setIsAddOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("vendors.title")}</h1>
          <p className="text-muted-foreground">{t("vendors.subtitle")}</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) { setEditingVendor(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" /> {t("vendors.addVendor")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingVendor ? t("vendors.editVendor") : t("vendors.addVendor")}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>{t("vendors.vendorName")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="contact_person" render={({ field }) => (
                  <FormItem><FormLabel>{t("vendors.contactPerson")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>{t("vendors.email")}</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>{t("vendors.phone")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>{t("vendors.address")}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {editingVendor ? t("vendors.updateVendor") : t("vendors.createVendor")}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("vendors.searchVendors")} className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="bg-white border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("vendors.vendorName")}</TableHead>
              <TableHead>{t("vendors.contact")}</TableHead>
              <TableHead>{t("vendors.email")}</TableHead>
              <TableHead>{t("vendors.phone")}</TableHead>
              <TableHead className="text-right">{t("vendors.totalPurchased")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(5)].map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))
              : vendors?.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell><div className="flex items-center gap-1"><User className="h-3 w-3" /> {v.contact_person}</div></TableCell>
                  <TableCell><div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {v.email}</div></TableCell>
                  <TableCell><div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {v.phone}</div></TableCell>
                  <TableCell className="text-right">{formatCurrency(parseFloat(v.total_purchased) || 0)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(v)}><Edit className="h-4 w-4" /></Button>
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
