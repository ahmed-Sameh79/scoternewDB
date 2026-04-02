import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
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
import { Plus, Eye } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const grnSchema = z.object({
  purchaseOrderId: z.string().min(1, "PO is required"),
  receivedAt: z.string().min(1, "Received date is required"),
  notes: z.string().optional(),
  lines: z.array(z.object({
    partId: z.string().min(1),
    quantityReceived: z.number().min(1),
    binId: z.string().optional(),
    partName: z.string().optional(),
    partSku: z.string().optional(),
  })),
});

export default function GRNPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedGRN, setSelectedGRN] = useState<any>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [grnLines, setGrnLines] = useState<any[]>([]);

  const { data: grns } = useQuery({
    queryKey: ["/grn"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grn")
        .select("*, purchase_orders(po_number, vendors(name)), profiles(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((g: any) => ({
        ...g,
        grnNumber: g.grn_number,
        poNumber: g.purchase_orders?.po_number,
        vendorName: g.purchase_orders?.vendors?.name,
        receivedAt: g.received_at,
        receivedByName: g.profiles?.full_name ?? "—",
      }));
    },
  });

  const { data: pos } = useQuery({
    queryKey: ["/purchase-orders", "ordered"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, po_number, vendors(name)")
        .in("status", ["ordered", "partially_received"])
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((po: any) => ({ id: po.id, poNumber: po.po_number, vendorName: po.vendors?.name }));
    },
  });

  const { data: bins } = useQuery({
    queryKey: ["/bins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bins").select("id, zone, aisle, shelf, bin, label, warehouse_id").order("label");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const form = useForm<z.infer<typeof grnSchema>>({
    resolver: zodResolver(grnSchema),
    defaultValues: { purchaseOrderId: "", receivedAt: new Date().toISOString().split("T")[0], notes: "", lines: [] },
  });

  const { replace } = useFieldArray({ control: form.control, name: "lines" });

  const onPOSelect = async (poId: string) => {
    const { data: lines, error } = await supabase
      .from("purchase_order_lines")
      .select("*, parts(name, sku)")
      .eq("purchase_order_id", parseInt(poId));
    if (error) { toast.error("Failed to load PO lines"); return; }
    const mapped = (lines ?? []).map((l: any) => ({
      partId: String(l.part_id),
      quantityReceived: l.quantity,
      binId: "",
      partName: l.parts?.name ?? "",
      partSku: l.parts?.sku ?? "",
    }));
    replace(mapped);
    setGrnLines(mapped);
  };

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof grnSchema>) => {
      const { data: grnNum, error: seqErr } = await supabase.rpc("next_document_number", { p_prefix: "GRN" });
      if (seqErr) throw new Error(seqErr.message);

      const { data: grnRec, error: grnErr } = await supabase.from("grn").insert({
        grn_number: grnNum,
        purchase_order_id: parseInt(values.purchaseOrderId),
        received_at: values.receivedAt,
        received_by: user?.id ?? null,
        notes: values.notes,
      }).select().single();
      if (grnErr) throw new Error(grnErr.message);

      if (values.lines.length > 0) {
        const grnLineRows = values.lines.map(l => ({
          grn_id: grnRec.id,
          part_id: parseInt(l.partId),
          quantity_received: l.quantityReceived,
          bin_id: l.binId ? parseInt(l.binId) : null,
        }));
        const { error: lineErr } = await supabase.from("grn_lines").insert(grnLineRows);
        if (lineErr) throw new Error(lineErr.message);

        for (const l of values.lines) {
          const { data: partData } = await supabase.from("parts").select("quantity_on_hand").eq("id", parseInt(l.partId)).single();
          if (partData) {
            await supabase.from("parts").update({
              quantity_on_hand: partData.quantity_on_hand + l.quantityReceived,
              bin_id: l.binId ? parseInt(l.binId) : undefined,
            }).eq("id", parseInt(l.partId));
          }
        }
      }

      await supabase.from("purchase_orders").update({ status: "received" }).eq("id", parseInt(values.purchaseOrderId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/grn"] });
      queryClient.invalidateQueries({ queryKey: ["/parts"] });
      queryClient.invalidateQueries({ queryKey: ["/purchase-orders"] });
      toast.success("GRN recorded and inventory updated");
      setIsAddOpen(false);
      form.reset();
      setGrnLines([]);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const formLines = form.watch("lines");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("grn.title")}</h1>
          <p className="text-muted-foreground">{t("grn.subtitle")}</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600"><Plus className="h-4 w-4 mr-2" /> {t("grn.addGRN")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl overflow-y-auto max-h-[90vh]">
            <DialogHeader><DialogTitle>{t("grn.receiveGoods")}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(v => createMutation.mutate(v))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="purchaseOrderId" render={({ field }) => (
                    <FormItem><FormLabel>{t("grn.purchaseOrder")}</FormLabel>
                      <Select onValueChange={(val) => { field.onChange(val); onPOSelect(val); }} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t("grn.selectPO")} /></SelectTrigger></FormControl>
                        <SelectContent>
                          {pos?.map((po: any) => <SelectItem key={po.id} value={String(po.id)}>{po.poNumber} ({po.vendorName})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="receivedAt" render={({ field }) => (
                    <FormItem><FormLabel>{t("grn.receivedDate")}</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                  )} />
                </div>

                {formLines.length > 0 && (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("grn.part")}</TableHead>
                          <TableHead>{t("grn.qtyRecv")}</TableHead>
                          <TableHead>{t("grn.targetBin")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formLines.map((line: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="text-sm font-medium">{line.partName}</div>
                              <div className="text-xs text-muted-foreground">{line.partSku}</div>
                            </TableCell>
                            <TableCell>
                              <FormField control={form.control} name={`lines.${index}.quantityReceived`} render={({ field }) => (
                                <FormItem><FormControl>
                                  <Input className="w-20" type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                                </FormControl></FormItem>
                              )} />
                            </TableCell>
                            <TableCell>
                              <FormField control={form.control} name={`lines.${index}.binId`} render={({ field }) => (
                                <FormItem>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={t("grn.targetBin")} /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {bins?.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={createMutation.isPending || formLines.length === 0}>
                  {createMutation.isPending ? "Saving..." : t("grn.submitGRN")}
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
              <TableHead>{t("grn.grnNumber")}</TableHead>
              <TableHead>{t("purchaseOrders.poNumber")}</TableHead>
              <TableHead>{t("purchaseOrders.vendor")}</TableHead>
              <TableHead>{t("grn.receivedDate")}</TableHead>
              <TableHead>{t("grn.receivedBy")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grns?.map((grn: any) => (
              <TableRow key={grn.id}>
                <TableCell className="font-mono font-medium">{grn.grnNumber}</TableCell>
                <TableCell>{grn.poNumber}</TableCell>
                <TableCell>{grn.vendorName}</TableCell>
                <TableCell>{formatDate(grn.receivedAt)}</TableCell>
                <TableCell>{grn.receivedByName}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedGRN(grn)}><Eye className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!grns?.length && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No GRNs yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
