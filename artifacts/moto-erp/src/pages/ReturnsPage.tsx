import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const returnSchema = z.object({
  invoice_id: z.string().min(1, "Invoice is required"),
  reason: z.string().min(1, "Reason is required"),
  refund_amount: z.number().min(0),
});

export default function ReturnsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: returns } = useQuery({
    queryKey: ["/returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("returns")
        .select("*, invoices(invoice_number, customer_name)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: any) => ({
        ...r,
        invoiceNumber: r.invoices?.invoice_number,
        customerName: r.invoices?.customer_name,
      }));
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["/invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, customer_name")
        .eq("status", "paid")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const form = useForm<z.infer<typeof returnSchema>>({
    resolver: zodResolver(returnSchema),
    defaultValues: { invoice_id: "", reason: "", refund_amount: 0 },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof returnSchema>) => {
      const { error } = await supabase.from("returns").insert({
        invoice_id: parseInt(values.invoice_id),
        reason: values.reason,
        refund_amount: values.refund_amount,
      });
      if (error) throw new Error(error.message);
      await supabase.from("invoices").update({ status: "refunded" }).eq("id", parseInt(values.invoice_id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/returns"] });
      queryClient.invalidateQueries({ queryKey: ["/invoices"] });
      toast.success(t("returns.returnCreated"));
      setIsAddOpen(false);
      form.reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("returns.title")}</h1>
          <p className="text-muted-foreground">{t("returns.subtitle")}</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600"><Plus className="h-4 w-4 mr-2" /> {t("returns.createReturn")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("returns.createReturn")}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(v => createMutation.mutate(v))} className="space-y-4">
                <FormField control={form.control} name="invoice_id" render={({ field }) => (
                  <FormItem><FormLabel>{t("returns.originalInvoice")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t("returns.selectInvoice")} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {invoices?.map(inv => (
                          <SelectItem key={inv.id} value={String(inv.id)}>
                            {inv.invoice_number} - {inv.customer_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="reason" render={({ field }) => (
                  <FormItem><FormLabel>{t("returns.reasonLabel")}</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="refund_amount" render={({ field }) => (
                  <FormItem><FormLabel>{t("returns.refundAmount")}</FormLabel><FormControl>
                    <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                  </FormControl></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {t("returns.confirmReturn")}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("returns.returnCol")}</TableHead>
              <TableHead>{t("returns.invoiceCol")}</TableHead>
              <TableHead>{t("returns.reason")}</TableHead>
              <TableHead className="text-right">{t("returns.refundCol")}</TableHead>
              <TableHead>{t("returns.dateCol")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns?.map(ret => (
              <TableRow key={ret.id}>
                <TableCell className="font-mono font-medium">RTN-{String(ret.id).padStart(4, "0")}</TableCell>
                <TableCell>{ret.invoiceNumber}</TableCell>
                <TableCell className="max-w-xs truncate">{ret.reason}</TableCell>
                <TableCell className="text-right font-medium text-red-600">{formatCurrency(parseFloat(ret.refund_amount))}</TableCell>
                <TableCell>{formatDate(ret.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
