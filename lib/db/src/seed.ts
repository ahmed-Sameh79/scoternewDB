import { db } from "./index";
import { eq } from "drizzle-orm";
import {
  usersTable,
  warehousesTable,
  binsTable,
  partsTable,
  motorcyclesTable,
  vendorsTable,
  purchaseOrdersTable,
  purchaseOrderLinesTable,
  workOrdersTable,
  invoicesTable,
  invoiceLinesTable,
} from "./schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  // Users
  const passwordHash = await bcrypt.hash("admin123", 10);
  const users = await db.insert(usersTable).values([
    { username: "admin", fullName: "System Admin", passwordHash, role: "admin", email: "admin@motoshop.com" },
    { username: "store1", fullName: "Ali Hassan", passwordHash: await bcrypt.hash("store123", 10), role: "storekeeper", email: "ali@motoshop.com" },
    { username: "tech1", fullName: "Rahman Khan", passwordHash: await bcrypt.hash("tech123", 10), role: "technician", email: "rahman@motoshop.com" },
    { username: "sales1", fullName: "Siti Aminah", passwordHash: await bcrypt.hash("sales123", 10), role: "sales", email: "siti@motoshop.com" },
  ]).onConflictDoNothing().returning();
  console.log(`Created ${users.length} users`);

  // Warehouses
  const warehouses = await db.insert(warehousesTable).values([
    { name: "Main Warehouse", location: "Jalan Merdeka 1, KL", description: "Primary warehouse for all stock" },
    { name: "Branch Warehouse", location: "Jalan PJ 5, Petaling Jaya", description: "Branch stock storage" },
  ]).onConflictDoNothing().returning();
  console.log(`Created ${warehouses.length} warehouses`);

  const wh1 = warehouses[0]?.id;
  const wh2 = warehouses[1]?.id;

  // Bins
  const bins: Array<{ warehouseId: number; zone: string; aisle: string; shelf: string; bin: string; label: string }> = [];
  if (wh1) {
    for (const zone of ["A", "B"]) {
      for (const aisle of ["01", "02"]) {
        for (const shelf of ["01"]) {
          for (const bin of ["01", "02", "03"]) {
            bins.push({ warehouseId: wh1, zone, aisle, shelf, bin, label: `${zone}-${aisle}-${shelf}-${bin}` });
          }
        }
      }
    }
  }
  const createdBins = await db.insert(binsTable).values(bins).onConflictDoNothing().returning();
  console.log(`Created ${createdBins.length} bins`);

  const bin1 = createdBins[0]?.id;

  // Vendors
  const vendors = await db.insert(vendorsTable).values([
    { name: "Yamaha Parts Sdn Bhd", contactPerson: "Mr. Chan", email: "yamaha@vendor.com", phone: "+60312345678", address: "Shah Alam, Selangor" },
    { name: "Honda Auto Parts", contactPerson: "Ms. Lee", email: "honda@vendor.com", phone: "+60387654321", address: "Subang Jaya, Selangor" },
    { name: "Suzuki Components", contactPerson: "Mr. Tan", email: "suzuki@vendor.com", phone: "+60323456789", address: "Cheras, KL" },
  ]).onConflictDoNothing().returning();
  console.log(`Created ${vendors.length} vendors`);

  // Parts
  const parts = await db.insert(partsTable).values([
    { sku: "OIL-10W40-1L", name: "Engine Oil 10W-40 1L", condition: "new", modelCompatibility: "Universal", quantityOnHand: 50, reorderPoint: 10, costPrice: "15.00", sellingPrice: "25.00", warehouseId: wh1 ?? undefined, binId: bin1 ?? undefined },
    { sku: "YAM-BRAKE-F-R1", name: "Front Brake Pad Yamaha R1", condition: "new", modelCompatibility: "Yamaha R1 2019-2023", quantityOnHand: 15, reorderPoint: 5, costPrice: "45.00", sellingPrice: "80.00", warehouseId: wh1 ?? undefined },
    { sku: "HON-CHAIN-CBR", name: "Drive Chain Honda CBR 520", condition: "new", modelCompatibility: "Honda CBR 500/600", quantityOnHand: 8, reorderPoint: 5, costPrice: "120.00", sellingPrice: "180.00", warehouseId: wh1 ?? undefined },
    { sku: "UNI-SPARK-NGK", name: "NGK Spark Plug BR9ES", condition: "new", modelCompatibility: "Universal", quantityOnHand: 30, reorderPoint: 10, costPrice: "8.00", sellingPrice: "15.00", warehouseId: wh1 ?? undefined },
    { sku: "SUZ-AIRFILTER-GS", name: "Air Filter Suzuki GSX-R", condition: "new", modelCompatibility: "Suzuki GSX-R 600/750", quantityOnHand: 4, reorderPoint: 5, costPrice: "35.00", sellingPrice: "65.00", warehouseId: wh2 ?? undefined },
    { sku: "YAM-TIRE-FR-R3", name: "Front Tire Yamaha R3 110/70-17", condition: "new", modelCompatibility: "Yamaha R3", quantityOnHand: 6, reorderPoint: 3, costPrice: "180.00", sellingPrice: "280.00", warehouseId: wh1 ?? undefined },
    { sku: "UNI-CABLE-THROTTLE", name: "Throttle Cable Universal 1m", condition: "used", modelCompatibility: "Universal", quantityOnHand: 12, reorderPoint: 5, costPrice: "10.00", sellingPrice: "22.00", warehouseId: wh1 ?? undefined },
  ]).onConflictDoNothing().returning();
  console.log(`Created ${parts.length} parts`);

  // Motorcycles
  const motorcycles = await db.insert(motorcyclesTable).values([
    { make: "Yamaha", model: "R1", year: 2022, vin: "YAM-R1-2022-001", color: "Blue/White", engineSize: "998cc", mileage: 0, status: "available", costPrice: "65000.00", sellingPrice: "78000.00", warehouseId: wh1 ?? undefined },
    { make: "Honda", model: "CBR600RR", year: 2021, vin: "HON-CBR-2021-001", color: "Red/Black", engineSize: "599cc", mileage: 0, status: "available", costPrice: "55000.00", sellingPrice: "68000.00", warehouseId: wh1 ?? undefined },
    { make: "Suzuki", model: "GSX-R750", year: 2023, vin: "SUZ-GSXR-2023-001", color: "Blue/Silver", engineSize: "750cc", mileage: 0, status: "available", costPrice: "60000.00", sellingPrice: "72000.00", warehouseId: wh2 ?? undefined },
    { make: "Kawasaki", model: "Ninja ZX-10R", year: 2022, vin: "KAW-ZX10-2022-001", color: "Green/Black", engineSize: "998cc", mileage: 5200, status: "pre_owned", costPrice: "48000.00", sellingPrice: "58000.00", warehouseId: wh1 ?? undefined },
    { make: "Yamaha", model: "MT-09", year: 2023, vin: "YAM-MT09-2023-001", color: "Matte Grey", engineSize: "889cc", mileage: 0, status: "available", costPrice: "42000.00", sellingPrice: "52000.00", warehouseId: wh1 ?? undefined },
    { make: "Honda", model: "CB500F", year: 2021, vin: "HON-CB500-2021-001", color: "White", engineSize: "471cc", mileage: 12000, status: "in_service", costPrice: "22000.00", sellingPrice: "28000.00", warehouseId: wh1 ?? undefined },
  ]).onConflictDoNothing().returning();
  console.log(`Created ${motorcycles.length} motorcycles`);

  // Purchase Orders
  if (vendors.length > 0 && parts.length > 0) {
    const po = await db.insert(purchaseOrdersTable).values({
      poNumber: "PO-0001",
      vendorId: vendors[0].id,
      status: "ordered",
      totalAmount: "1575.00",
      notes: "Monthly restocking order",
      orderedAt: new Date("2025-03-01"),
      createdBy: users[0]?.id,
    }).onConflictDoNothing().returning();

    if (po.length > 0) {
      await db.insert(purchaseOrderLinesTable).values([
        { purchaseOrderId: po[0].id, partId: parts[0].id, quantity: 30, unitCost: "15.00", totalCost: "450.00" },
        { purchaseOrderId: po[0].id, partId: parts[1].id, quantity: 10, unitCost: "45.00", totalCost: "450.00" },
        { purchaseOrderId: po[0].id, partId: parts[3].id, quantity: 25, unitCost: "8.00", totalCost: "200.00" },
      ]).onConflictDoNothing();
      console.log("Created 1 purchase order");
    }
  }

  // Work Orders
  if (motorcycles.length > 0 && users.length >= 3) {
    const techUser = users.find(u => u.role === "technician");
    const wo = await db.insert(workOrdersTable).values([
      {
        woNumber: "WO-0001",
        customerName: "Ahmad bin Ibrahim",
        customerPhone: "+60123456789",
        motorcycleId: motorcycles[5]?.id,
        description: "Full service: oil change, brake inspection, chain adjustment",
        status: "parts_reserved",
        assignedTo: techUser?.id,
        laborCost: "150.00",
        totalPartsCost: "50.00",
        createdBy: users[0]?.id,
      },
      {
        woNumber: "WO-0002",
        customerName: "Nurul binti Ahmad",
        customerPhone: "+60198765432",
        description: "Front brake pad replacement",
        status: "draft",
        laborCost: "80.00",
        totalPartsCost: "0.00",
        createdBy: users[0]?.id,
      },
    ]).onConflictDoNothing().returning();
    console.log(`Created ${wo.length} work orders`);
  }

  // Sample Invoice
  if (motorcycles.length > 0 && users.length > 0) {
    const inv = await db.insert(invoicesTable).values({
      invoiceNumber: "INV-0001",
      customerName: "Lim Wei Ming",
      customerPhone: "+60112345678",
      status: "paid",
      subtotal: "78000.00",
      taxAmount: "4680.00",
      totalAmount: "82680.00",
      paymentMethod: "cash",
      createdBy: users[0]?.id,
    }).onConflictDoNothing().returning();

    if (inv.length > 0) {
      await db.insert(invoiceLinesTable).values({
        invoiceId: inv[0].id,
        motorcycleId: motorcycles[0].id,
        description: "Yamaha R1 2022 - Blue/White",
        quantity: 1,
        unitPrice: "78000.00",
        totalPrice: "78000.00",
      }).onConflictDoNothing();

      // Mark first motorcycle as sold (Yamaha R1)
      await db.update(motorcyclesTable)
        .set({ status: "sold", updatedAt: new Date() })
        .where(eq(motorcyclesTable.id, motorcycles[0].id));
    }
    console.log(`Created sample invoice`);
  }

  console.log("Seeding complete!");
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
}).finally(() => process.exit(0));
