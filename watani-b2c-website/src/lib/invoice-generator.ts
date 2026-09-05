import type { OrderResponse } from "@/lib/admin/types";

export async function generateInvoicePdf(order: OrderResponse): Promise<Blob> {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });

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
    doc.text(`#${order.orderNumber}`, 572, 65, { align: "right" });

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
    doc.text(order.shippingAddress?.fullName || "Customer", 40, y);
    doc.text(`Date: ${new Date(order.placedAt || Date.now()).toLocaleDateString()}`, 340, y);

    y += 14;
    doc.text(order.shippingAddress?.line1 || "", 40, y);
    doc.text(`Status: ${order.status?.replace(/_/g, " ") || "CONFIRMED"}`, 340, y);

    y += 14;
    doc.text(`${order.shippingAddress?.city || ""}, ${order.shippingAddress?.region || ""} ${order.shippingAddress?.postalCode || ""}`, 40, y);
    doc.text(`Payment Method: ${order.paymentMethod?.replace(/_/g, " ") || "Stripe"}`, 340, y);

    y += 14;
    doc.text(order.shippingAddress?.country || "Canada", 40, y);
    doc.text(`Email: ${order.email || "—"}`, 340, y);

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

    const items = order.items || [];
    for (const item of items) {
        if (y > 700) {
            doc.addPage();
            y = 50;
        }
        y += 18;
        const name = (item.productName || "Product").length > 35 
            ? (item.productName || "Product").substring(0, 35) + "…" 
            : (item.productName || "Product");
        doc.text(name, 50, y);
        doc.text(item.sku || "—", 280, y);
        doc.text(String(item.quantity || 1), 380, y, { align: "right" });
        doc.text(`$${(item.unitPrice || 0).toFixed(2)}`, 460, y, { align: "right" });
        doc.text(`$${(item.lineTotal || 0).toFixed(2)}`, 562, y, { align: "right" });

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

    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", labelX, y, { align: "right" });
    doc.text(`$${(order.subtotal || 0).toFixed(2)} ${order.currency || "CAD"}`, rightX, y, { align: "right" });

    if (order.discountTotal && order.discountTotal > 0) {
        y += 16;
        doc.text("Discount:", labelX, y, { align: "right" });
        doc.text(`-$${order.discountTotal.toFixed(2)}`, rightX, y, { align: "right" });
    }

    y += 16;
    doc.text("Shipping:", labelX, y, { align: "right" });
    doc.text(`$${(order.shippingTotal || 0).toFixed(2)}`, rightX, y, { align: "right" });

    y += 16;
    doc.text("Taxes:", labelX, y, { align: "right" });
    doc.text(`$${(order.taxTotal || 0).toFixed(2)}`, rightX, y, { align: "right" });

    y += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 45, 40);
    doc.text("Grand Total:", labelX, y, { align: "right" });
    doc.text(`$${(order.grandTotal || 0).toFixed(2)} ${order.currency || "CAD"}`, rightX, y, { align: "right" });

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Thank you for shopping with Watani & Sons Co-op!", 306, 750, { align: "center" });

    return doc.output("blob");
}
