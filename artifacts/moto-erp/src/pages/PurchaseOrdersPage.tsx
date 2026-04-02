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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Eye, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const poSchema = z.object({
  vendor_id: z.string().min(1, "Vendor is required"),
  lines: z.array(z.object({
    part_id: z.string().min(1, "Part is required"),
    quantity: z.number().min(1),
    unit_cost: z.number().min(0),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    ordered: "bg-blue-100 text-blue-700",
    partially_received: "bg-yellow-100 text-yellow-700",
    received: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return <Badge className={`${map[status] ?? ""} capitalize`}>{status.replace(/_/g, " ")}</Badge>;
}

export default function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedPOId, setSelectedPOId] = useState<number | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: pos, isLoading } = useQuery({
    queryKey: ["/purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, vendors(name)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((po: any) => ({ ...po, vendorName: po.vendors?.name, po_number: po.po_number }));
    },
  });

  const { data: selectedPO } = useQuery({
    queryKey: ["/purchase-orders", selectedPOId],
    queryFn: async () => {
      const { data: po, error: poErr } = await supabase
        .from("purchase_orders")
        .select("*, vendors(name)")
        .eq("id", selectedPOId!)
        .single();
      if (poErr) throw new Error(poErr.message);
      const { data: lines, error: linesErr } = await supabase
        .from("purchase_order_lines")
        .select("*, parts(name, sku)")
        .eq("purchase_order_id", selectedPOId!);
      if (linesErr) throw new Error(linesErr.message);
      return {
        ...po,
        vendorName: po.vendors?.name,
        lines: (lines ?? []).map((l: any) => ({
          ...l, partName: l.parts?.name, partSku: l.parts?.sku,
        })),
      };
    },
    enabled: !!selectedPOId,
  });

  const { data: vendors } = useQuery({
    queryKey: ["/vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, name").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: parts } = useQuery({
    queryKey: ["/parts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts").select("id, name, sku").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const form = useForm<z.infer<typeof poSchema>>({
    resolver: zodResolver(poSchema),
    defaultValues: { vendor_id: "", lines: [{ part_id: "", quantity: 1, unit_cost: 0 }], notes: "" },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof poSchema>) => {
      const totalAmount = values.lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
      const { data: poData, error: poErr } = await supabase.rpc("next_document_number", { p_prefix: "PO" });
      if (poErr) throw new Error(poErr.message);

      const { data: po, error: insertErr } = await supabase
        .from("purchase_orders")
        .insert({
          po_number: poData,
          vendor_id: parseInt(values.vendor_id),
          status: "draft",
          total_amount: totalAmount,
          notes: values.notes,
        })
        .select()
        .single();
      if (insertErr) throw new Error(insertErr.message);

      const lineRows = values.lines.map(l => ({
        purchase_order_id: po.id,
        part_id: parseInt(l.part_id),
        quantity: l.quantity,
        unit_cost: l.unit_cost,
        total_cost: l.quantity * l.unit_cost,
      }));
      const { error: linesErr } = await supabase.from("purchase_order_lines").insert(lineRows);
      if (linesErr) throw new Error(linesErr.message);

      await supabase.from("vendors").update({
        total_purchased: supabase.rpc as any,
      }).eq("id", parseInt(values.vendor_id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/purchase-orders"] });
      toast.success("Purchase Order created");
      setIsAddOpen(false);
      form.reset();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const confirmMutation = useMutation({
    mutationFn: async (poId: number) => {
      const { error } = await supabase.from("purchase_orders").update({ status: "ordered", ordered_at: new Date().toISOString() }).eq("id", poId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/purchase-orders", selectedPOId] });
      toast.success("Order confirmed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("purchaseOrders.title")}</h1>
          <p className="text-muted-foreground">{t("purchaseOrders.subtitle")}</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600"><Plus className="h-4 w-4 mr-2" /> {t("purchaseOrders.addPO")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
            <DialogHeader><DialogTitle>{t("purchaseOrders.createPO")}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(v => createMutation.mutate(v))} className="space-y-4">
                <FormField control={form.control} name="vendor_id" render={({ field }) => (
                  <FormItem><FormLabel>{t("purchaseOrders.vendor")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t("purchaseOrders.selectVendor")} /></SelectTrigger></FormControl>
                      <SelectContent>{vendors?.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />

                <div className="space-y-2">
                  <FormLabel>{t("purchaseOrders.items")}</FormLabel>
                  <div className="grid grid-cols-12 gap-1 text-xs text-muted-foreground px-2">
                    <span className="col-span-6">{t("purchaseOrders.part")}</span>
                    <span className="col-span-2">{t("purchaseOrders.qty")}</span>
                    <span className="col-span-3">{t("purchaseOrders.unitCost")}</span>
                  </div>
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-end border p-2 rounded">
                      <div className="col-span-6">
                        <FormField control={form.control} name={`lines.${index}.part_id`} render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder={t("purchaseOrders.selectPart")} /></SelectTrigger></FormControl>
                              <SelectContent>{parts?.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                      <div className="col-span-2">
                        <FormField control={form.control} name={`lines.${index}.quantity`} render={({ field }) => (
                          <FormItem><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl></FormItem>
                        )} />
                      </div>
                      <div className="col-span-3">
                        <FormField control={form.control} name={`lines.${index}.unit_cost`} render={({ field }) => (
                          <FormItem><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
                        )} />
                      </div>
                      <div className="col-span-1">
                        <Button variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ part_id: "", quantity: 1, unit_cost: 0 })}>{t("purchaseOrders.addLine")}</Button>
                </div>
                <DialogFooter>
                  <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={createMutation.isPending}>{t("purchaseOrders.createPO")}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("purchaseOrders.poNumber")}</TableHead>
              <TableHead>{t("purchaseOrders.vendor")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("purchaseOrders.totalAmount")}</TableHead>
              <TableHead>{t("purchaseOrders.createdAt")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pos?.map((po: any) => (
              <TableRow key={po.id}>
                <TableCell className="font-mono font-medium">{po.po_number}</TableCell>
                <TableCell>{po.vendorName}</TableCell>
                <TableCell>{statusBadge(po.status)}</TableCell>
                <TableCell className="text-right">{formatCurrency(parseFloat(po.total_amount))}</TableCell>
                <TableCell>{formatDate(po.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedPOId(po.id)}><Eye className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!pos?.length && !isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No purchase orders yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selectedPOId && (
        <Dialog open={!!selectedPOId} onOpenChange={() => setSelectedPOId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{t("purchaseOrders.poDetails")}: {selectedPO?.po_number ?? t("common.loading")}</DialogTitle></DialogHeader>
            {!selectedPO ? (
              <div className="py-8 text-center text-muted-foreground">{t("common.loading")}</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Vendor:</span> {selectedPO.vendorName}</div>
                  <div><span className="text-muted-foreground">Date:</span> {formatDate(selectedPO.created_at)}</div>
                  <div><span className="text-muted-foreground">Status:</span> {statusBadge(selectedPO.status)}</div>
                  <div className="font-bold text-orange-600"><span className="text-muted-foreground font-normal">Total:</span> {formatCurrency(parseFloat(selectedPO.total_amount))}</div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("purchaseOrders.part")} (SKU)</TableHead>
                      <TableHead className="text-right">{t("purchaseOrders.qty")}</TableHead>
                      <TableHead className="text-right">{t("purchaseOrders.unitCost")}</TableHead>
                      <TableHead className="text-right">{t("common.subtotal")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPO.lines?.length ? selectedPO.lines.map((line: any) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <div>{line.partName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{line.partSku}</div>
                        </TableCell>
                        <TableCell className="text-right">{line.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(parseFloat(line.unit_cost))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(parseFloat(line.total_cost))}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("purchaseOrders.noLineItems")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                {selectedPO.status === "draft" && (
                  <Button onClick={() => confirmMutation.mutate(selectedPO.id)} className="w-full bg-orange-500 hover:bg-orange-600" disabled={confirmMutation.isPending}>
                    {t("purchaseOrders.confirmOrder")}
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
