import { useTranslation } from "react-i18next";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Search, ShoppingCart, Trash2, CreditCard, User, Phone, Plus, Minus,
  Package, Bike, CheckCircle2, X, Filter,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

type CartItemType = "part" | "motorcycle";
interface CartItem {
  id: number; name: string; sku?: string; vin?: string;
  sellingPrice: number; quantity: number; type: CartItemType; maxQty?: number;
}

const TAX_RATE = 6;

function conditionBadge(c: string) {
  return c === "new"
    ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">New</Badge>
    : <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px]">Used</Badge>;
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    available: "bg-emerald-100 text-emerald-700", sold: "bg-red-100 text-red-600",
    in_service: "bg-blue-100 text-blue-700", pre_owned: "bg-orange-100 text-orange-700",
  };
  return <Badge className={`${map[s] ?? "bg-gray-100 text-gray-600"} text-[10px]`}>{s.replace("_", " ")}</Badge>;
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

export default function POSPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"parts" | "motorcycles">("parts");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("__all__");
  const [subcategoryId, setSubcategoryId] = useState<string>("__all__");
  const [brandId, setBrandId] = useState<string>("__all__");
  const [motorcycleCatId, setMotorcycleCatId] = useState<string>("__all__");
  const [condition, setCondition] = useState<string>("__all__");
  const [motoStatus, setMotoStatus] = useState<string>("available");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => { setSubcategoryId("__all__"); }, [categoryId]);
  useEffect(() => {
    setSearch(""); setCategoryId("__all__"); setSubcategoryId("__all__");
    setBrandId("__all__"); setMotorcycleCatId("__all__"); setCondition("__all__");
    if (tab === "motorcycles") setMotoStatus("available");
  }, [tab]);

  const { data: categories = [] } = useQuery({
    queryKey: ["/categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ["/subcategories"],
    queryFn: async () => {
      const { data } = await supabase.from("subcategories").select("id, name, category_id").order("name");
      return data ?? [];
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["/motorcycle-brands"],
    queryFn: async () => {
      const { data } = await supabase.from("motorcycle_brands").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: motoCategories = [] } = useQuery({
    queryKey: ["/motorcycle-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("motorcycle_categories").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: ["/pos-parts", search, categoryId, subcategoryId, condition],
    queryFn: async () => {
      let q = supabase
        .from("parts")
        .select("*, subcategories(name, categories(name))")
        .order("name");
      if (search) q = q.ilike("name", `%${search}%`);
      if (subcategoryId !== "__all__") q = q.eq("subcategory_id", parseInt(subcategoryId));
      else if (categoryId !== "__all__") {
        const subs = (subcategories as any[]).filter((s: any) => String(s.category_id) === categoryId).map((s: any) => s.id);
        if (subs.length > 0) q = q.in("subcategory_id", subs);
      }
      if (condition !== "__all__") q = q.eq("condition", condition);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((p: any) => ({
        ...p,
        subcategoryName: p.subcategories?.name ?? null,
        categoryName: p.subcategories?.categories?.name ?? null,
        imageUrl: p.image_url,
        quantityOnHand: p.quantity_on_hand,
        sellingPrice: p.selling_price,
      }));
    },
    enabled: tab === "parts",
  });

  const { data: motorcycles = [], isLoading: motosLoading } = useQuery({
    queryKey: ["/pos-motorcycles", search, brandId, motorcycleCatId, condition, motoStatus],
    queryFn: async () => {
      let q = supabase
        .from("motorcycles")
        .select("*, motorcycle_brands(name, motorcycle_category_id), motorcycle_categories:motorcycle_subcategories!motorcycle_motorcycles_motorcycle_subcategory_id_fkey(name)")
        .order("make");
      if (search) q = q.or(`make.ilike.%${search}%,model.ilike.%${search}%`);
      if (brandId !== "__all__") q = q.eq("brand_id", parseInt(brandId));
      if (condition !== "__all__") q = q.eq("condition", condition);
      if (motoStatus !== "__all__") q = q.eq("status", motoStatus);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((m: any) => ({
        ...m,
        brandName: m.motorcycle_brands?.name ?? null,
        motorcycleCategoryName: null,
        imageUrl: m.image_url,
        engineSize: m.engine_size,
        sellingPrice: m.selling_price,
      }));
    },
    enabled: tab === "motorcycles",
  });

  const filteredSubs = useMemo(() => {
    if (categoryId === "__all__") return subcategories as any[];
    return (subcategories as any[]).filter((s: any) => String(s.category_id) === categoryId);
  }, [subcategories, categoryId]);

  function addPart(p: any) {
    if (p.quantityOnHand <= 0) { toast.error("Out of stock"); return; }
    const existing = cart.find(i => i.id === p.id && i.type === "part");
    if (existing) {
      if (existing.quantity >= p.quantityOnHand) { toast.error(`Max stock: ${p.quantityOnHand}`); return; }
      setCart(c => c.map(i => i.id === p.id && i.type === "part" ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart(c => [...c, { id: p.id, name: p.name, sku: p.sku, sellingPrice: parseFloat(p.sellingPrice), quantity: 1, type: "part", maxQty: p.quantityOnHand }]);
    }
    toast.success(`${p.name} added to cart`);
  }

  function addMoto(m: any) {
    if (m.status !== "available") { toast.error("Not available"); return; }
    if (cart.find(i => i.id === m.id && i.type === "motorcycle")) { toast.error("Already in cart"); return; }
    setCart(c => [...c, { id: m.id, name: `${m.make} ${m.model} ${m.year ?? ""}`.trim(), vin: m.vin, sellingPrice: parseFloat(m.selling_price), quantity: 1, type: "motorcycle" }]);
    toast.success(`${m.make} ${m.model} added to cart`);
  }

  function updateQty(idx: number, delta: number) {
    setCart(c => c.map((item, i) => {
      if (i !== idx) return item;
      const newQty = item.quantity + delta;
      if (newQty < 1) return item;
      if (item.maxQty && newQty > item.maxQty) { toast.error(`Max stock: ${item.maxQty}`); return item; }
      return { ...item, quantity: newQty };
    }));
  }

  function removeFromCart(idx: number) {
    setCart(c => c.filter((_, i) => i !== idx));
  }

  const subtotal = cart.reduce((s, i) => s + i.sellingPrice * i.quantity, 0);
  const taxAmount = subtotal * (TAX_RATE / 100);
  const total = subtotal + taxAmount;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const { data: invNum, error: seqErr } = await supabase.rpc("next_document_number", { p_prefix: "INV" });
      if (seqErr) throw new Error(seqErr.message);

      const { data: inv, error: invErr } = await supabase.from("invoices").insert({
        invoice_number: invNum,
        customer_name: customerName.trim() || "Walk-in Customer",
        customer_phone: customerPhone || null,
        payment_method: paymentMethod,
        status: "paid",
        subtotal,
        tax_amount: taxAmount,
        total_amount: total,
        created_by: user?.id ?? null,
      }).select().single();
      if (invErr) throw new Error(invErr.message);

      const lineRows = cart.map(item => ({
        invoice_id: inv.id,
        part_id: item.type === "part" ? item.id : null,
        motorcycle_id: item.type === "motorcycle" ? item.id : null,
        description: item.name,
        quantity: item.quantity,
        unit_price: item.sellingPrice,
        total_price: item.sellingPrice * item.quantity,
      }));
      const { error: linesErr } = await supabase.from("invoice_lines").insert(lineRows);
      if (linesErr) throw new Error(linesErr.message);

      for (const item of cart) {
        if (item.type === "part") {
          const { data: partData } = await supabase.from("parts").select("quantity_on_hand").eq("id", item.id).single();
          if (partData) {
            await supabase.from("parts").update({ quantity_on_hand: partData.quantity_on_hand - item.quantity }).eq("id", item.id);
          }
        } else if (item.type === "motorcycle") {
          await supabase.from("motorcycles").update({ status: "sold" }).eq("id", item.id);
        }
      }

      const { data: lines } = await supabase.from("invoice_lines").select("*, parts(name)").eq("invoice_id", inv.id);
      return { ...inv, lines: lines ?? [] };
    },
    onSuccess: (invDetail) => {
      toast.success(`Invoice ${invDetail.invoice_number} created!`);
      setCart([]); setCustomerName(""); setCustomerPhone("");
      queryClient.invalidateQueries({ queryKey: ["/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/pos-parts"] });
      queryClient.invalidateQueries({ queryKey: ["/pos-motorcycles"] });
      setReceiptData(invDetail);
      setShowReceipt(true);
    },
    onError: (err: any) => toast.error(err.message ?? "Checkout failed"),
  });

  function handleCheckout() {
    if (!customerName.trim() && cart.length > 0) {
      setCustomerName("Walk-in Customer");
    }
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    checkoutMutation.mutate();
  }

  const isLoading = tab === "parts" ? partsLoading : motosLoading;

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_370px] gap-4 h-[calc(100vh-7rem)]">

        {/* ══════ LEFT: Product Catalog ══════ */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex flex-col sm:flex-row gap-2">
            <Tabs value={tab} onValueChange={v => setTab(v as "parts" | "motorcycles")} className="shrink-0">
              <TabsList className="h-9">
                <TabsTrigger value="parts" className="gap-1.5 text-sm">
                  <Package className="h-3.5 w-3.5" /> {t("pos.partsTab")}
                </TabsTrigger>
                <TabsTrigger value="motorcycles" className="gap-1.5 text-sm">
                  <Bike className="h-3.5 w-3.5" /> {t("pos.motorcyclesTab")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={tab === "parts" ? t("pos.searchParts") : t("pos.searchMotorcycles")}
                className="pl-8 h-9" value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

            {tab === "parts" && (
              <>
                <Select value={categoryId} onValueChange={v => setCategoryId(v)}>
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder={t("pos.allCategories")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t("pos.allCategories")}</SelectItem>
                    {(categories as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={subcategoryId} onValueChange={v => setSubcategoryId(v)}>
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder={t("pos.allSubcategories")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t("pos.allSubcategories")}</SelectItem>
                    {filteredSubs.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}

            {tab === "motorcycles" && (
              <>
                <Select value={brandId} onValueChange={v => setBrandId(v)}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder={t("pos.allBrands")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t("pos.allBrands")}</SelectItem>
                    {(brands as any[]).map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={motorcycleCatId} onValueChange={v => setMotorcycleCatId(v)}>
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder={t("pos.allMotoCategories")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t("pos.allMotoCategories")}</SelectItem>
                    {(motoCategories as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={motoStatus} onValueChange={v => setMotoStatus(v)}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t("pos.allStatuses")}</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="in_service">In Service</SelectItem>
                    <SelectItem value="pre_owned">Pre-owned</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}

            <Select value={condition} onValueChange={v => setCondition(v)}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder={t("pos.allConditions")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("pos.allConditions")}</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="used">Used</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
              onClick={() => { setSearch(""); setCategoryId("__all__"); setSubcategoryId("__all__"); setBrandId("__all__"); setMotorcycleCatId("__all__"); setCondition("__all__"); }}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto rounded-lg border bg-muted/20 p-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">{t("common.loading")}</div>
            ) : tab === "parts" ? (
              (parts as any[]).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <Package className="h-10 w-10 opacity-20" /><span className="text-sm">{t("pos.noProducts")}</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {(parts as any[]).map((p: any) => (
                    <div key={p.id} className="bg-white rounded-lg border p-3 flex flex-col gap-2 hover:border-orange-300 hover:shadow-sm transition-all">
                      {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-full h-24 object-cover rounded-md border" />}
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm leading-tight truncate" title={p.name}>{p.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.sku}</div>
                        </div>
                        {conditionBadge(p.condition)}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight">
                        {[p.categoryName, p.subcategoryName].filter(Boolean).join(" › ")}
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-1 border-t">
                        <div>
                          <div className="font-bold text-orange-600 text-sm">{formatCurrency(parseFloat(p.sellingPrice))}</div>
                          <div className={`text-[10px] ${p.quantityOnHand > 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {p.quantityOnHand > 0 ? `${p.quantityOnHand} ${t("pos.inStock")}` : t("pos.outOfStock")}
                          </div>
                        </div>
                        <Button size="sm" disabled={p.quantityOnHand <= 0} className="h-7 w-7 p-0 bg-orange-500 hover:bg-orange-600" onClick={() => addPart(p)} title={t("pos.addToCart")}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              (motorcycles as any[]).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <Bike className="h-10 w-10 opacity-20" /><span className="text-sm">{t("pos.noProducts")}</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {(motorcycles as any[]).map((m: any) => (
                    <div key={m.id} className="bg-white rounded-lg border p-3 flex flex-col gap-2 hover:border-orange-300 hover:shadow-sm transition-all">
                      {m.imageUrl && <img src={m.imageUrl} alt={`${m.make} ${m.model}`} className="w-full h-24 object-cover rounded-md border" />}
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm leading-tight">{m.make} {m.model}</div>
                          <div className="text-[10px] text-muted-foreground">{m.year}{m.color ? ` • ${m.color}` : ""}</div>
                        </div>
                        {conditionBadge(m.condition)}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {statusBadge(m.status)}
                        {m.brandName && <Badge variant="outline" className="text-[10px]">{m.brandName}</Badge>}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">VIN: {m.vin}{m.engine_size ? ` • ${m.engine_size}` : ""}</div>
                      <div className="flex items-center justify-between mt-auto pt-1 border-t">
                        <div className="font-bold text-orange-600 text-sm">{formatCurrency(parseFloat(m.selling_price))}</div>
                        <Button size="sm" disabled={m.status !== "available" || !!cart.find(i => i.id === m.id && i.type === "motorcycle")}
                          className="h-7 w-7 p-0 bg-orange-500 hover:bg-orange-600 disabled:opacity-40" onClick={() => addMoto(m)} title={t("pos.addToCart")}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* ══════ RIGHT: Cart & Checkout ══════ */}
        <div className="flex flex-col gap-3 min-h-0">
          <Card className="shrink-0">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <User className="h-4 w-4 text-orange-500" />{t("pos.customerInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 text-sm" placeholder={t("pos.walkInCustomer")} value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 text-sm" placeholder="012-3456789" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              </div>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-8 text-sm">
                  <CreditCard className="h-3.5 w-3.5 mr-2 text-muted-foreground" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("pos.paymentCash")}</SelectItem>
                  <SelectItem value="card">{t("pos.paymentCard")}</SelectItem>
                  <SelectItem value="transfer">{t("pos.paymentTransfer")}</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-1 pt-3 px-4 shrink-0">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4 text-orange-500" />{t("pos.cart")}
                {cart.length > 0 && <Badge className="ml-auto bg-orange-500 text-white h-5 px-1.5 text-[10px]">{cart.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                  <ShoppingCart className="h-8 w-8 opacity-20" /><span className="text-xs">{t("pos.emptyCart")}</span>
                </div>
              ) : cart.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-muted/40 rounded-md p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground">{item.type === "part" ? item.sku : item.vin}{" · "}{formatCurrency(item.sellingPrice)}</div>
                  </div>
                  {item.type === "part" ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => updateQty(idx, -1)}><Minus className="h-2.5 w-2.5" /></Button>
                      <span className="text-xs w-5 text-center font-medium">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => updateQty(idx, 1)}><Plus className="h-2.5 w-2.5" /></Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0">×1</span>
                  )}
                  <div className="text-xs font-bold text-orange-600 w-16 text-right shrink-0">{formatCurrency(item.sellingPrice * item.quantity)}</div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0" onClick={() => removeFromCart(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shrink-0 border-2 border-orange-100">
            <CardContent className="px-4 pt-3 pb-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("pos.subtotal")}</span><span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("pos.tax")}</span><span>{formatCurrency(taxAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">Total</span>
                <span className="text-xl font-black text-orange-600">{formatCurrency(total)}</span>
              </div>
              <Button
                className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-sm font-bold mt-1"
                disabled={cart.length === 0 || checkoutMutation.isPending}
                onClick={handleCheckout}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {checkoutMutation.isPending ? "Processing..." : t("pos.checkout")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ══════ Receipt Dialog ══════ */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" id="pos-receipt">
          <DialogHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <DialogTitle>{t("pos.saleComplete")}</DialogTitle>
            </div>
          </DialogHeader>
          {receiptData && (
            <div className="space-y-4">
              <div className="text-center border rounded-lg p-4 bg-orange-50">
                <div className="text-2xl font-black text-orange-600">{receiptData.invoice_number}</div>
                <div className="text-xs text-muted-foreground mt-1">{formatDateShort(receiptData.created_at)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">{t("pos.customerName")}</div>
                  <div className="font-medium">{receiptData.customer_name}</div>
                </div>
                {receiptData.customer_phone && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{t("pos.customerPhone")}</div>
                    <div className="font-medium">{receiptData.customer_phone}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">{t("pos.paymentMethod")}</div>
                  <div className="font-medium capitalize">{receiptData.payment_method ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Status</div>
                  <Badge className="bg-green-100 text-green-700 capitalize">{receiptData.status}</Badge>
                </div>
              </div>
              <Separator />
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_auto_auto_auto] text-[10px] text-muted-foreground font-medium pb-1 border-b gap-2">
                  <span>Item</span><span className="text-center">Qty</span><span className="text-right">Unit</span><span className="text-right">Total</span>
                </div>
                {receiptData.lines?.map((line: any, i: number) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] text-xs py-1 gap-2 border-b border-dashed last:border-0">
                    <span className="font-medium leading-tight">{line.parts?.name ?? line.description}</span>
                    <span className="text-center text-muted-foreground">{line.quantity}</span>
                    <span className="text-right">{formatCurrency(parseFloat(line.unit_price))}</span>
                    <span className="text-right font-bold">{formatCurrency(parseFloat(line.total_price))}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(parseFloat(receiptData.subtotal))}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tax (6%)</span><span>{formatCurrency(parseFloat(receiptData.tax_amount))}</span></div>
                <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-orange-600">{formatCurrency(parseFloat(receiptData.total_amount))}</span></div>
              </div>
              <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => setShowReceipt(false)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
