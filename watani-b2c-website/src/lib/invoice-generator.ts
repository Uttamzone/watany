import type { OrderResponse } from "@/lib/admin/types";

function toMoney(val: any): string {
    if (val === null || val === undefined || val === "") return "0.00";
    if (typeof val === "number") return isNaN(val) ? "0.00" : val.toFixed(2);
    const cleaned = String(val).replace(/[^0-9.-]+/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? "0.00" : parsed.toFixed(2);
}

export async function generateInvoicePdf(orderInput: OrderResponse | any): Promise<Blob> {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });

    const order = orderInput || {};
    const orderNumber = String(order.orderNumber || order.order_number || "ORDER").trim();
    const address = order.shippingAddress || order.shipping_address || {};
    const fullName = address.fullName || address.full_name || order.shipFullName || order.ship_full_name || "Customer";
    const line1 = address.line1 || address.address_line1 || order.shipLine1 || order.ship_line1 || "";
    const city = address.city || order.shipCity || order.ship_city || "";
    const region = address.region || address.province || address.state || order.shipRegion || order.ship_region || "";
    const postalCode = address.postalCode || address.postal_code || order.shipPostalCode || order.ship_postal_code || "";
    const country = address.country || order.shipCountry || order.ship_country || "Canada";
    const email = order.email || order.customerEmail || order.customer_email || "—";
    const placedDate = new Date(order.placedAt || order.placed_at || order.createdAt || order.created_at || Date.now());
    const dateStr = isNaN(placedDate.getTime()) ? new Date().toLocaleDateString() : placedDate.toLocaleDateString();
    const statusStr = String(order.status || "CONFIRMED").replace(/_/g, " ");
    const paymentMethodStr = String(order.paymentMethod || order.payment_method || order.paymentProvider || order.payment_provider || "Stripe").replace(/_/g, " ");
    const currency = String(order.currency || "CAD").toUpperCase();

    // Header Background
    doc.setFillColor(15, 45, 40); // Dark Teal #0f2d28
    doc.rect(0, 0, 612, 90, "F");

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("WATANI & SONS CORP", 40, 42);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Official Commercial Invoice", 40, 60);
    doc.text("GST/HST #: 789101112 RT0001", 40, 73);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("INVOICE", 572, 45, { align: "right" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`#${orderNumber}`, 572, 65, { align: "right" });

    // Order Info Section
    let y = 120;
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Billed & Shipped To:", 40, y);
    doc.text("Order Details:", 340, y);

    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(fullName, 40, y);
    doc.text(`Date: ${dateStr}`, 340, y);

    y += 14;
    doc.text(line1, 40, y);
    doc.text(`Status: ${statusStr}`, 340, y);

    y += 14;
    const cityRegion = [city, [region, postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    doc.text(cityRegion, 40, y);
    doc.text(`Payment Method: ${paymentMethodStr}`, 340, y);

    y += 14;
    doc.text(country, 40, y);
    doc.text(`Email: ${email}`, 340, y);

    // Table Header
    y += 35;
    doc.setFillColor(240, 244, 243);
    doc.rect(40, y, 532, 24, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 45, 40);
    doc.text("Item Description", 50, y + 16);
    doc.text("SKU", 280, y + 16);
    doc.text("Qty", 380, y + 16, { align: "right" });
    doc.text("Price", 460, y + 16, { align: "right" });
    doc.text("Total", 562, y + 16, { align: "right" });

    // Table Rows
    y += 24;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);

    const rawItems = Array.isArray(order.items) ? order.items : [];
    for (const item of rawItems) {
        if (y > 700) {
            doc.addPage();
            y = 50;
        }
        y += 18;
        const rawName = item.productName || item.product_name || item.title || item.name || "Product";
        const name = rawName.length > 35 ? rawName.substring(0, 35) + "…" : rawName;
        const sku = item.sku || item.sku_code || item.variantSku || "—";
        const quantity = item.quantity || item.qty || 1;
        const unitPrice = item.unitPrice ?? item.unit_price ?? item.price ?? 0;
        const lineTotal = item.lineTotal ?? item.line_total ?? (Number(quantity) * (Number(unitPrice) || 0));

        doc.text(name, 50, y);
        doc.text(String(sku), 280, y);
        doc.text(String(quantity), 380, y, { align: "right" });
        doc.text(`$${toMoney(unitPrice)}`, 460, y, { align: "right" });
        doc.text(`$${toMoney(lineTotal)}`, 562, y, { align: "right" });

        doc.setDrawColor(230, 230, 230);
        doc.line(40, y + 6, 572, y + 6);
        y += 4;
    }

    // Summary Box
    y += 30;
    if (y > 680) {
        doc.addPage();
        y = 50;
    }

    const rightX = 562;
    const labelX = 440;

    const subtotal = order.subtotal ?? order.sub_total ?? 0;
    const discount = order.discountTotal ?? order.discount_total ?? 0;
    const discountNum = typeof discount === "number" ? discount : parseFloat(String(discount || 0));
    const shipping = order.shippingTotal ?? order.shipping_total ?? 0;
    const taxes = order.taxTotal ?? order.tax_total ?? 0;
    const grandTotal = order.grandTotal ?? order.grand_total ?? order.total_amount ?? order.total ?? 0;

    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", labelX, y, { align: "right" });
    doc.text(`$${toMoney(subtotal)} ${currency}`, rightX, y, { align: "right" });

    if (!isNaN(discountNum) && discountNum > 0) {
        y += 16;
        doc.text("Discount:", labelX, y, { align: "right" });
        doc.text(`-$${toMoney(discountNum)}`, rightX, y, { align: "right" });
    }

    y += 16;
    doc.text("Shipping:", labelX, y, { align: "right" });
    doc.text(`$${toMoney(shipping)}`, rightX, y, { align: "right" });

    y += 16;
    doc.text("Taxes:", labelX, y, { align: "right" });
    doc.text(`$${toMoney(taxes)}`, rightX, y, { align: "right" });

    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 45, 40);
    doc.text("Grand Total:", labelX, y, { align: "right" });
    doc.text(`$${toMoney(grandTotal)} ${currency}`, rightX, y, { align: "right" });

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Thank you for shopping with Watani & Sons Co-op!", 306, 750, { align: "center" });

    return doc.output("blob");
}
