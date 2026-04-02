import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Eye, Download } from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";

function getQrDataUrl(text: string): Promise<string> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:-9999px;";
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      <QRCodeCanvas
        value={text}
        size={128}
        ref={(canvas) => {
          if (canvas) {
            resolve(canvas.toDataURL("image/png"));
            setTimeout(() => { root.unmount(); document.body.removeChild(container); }, 0);
          }
        }}
      />
    );
  });
}

function generateInvoicePdf(invoice: any): void {
  const qrText = `INV:${invoice.invoice_number}`;
  getQrDataUrl(qrText).then((qrDataUrl) => import("jspdf").then(({ jsPDF }) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(22); doc.setTextColor(249, 115, 22); doc.text("MotoERP Receipt", 20, y); doc.setTextColor(0, 0, 0);
    doc.setFontSize(10); doc.text(`Invoice: ${invoice.invoice_number}`, pageW - 20, y, { align: "right" }); y += 7;
    doc.text(formatDateTime(invoice.created_at), pageW - 20, y, { align: "right" }); y += 14;

    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("Customer", 20, y); doc.setFont("helvetica", "normal"); y += 6;
    doc.setFontSize(10); doc.text(invoice.customer_name, 20, y); y += 5;
    if (invoice.customer_phone) doc.text(invoice.customer_phone, 20, y); y += 10;

    doc.text(`Payment Method: ${invoice.payment_method ?? "Cash"}`, 20, y);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, pageW - 20, y, { align: "right" }); y += 10;
    doc.setDrawColor(200, 200, 200); doc.line(20, y, pageW - 20, y); y += 7;

    doc.setFont("helvetica", "bold");
    doc.text("Item", 20, y); doc.text("Qty", 120, y, { align: "right" }); doc.text("Unit Price", 150, y, { align: "right" }); doc.text("Total", pageW - 20, y, { align: "right" });
    doc.setFont("helvetica", "normal"); y += 5; doc.line(20, y, pageW - 20, y); y += 6;

    for (const line of (invoice.lines ?? [])) {
      const label = line.parts?.name ?? line.motorcycles?.model ?? line.description ?? "Item";
      doc.text(label.slice(0, 50), 20, y); doc.text(String(line.quantity), 120, y, { align: "right" });
      doc.text(formatCurrency(parseFloat(line.unit_price)), 150, y, { align: "right" });
      doc.text(formatCurrency(parseFloat(line.total_price)), pageW - 20, y, { align: "right" }); y += 7;
    }

    y += 3; doc.line(20, y, pageW - 20, y); y += 8;
    doc.setFontSize(10);
    doc.text("Subtotal", 130, y); doc.text(formatCurrency(parseFloat(invoice.subtotal)), pageW - 20, y, { align: "right" }); y += 6;
    doc.text("Tax (6%)", 130, y); doc.text(formatCurrency(parseFloat(invoice.tax_amount)), pageW - 20, y, { align: "right" }); y += 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("TOTAL", 130, y);
    doc.setTextColor(249, 115, 22); doc.text(formatCurrency(parseFloat(invoice.total_amount)), pageW - 20, y, { align: "right" });
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); y += 16;

    doc.setFontSize(9); doc.setTextColor(150, 150, 150);
    doc.text("Thank you for your business!", 20, y); y += 5;
    doc.text("Goods sold are not refundable unless faulty.", 20, y); y += 10;

    doc.addImage(qrDataUrl, "PNG", 20, y, 30, 30); doc.setFontSize(7); doc.text("Scan to verify", 23, y + 33);
    doc.save(`invoice-${invoice.invoice_number}.pdf`);
  })).catch(() => toast.error("PDF generation failed — try again"));
}

export default function InvoicesPage() {
  const { t } = useTranslation();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  const { data: invoices } = useQuery({
    queryKey: ["/invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: selectedInvoice, isLoading: invoiceLoading } = useQuery({
    queryKey: ["/invoices", selectedInvoiceId],
    queryFn: async () => {
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", selectedInvoiceId!)
        .single();
      if (invErr) throw new Error(invErr.message);

      const { data: lines, error: linesErr } = await supabase
        .from("invoice_lines")
        .select("*, parts(name, sku), motorcycles(make, model)")
        .eq("invoice_id", selectedInvoiceId!);
      if (linesErr) throw new Error(linesErr.message);

      return { ...inv, lines: lines ?? [] };
    },
    enabled: !!selectedInvoiceId,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("invoices.title")}</h1>
          <p className="text-muted-foreground">{t("invoices.viewSubtitle")}</p>
        </div>
      </div>

      <div className="bg-white border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("invoices.invoiceNumber")}</TableHead>
              <TableHead>{t("invoices.customer")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("invoices.total")}</TableHead>
              <TableHead>{t("invoices.dateCol")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices?.map((invoice: any) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-mono font-medium">{invoice.invoice_number}</TableCell>
                <TableCell>
                  <div className="font-medium">{invoice.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{invoice.customer_phone}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={invoice.status === "paid" ? "default" : "outline"}>{invoice.status}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(parseFloat(invoice.total_amount))}</TableCell>
                <TableCell>{formatDate(invoice.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedInvoiceId(invoice.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!invoices?.length && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No invoices yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selectedInvoiceId && (
        <Dialog open={!!selectedInvoiceId} onOpenChange={() => setSelectedInvoiceId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("invoices.receipt")}</DialogTitle>
              <DialogDescription>{t("invoices.receiptSubtitle")}</DialogDescription>
            </DialogHeader>
            {invoiceLoading || !selectedInvoice ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">Loading invoice…</div>
            ) : (
              <div className="space-y-6 p-4" id="receipt">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-orange-600">{t("invoices.receiptTitle")}</h2>
                    <p className="text-sm text-muted-foreground">{t("invoices.dealerSubtitle")}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-lg">{selectedInvoice.invoice_number}</div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(selectedInvoice.created_at)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 py-4 border-y">
                  <div>
                    <div className="text-xs font-bold uppercase text-muted-foreground mb-1">{t("invoices.customer")}</div>
                    <div className="font-medium">{selectedInvoice.customer_name}</div>
                    <div className="text-sm">{selectedInvoice.customer_phone}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold uppercase text-muted-foreground mb-1">{t("invoices.paymentMethodHeader")}</div>
                    <div className="font-medium capitalize">{selectedInvoice.payment_method ?? "Cash"}</div>
                    <div className="text-sm">{t("invoices.statusLabel")}: <span className="font-bold uppercase">{selectedInvoice.status}</span></div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("invoices.item")}</TableHead>
                      <TableHead className="text-right">{t("invoices.qty")}</TableHead>
                      <TableHead className="text-right">{t("common.price")}</TableHead>
                      <TableHead className="text-right">{t("common.total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.lines?.map((line: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="font-medium">{line.parts?.name ?? line.motorcycles?.model ?? line.description ?? "Item"}</div>
                        </TableCell>
                        <TableCell className="text-right">{line.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(parseFloat(line.unit_price))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(parseFloat(line.total_price))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm"><span>{t("common.subtotal")}</span><span>{formatCurrency(parseFloat(selectedInvoice.subtotal))}</span></div>
                    <div className="flex justify-between text-sm"><span>{t("invoices.tax")}</span><span>{formatCurrency(parseFloat(selectedInvoice.tax_amount))}</span></div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-bold text-lg">{t("common.total")}</span>
                      <span className="font-black text-xl text-orange-600">{formatCurrency(parseFloat(selectedInvoice.total_amount))}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-start pt-8 border-t">
                  <div className="text-xs text-muted-foreground">
                    <p>{t("invoices.thankYou")}</p>
                    <p>{t("invoices.refundPolicy")}</p>
                    <p className="mt-2 font-mono text-[10px] text-gray-400">{selectedInvoice.invoice_number}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <QRCodeSVG
                      value={JSON.stringify({ inv: selectedInvoice.invoice_number, total: selectedInvoice.total_amount, customer: selectedInvoice.customer_name })}
                      size={80} level="M"
                    />
                    <span className="text-[10px] text-muted-foreground">Scan to verify</span>
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <Button onClick={() => generateInvoicePdf(selectedInvoice)} className="gap-2 bg-orange-500 hover:bg-orange-600">
                    <Download className="h-4 w-4" /> {t("invoices.downloadPdf")}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
