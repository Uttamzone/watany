"use client";

import {useEffect, useState} from "react";
import {
    Check,
    Clock,
    DollarSign,
    Leaf,
    MessageSquareWarning,
    PackageX,
    Receipt,
    ShoppingCart,
    UserCheck,
} from "lucide-react";
import * as adminApi from "@/lib/admin/api";
import type {DashboardKpis, SalesReportDimension, SalesReportRow} from "@/lib/admin/types";
import {ApiError} from "@/lib/api";
import {useNotifications} from "@/components/notifications/notification-store";

function money(value: number) {
    return new Intl.NumberFormat("en-CA", {style: "currency", currency: "CAD"}).format(value);
}

/** Backend day labels are `2026-08-02T00:00:00Z`; week labels are `2026-W31`; month labels are `2026-08`. */
function formatBucketLabel(label: string, dimension: SalesReportDimension): string {
    if (dimension === "day") {
        const date = new Date(label);
        if (Number.isNaN(date.getTime())) return label;
        return new Intl.DateTimeFormat("en-CA", {month: "short", day: "numeric"}).format(date);
    }
    if (dimension === "week") {
        const parts = label.split("-W");
        if (parts.length === 2) {
            return `Wk ${parts[1]}`;
        }
        return label;
    }
    if (dimension === "month") {
        const [year, month] = label.split("-").map(Number);
        if (!year || !month) return label;
        const date = new Date(Date.UTC(year, month - 1, 1));
        return new Intl.DateTimeFormat("en-CA", {month: "short", year: "2-digit"}).format(date);
    }
    return label;
}

const CHART_HEIGHT = 180;

/** Interactive SVG Area & Bar Hybrid Chart with gradient fills, gridlines, and summary stats header. */
function RevenueChart({sales, dimension}: { sales: SalesReportRow[]; dimension: SalesReportDimension }) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const safeSales = Array.isArray(sales) ? sales : [];

    const totalRevenue = safeSales.reduce((acc, r) => acc + (r?.revenue || 0), 0);
    const totalOrders = sales.reduce((acc, r) => acc + r.orderCount, 0);
    const peakRow = sales.reduce((max, r) => (r.revenue > max.revenue ? r : max), sales[0] ?? {revenue: 0, orderCount: 0, label: ""});
    const max = Math.max(...sales.map((row) => row.revenue), 100);

    const maxTicks = 8;
    const tickEvery = Math.max(1, Math.ceil(sales.length / maxTicks));

    // Calculate smooth SVG curve path coordinates
    const width = 800;
    const height = CHART_HEIGHT;
    const points = sales.map((row, i) => {
        const x = sales.length === 1 ? width / 2 : (i / (sales.length - 1)) * width;
        const y = height - (row.revenue / max) * (height - 20) - 10;
        return {x, y, row, i};
    });

    // Build SVG path
    let areaD = "";
    let lineD = "";
    if (points.length > 0) {
        lineD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const mx = (p0.x + p1.x) / 2;
            lineD += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
        }
        areaD = `${lineD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
    }

    const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

    return (
        <div className="space-y-6">
            {/* Report Summary Header */}
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-teal-950/5 p-4 sm:grid-cols-4 sm:gap-4">
                <div className="rounded-xl bg-white p-3 shadow-xs border border-black/5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Period Revenue</p>
                    <p className="mt-1 text-lg sm:text-xl font-extrabold text-teal-950">{money(totalRevenue)}</p>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-xs border border-black/5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Period Orders</p>
                    <p className="mt-1 text-lg sm:text-xl font-extrabold text-teal-950">{totalOrders}</p>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-xs border border-black/5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Avg / Bucket</p>
                    <p className="mt-1 text-lg sm:text-xl font-extrabold text-teal-950">
                        {money(sales.length > 0 ? totalRevenue / sales.length : 0)}
                    </p>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-xs border border-black/5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Peak Period</p>
                    <p className="mt-1 text-lg sm:text-xl font-extrabold text-teal-950">{money(peakRow.revenue)}</p>
                    <p className="text-[11px] font-medium text-teal-800">{formatBucketLabel(peakRow.label, dimension)}</p>
                </div>
            </div>

            {/* Main Interactive Graph */}
            <div className="relative rounded-2xl border border-black/10 bg-white p-4 sm:p-6 shadow-xs">
                {/* SVG Area & Curve Line */}
                <div className="relative h-[200px] w-full">
                    <svg
                        viewBox={`0 0 ${width} ${height}`}
                        preserveAspectRatio="none"
                        className="h-full w-full overflow-visible"
                    >
                        <defs>
                            <linearGradient id="salesAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#005b52" stopOpacity="0.25" />
                                <stop offset="90%" stopColor="#005b52" stopOpacity="0.0" />
                            </linearGradient>
                            <linearGradient id="salesLineGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#003b38" />
                                <stop offset="50%" stopColor="#005b52" />
                                <stop offset="100%" stopColor="#4d7f1e" />
                            </linearGradient>
                        </defs>

                        {/* Y-Axis Reference Gridlines */}
                        {[0, 0.33, 0.66, 1].map((ratio) => {
                            const yVal = height - ratio * (height - 20) - 10;
                            return (
                                <g key={ratio}>
                                    <line
                                        x1="0"
                                        y1={yVal}
                                        x2={width}
                                        y2={yVal}
                                        stroke="#e5e7eb"
                                        strokeDasharray="4 4"
                                        strokeWidth="1"
                                    />
                                    <text
                                        x="4"
                                        y={yVal - 4}
                                        fill="#9ca3af"
                                        fontSize="10"
                                        fontWeight="600"
                                    >
                                        {money(max * ratio)}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Area Fill Path */}
                        {areaD && <path d={areaD} fill="url(#salesAreaGradient)" />}

                        {/* Stroke Line Path */}
                        {lineD && (
                            <path
                                d={lineD}
                                fill="none"
                                stroke="url(#salesLineGradient)"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}

                        {/* Active Hover Marker Point */}
                        {activePoint && (
                            <g transform={`translate(${activePoint.x}, ${activePoint.y})`}>
                                <circle r="8" fill="#a9eb5a" opacity="0.4" className="animate-ping" />
                                <circle r="6" fill="#003b38" stroke="#ffffff" strokeWidth="2" />
                            </g>
                        )}
                    </svg>

                    {/* Interactive Bar Overlay Columns */}
                    <div className="absolute inset-0 flex items-end">
                        {sales.map((row, i) => (
                            <div
                                key={row.label}
                                onMouseEnter={() => setHoveredIdx(i)}
                                onMouseLeave={() => setHoveredIdx(null)}
                                className="group relative flex h-full flex-1 cursor-pointer items-end px-0.5"
                            >
                                <div
                                    className={`w-full rounded-t-sm transition-all duration-200 ${
                                        hoveredIdx === i
                                            ? "bg-lime-400 opacity-100 shadow-md"
                                            : row.revenue > 0
                                            ? "bg-teal-950/15 group-hover:bg-teal-950/40"
                                            : "bg-transparent"
                                    }`}
                                    style={{
                                        height: `${Math.max((row.revenue / max) * 100, row.revenue > 0 ? 6 : 0)}%`,
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Hover Tooltip Popup */}
                {activePoint && (
                    <div
                        className="pointer-events-none absolute z-20 rounded-xl bg-teal-950 p-3 text-white shadow-xl transition-all duration-150"
                        style={{
                            left: `${Math.min(Math.max(10, (activePoint.i / (sales.length - 1)) * 100), 90)}%`,
                            top: "20px",
                            transform: "translateX(-50%)",
                        }}
                    >
                        <p className="text-[11px] font-bold tracking-wider text-lime-400 uppercase">
                            {formatBucketLabel(activePoint.row.label, dimension)}
                        </p>
                        <p className="text-sm font-extrabold">{money(activePoint.row.revenue)}</p>
                        <p className="text-[11px] font-medium text-gray-300">
                            {activePoint.row.orderCount} {activePoint.row.orderCount === 1 ? "order" : "orders"}
                        </p>
                    </div>
                )}

                {/* X-Axis Ticks */}
                <div className="mt-4 flex items-center border-t border-black/5 pt-2">
                    {sales.map((row, index) => {
                        const showTick = index % tickEvery === 0 || index === sales.length - 1;
                        return (
                            <div
                                key={row.label}
                                className={`flex-1 text-center text-[11px] font-medium transition-colors ${
                                    hoveredIdx === index ? "font-extrabold text-teal-950" : "text-muted"
                                }`}
                            >
                                {showTick ? formatBucketLabel(row.label, dimension) : ""}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

type Tone = "teal" | "lime" | "coral" | "gold" | "navy" | "purple";

const PRIMARY_KPI_CARDS: {
    key: keyof DashboardKpis;
    label: string;
    format: (v: number) => string;
    icon: typeof DollarSign;
    tone: Tone;
}[] = [
    {key: "revenue30Days", label: "Revenue (30 days)", format: money, icon: DollarSign, tone: "lime"},
    {key: "ordersTotal", label: "Orders total", format: String, icon: ShoppingCart, tone: "teal"},
    {key: "ordersAwaitingFulfilment", label: "Awaiting fulfilment", format: String, icon: Clock, tone: "navy"},
    {key: "averageOrderValue", label: "Average order value", format: money, icon: Receipt, tone: "purple"},
];

/** Metrics that represent something needing staff attention - get an alert tone once nonzero. */
const ATTENTION_KPI_CARDS: {
    key: keyof DashboardKpis;
    label: string;
    icon: typeof PackageX;
}[] = [
    {key: "lowStockCount", label: "Low stock items", icon: PackageX},
    {key: "pendingApprovals", label: "Pending approvals", icon: UserCheck},
    {key: "pendingReviews", label: "Pending reviews", icon: MessageSquareWarning},
];

type RangeKey = "week" | "month" | "3month" | "year";

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number; dimension: SalesReportDimension }[] = [
    {key: "week", label: "Last week", days: 7, dimension: "day"},
    {key: "month", label: "Last month", days: 30, dimension: "day"},
    {key: "3month", label: "Last 3 months", days: 90, dimension: "week"},
    {key: "year", label: "Last year", days: 365, dimension: "month"},
];

function isoWeekLabel(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Builds the full ordered set of bucket labels the backend is expected to emit for a range,
 *  so the chart always spans the whole requested duration instead of only the buckets that had sales. */
function expectedLabels(option: (typeof RANGE_OPTIONS)[number]): string[] {
    const now = new Date();
    const labels: string[] = [];

    if (option.dimension === "day") {
        for (let i = option.days - 1; i >= 0; i--) {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
            labels.push(d.toISOString().slice(0, 10) + "T00:00:00Z");
        }
    } else if (option.dimension === "week") {
        const weeks = Math.ceil(option.days / 7);
        for (let i = weeks - 1; i >= 0; i--) {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i * 7));
            labels.push(isoWeekLabel(d));
        }
    } else if (option.dimension === "month") {
        for (let i = 11; i >= 0; i--) {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
            labels.push(monthLabel(d));
        }
    }

    return labels;
}

/** Fills gaps in the backend's sparse (orders-only) buckets with zero-value rows so the chart
 *  always renders the full selected duration, not just the days/weeks/months that had sales. */
function fillGaps(sales: SalesReportRow[], option: (typeof RANGE_OPTIONS)[number]): SalesReportRow[] {
    const list = Array.isArray(sales) ? sales : [];
    const byLabel = new Map(list.map((row) => [row.label, row]));
    return expectedLabels(option).map(
        (label) => byLabel.get(label) ?? {label, orderCount: 0, revenue: 0},
    );
}

export default function AdminDashboardPage() {
    const notifications = useNotifications();
    const [kpis, setKpis] = useState<DashboardKpis | null>(null);
    const [sales, setSales] = useState<SalesReportRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState<RangeKey>("month");
    const [salesLoading, setSalesLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        adminApi
            .dashboardKpis()
            .then((kpiResult) => {
                if (cancelled) return;
                setKpis(kpiResult);
            })
            .catch((err) => {
                if (cancelled) return;
                const message = err instanceof ApiError ? err.message : "Failed to load dashboard data.";
                setError(message);
                notifications.error("Failed to load dashboard", message);
            });
        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let cancelled = false;
        const option = RANGE_OPTIONS.find((o) => o.key === range)!;
        queueMicrotask(() => {
            if (!cancelled) setSalesLoading(true);
        });
        adminApi
            .salesReport(option.dimension, option.days)
            .then((salesResult) => {
                if (cancelled) return;
                setSales(fillGaps(salesResult, option));
            })
            .catch((err) => {
                if (cancelled) return;
                const message = err instanceof ApiError ? err.message : "Failed to load sales data.";
                setError(message);
                notifications.error("Failed to load sales data", message);
            })
            .finally(() => {
                if (cancelled) return;
                setSalesLoading(false);
            });
        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range]);

    const loading = kpis === null && !error;
    const salesOption = RANGE_OPTIONS.find((o) => o.key === range)!;

    return (
        <div className="dashboard-surface">
            <header className="dashboard-heading">
                <span className="dashboard-mark" aria-hidden><Leaf/></span>
                <div>
                    <h1>Dashboard</h1>
                    <p>Store performance at a glance.</p>
                </div>
            </header>

            {error && (
                <p className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-[14px] font-medium text-coral">{error}</p>
            )}

            <div className="dashboard-primary-grid">
                {PRIMARY_KPI_CARDS.map((card) => (
                    <DashboardMetricCard
                        key={card.key}
                        label={card.label}
                        value={kpis ? card.format(kpis[card.key]) : "-"}
                        icon={card.icon}
                        tone={card.tone}
                        loading={loading}
                    />
                ))}
            </div>

            <div className="dashboard-attention-grid">
                {ATTENTION_KPI_CARDS.map((card) => {
                    const count = kpis ? kpis[card.key] : null;
                    const needsAttention = count !== null && count > 0;
                    return (
                        <AttentionCard
                            key={card.key}
                            label={card.label}
                            value={count === null ? "-" : String(count)}
                            icon={card.icon}
                            loading={loading}
                            needsAttention={needsAttention}
                        />
                    );
                })}
            </div>

            <div className="dashboard-report-heading">
                <h2 className="text-[18px] font-extrabold text-teal-950">
                    Sales by {salesOption.dimension} ({salesOption.label.toLowerCase()})
                </h2>
                <div className="dashboard-range-control">
                    {RANGE_OPTIONS.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => setRange(option.key)}
                            className={`px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                                range === option.key
                                    ? "bg-teal-800 text-white"
                                    : "text-muted hover:bg-soft-control hover:text-teal-950"
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="dashboard-report-panel">
                {loading || salesLoading ? (
                    <div className="h-40 animate-pulse rounded-xl bg-soft-control" aria-hidden/>
                ) : sales && sales.length > 0 ? (
                    <RevenueChart sales={sales} dimension={salesOption.dimension}/>
                ) : (
                    <p className="py-8 text-center text-[14px] text-muted">No sales in this period.</p>
                )}
            </div>

            {/* Compact Performance Highlights & Optional Collapsible Table */}
            {sales && sales.length > 0 && (
                <CompactSalesBreakdown sales={sales} dimension={salesOption.dimension} />
            )}
        </div>
    );
}

function CompactSalesBreakdown({ sales, dimension }: { sales: SalesReportRow[]; dimension: SalesReportDimension }) {
    const [showDetails, setShowDetails] = useState(false);
    
    // Calculate non-zero sales buckets
    const activeBuckets = sales.filter((r) => r.revenue > 0);
    const topBuckets = [...sales].sort((a, b) => b.revenue - a.revenue).slice(0, 3);
    const totalRev = sales.reduce((acc, r) => acc + r.revenue, 0);
    const totalOrd = sales.reduce((acc, r) => acc + r.orderCount, 0);

    return (
        <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs font-semibold text-teal-950">
                    <span className="flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-teal-900 border border-teal-900/10">
                        <span className="size-2 rounded-full bg-teal-600" />
                        <strong>{activeBuckets.length}</strong> active sales {dimension === "day" ? "days" : dimension === "week" ? "weeks" : "months"}
                    </span>
                    <span className="hidden sm:inline text-muted">
                        Avg order: <strong className="text-teal-950">{money(totalOrd > 0 ? totalRev / totalOrd : 0)}</strong>
                    </span>
                </div>

                {/* Top Buckets Badges */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted hidden md:inline">Top Performers:</span>
                    {topBuckets.map((b) => (
                        <span key={b.label} className="rounded-lg bg-teal-950/5 px-2.5 py-1 text-[11px] font-bold text-teal-950 border border-black/5">
                            {formatBucketLabel(b.label, dimension)}: <span className="text-teal-800">{money(b.revenue)}</span>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={() => setShowDetails((v) => !v)}
                        className="ml-2 rounded-xl bg-soft-control px-3 py-1.5 text-xs font-bold text-teal-950 hover:bg-black/10 transition-colors cursor-pointer"
                    >
                        {showDetails ? "Hide Table" : "Show Full Table"}
                    </button>
                </div>
            </div>

            {/* Collapsible Full Table */}
            {showDetails && (
                <div className="mt-4 border-t border-black/5 pt-3">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-black/5 font-bold uppercase tracking-wider text-muted">
                                <th className="py-2 capitalize">{dimension}</th>
                                <th className="py-2">Orders</th>
                                <th className="py-2 text-right">Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map((row) => (
                                <tr key={row.label} className="border-b border-black/5 last:border-0 hover:bg-teal-50/50">
                                    <td className="py-2 font-medium">{formatBucketLabel(row.label, dimension)}</td>
                                    <td className="py-2">{row.orderCount}</td>
                                    <td className="py-2 text-right font-bold text-teal-950">{money(row.revenue)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function DashboardMetricCard({
                                 label,
                                 value,
                                 icon: Icon,
                                 tone,
                                 loading,
                             }: {
    label: string;
    value: string;
    icon: typeof DollarSign;
    tone: Tone;
    loading: boolean;
}) {
    const tones: Record<Tone, { bg: string; fg: string }> = {
        teal: {bg: "#f0f5e9", fg: "#4d7f1e"},
        lime: {bg: "#f0f5e9", fg: "#4d7f1e"},
        coral: {bg: "#f0f5e9", fg: "#4d7f1e"},
        gold: {bg: "#f0f5e9", fg: "#4d7f1e"},
        navy: {bg: "#f0f5e9", fg: "#4d7f1e"},
        purple: {bg: "#f0f5e9", fg: "#4d7f1e"},
    };
    const tint = tones[tone];
    return (
        <article className="dashboard-metric-card">
            <div className="dashboard-card-topline">
                <p>{label}</p>
                <span style={{backgroundColor: tint.bg, color: tint.fg}}><Icon aria-hidden/></span>
            </div>
            {loading ? <div className="dashboard-value-skeleton" aria-hidden/> :
                <p className="dashboard-value">{value}</p>}
            <div className="dashboard-card-meta"><span
                className="dashboard-live-pill">Live</span><span>from store data</span></div>
        </article>
    );
}

function AttentionCard({
                           label, value, icon: Icon, loading, needsAttention,
                       }: {
    label: string;
    value: string;
    icon: typeof PackageX;
    loading: boolean;
    needsAttention: boolean
}) {
    return (
        <article className={`dashboard-attention-card ${needsAttention ? "is-alert" : ""}`}>
            <div className="dashboard-card-topline">
                <p>{label}</p>
                <span><Icon aria-hidden/></span>
            </div>
            {loading ? <div className="dashboard-value-skeleton" aria-hidden/> :
                <p className="dashboard-value">{value}</p>}
            <div className="dashboard-attention-status">
                <span><Check aria-hidden/></span>
                <p>{needsAttention ? "Needs your attention." : `All good! No ${label.toLowerCase()}.`}</p>
            </div>
        </article>
    );
}
