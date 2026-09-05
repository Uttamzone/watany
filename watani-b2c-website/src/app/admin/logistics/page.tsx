"use client";

import { useState } from "react";
import {
    Truck,
    PackageCheck,
    Globe,
    Building2,
    DollarSign,
    Users,
    CheckCircle2,
    Clock,
    AlertCircle,
    FileText,
    ArrowUpRight,
    Search,
    Filter,
    Plus,
    RefreshCw
} from "lucide-react";
import { useNotifications } from "@/components/notifications/notification-store";
import { adminFieldClass, adminFieldLabelClass, AdminModal } from "@/components/admin/admin-modal";

type LogisticsTab = "containers" | "agents" | "pricing" | "remittance";

interface ContainerItem {
    id: string;
    containerNumber: string;
    origin: string;
    destination: string;
    status: "IN_TRANSIT" | "CUSTOMS_HOLD" | "RECEIVED" | "PROCESSING";
    casesCount: number;
    weightKg: number;
    eta: string;
    carrier: string;
}

interface AgentItem {
    id: number;
    name: string;
    region: string;
    email: string;
    phone: string;
    status: "APPROVED" | "PENDING" | "SUSPENDED";
    totalOrdersHandled: number;
    pendingRemittanceCad: number;
}

interface FreightRateItem {
    id: number;
    zoneName: string;
    originCountry: string;
    destCountry: string;
    basePriceCad: number;
    perKgRateCad: number;
    doorToDoorSupported: boolean;
}

const SAMPLE_CONTAINERS: ContainerItem[] = [
    {
        id: "CT-89402",
        containerNumber: "AMN-U-894021-9",
        origin: "Ashdod / Haifa Port",
        destination: "Ottawa Central Warehouse (K1G 3N3)",
        status: "IN_TRANSIT",
        casesCount: 420,
        weightKg: 6400,
        eta: "2026-09-08",
        carrier: "ZIM Integrated Shipping"
    },
    {
        id: "CT-89405",
        containerNumber: "AMN-U-773910-4",
        origin: "Tulkarm Direct Depot",
        destination: "Toronto Logistics Hub (M5V 2T6)",
        status: "CUSTOMS_HOLD",
        casesCount: 280,
        weightKg: 4100,
        eta: "2026-09-11",
        carrier: "Maersk Line"
    },
    {
        id: "CT-89399",
        containerNumber: "AMN-U-654109-2",
        origin: "Jenin Estate Terminal",
        destination: "Montreal Cargo Center",
        status: "RECEIVED",
        casesCount: 510,
        weightKg: 7800,
        eta: "2026-09-02",
        carrier: "Watani Dedicated Freight"
    }
];

const SAMPLE_AGENTS: AgentItem[] = [
    {
        id: 1,
        name: "Amanat West Bank Operations",
        region: "Ramallah / Nablus Regional Hub",
        email: "westbank.ops@amanatlogistics.com",
        phone: "+970 59 912 3456",
        status: "APPROVED",
        totalOrdersHandled: 142,
        pendingRemittanceCad: 4250.00
    },
    {
        id: 2,
        name: "Amanat Jordan Transit Depot",
        region: "Amman Cargo Terminal",
        email: "amman.depot@amanatlogistics.com",
        phone: "+962 6 555 8901",
        status: "APPROVED",
        totalOrdersHandled: 98,
        pendingRemittanceCad: 1890.50
    },
    {
        id: 3,
        name: "North America Door2Door Express",
        region: "Ontario / Quebec Door Service",
        email: "ca.door2door@watani.ca",
        phone: "+1 613 854 7777",
        status: "PENDING",
        totalOrdersHandled: 24,
        pendingRemittanceCad: 620.00
    }
];

const SAMPLE_RATES: FreightRateItem[] = [
    {
        id: 1,
        zoneName: "Canada Door-to-Door Standard",
        originCountry: "Palestine / Jordan",
        destCountry: "Canada",
        basePriceCad: 45.00,
        perKgRateCad: 4.50,
        doorToDoorSupported: true
    },
    {
        id: 2,
        zoneName: "USA Freightcom Priority Express",
        originCountry: "Palestine / Jordan",
        destCountry: "United States",
        basePriceCad: 65.00,
        perKgRateCad: 6.20,
        doorToDoorSupported: true
    },
    {
        id: 3,
        zoneName: "Pallet Freight Commercial Direct",
        originCountry: "Ashdod Port",
        destCountry: "Canada (Commercial)",
        basePriceCad: 250.00,
        perKgRateCad: 1.20,
        doorToDoorSupported: false
    }
];

export default function AdminLogisticsPage() {
    const notifications = useNotifications();
    const [activeTab, setActiveTab] = useState<LogisticsTab>("containers");
    const [containers, setContainers] = useState<ContainerItem[]>(SAMPLE_CONTAINERS);
    const [agents, setAgents] = useState<AgentItem[]>(SAMPLE_AGENTS);
    const [rates, setRates] = useState<FreightRateItem[]>(SAMPLE_RATES);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal States
    const [showNewContainerModal, setShowNewContainerModal] = useState(false);
    const [showNewAgentModal, setShowNewAgentModal] = useState(false);
    const [showNewRateModal, setShowNewRateModal] = useState(false);

    // Form Drafts
    const [containerDraft, setContainerDraft] = useState<Omit<ContainerItem, "id">>({
        containerNumber: "",
        origin: "",
        destination: "",
        status: "IN_TRANSIT",
        casesCount: 300,
        weightKg: 4500,
        eta: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        carrier: "Amanat Express Freight"
    });

    const [agentDraft, setAgentDraft] = useState<Omit<AgentItem, "id">>({
        name: "",
        region: "",
        email: "",
        phone: "",
        status: "PENDING",
        totalOrdersHandled: 0,
        pendingRemittanceCad: 0
    });

    const [rateDraft, setRateDraft] = useState<Omit<FreightRateItem, "id">>({
        zoneName: "",
        originCountry: "Palestine",
        destCountry: "Canada",
        basePriceCad: 50.00,
        perKgRateCad: 5.00,
        doorToDoorSupported: true
    });

    function handleApproveAgent(id: number) {
        setAgents(prev =>
            prev.map(a => (a.id === id ? { ...a, status: "APPROVED" } : a))
        );
        notifications.success("Agent Approved", "Agent operational credentials have been verified.");
    }

    function handleReceiveContainer(id: string) {
        setContainers(prev =>
            prev.map(c => (c.id === id ? { ...c, status: "RECEIVED" } : c))
        );
        notifications.success("Container Received", `Container ${id} marked as received into warehouse inventory.`);
    }

    function handleAddContainer(e: React.FormEvent) {
        e.preventDefault();
        const newContainer: ContainerItem = {
            id: `CT-${Math.floor(10000 + Math.random() * 90000)}`,
            ...containerDraft
        };
        setContainers(prev => [newContainer, ...prev]);
        setShowNewContainerModal(false);
        notifications.success("Container Added", `Container ${newContainer.containerNumber} manifest logged.`);
        setContainerDraft({
            containerNumber: "",
            origin: "",
            destination: "",
            status: "IN_TRANSIT",
            casesCount: 300,
            weightKg: 4500,
            eta: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
            carrier: "Amanat Express Freight"
        });
    }

    function handleAddAgent(e: React.FormEvent) {
        e.preventDefault();
        const newAgent: AgentItem = {
            id: Date.now(),
            ...agentDraft
        };
        setAgents(prev => [newAgent, ...prev]);
        setShowNewAgentModal(false);
        notifications.success("Agent Registered", `Agent ${newAgent.name} added to logistics network.`);
        setAgentDraft({
            name: "",
            region: "",
            email: "",
            phone: "",
            status: "PENDING",
            totalOrdersHandled: 0,
            pendingRemittanceCad: 0
        });
    }

    function handleAddRate(e: React.FormEvent) {
        e.preventDefault();
        const newRate: FreightRateItem = {
            id: Date.now(),
            ...rateDraft
        };
        setRates(prev => [newRate, ...prev]);
        setShowNewRateModal(false);
        notifications.success("Rate Added", `Freight rate zone "${newRate.zoneName}" added.`);
        setRateDraft({
            zoneName: "",
            originCountry: "Palestine",
            destCountry: "Canada",
            basePriceCad: 50.00,
            perKgRateCad: 5.00,
            doorToDoorSupported: true
        });
    }

    const filteredContainers = containers.filter(
        c =>
            c.containerNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.destination.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-950/10 px-3 py-1 text-[12px] font-bold text-teal-950">
                            <Truck className="size-3.5" /> Amanat Logistics &amp; Freight Hub
                        </span>
                    </div>
                    <h1 className="mt-2 text-[26px] font-extrabold text-teal-950">
                        Logistics &amp; Supply Chain Management
                    </h1>
                    <p className="mt-1 text-[13px] text-muted">
                        Integrated Amanat Freight Control, Door-to-Door Shipments, Agent Remittances &amp; Container Tracking.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {activeTab === "containers" && (
                        <button
                            onClick={() => setShowNewContainerModal(true)}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 shadow-xs hover:bg-lime-400"
                        >
                            <Plus className="size-4" /> New Container Manifest
                        </button>
                    )}
                    {activeTab === "agents" && (
                        <button
                            onClick={() => setShowNewAgentModal(true)}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 shadow-xs hover:bg-lime-400"
                        >
                            <Plus className="size-4" /> Add Logistics Agent
                        </button>
                    )}
                    {activeTab === "pricing" && (
                        <button
                            onClick={() => setShowNewRateModal(true)}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-lime-500 px-4 text-[13px] font-bold text-teal-950 shadow-xs hover:bg-lime-400"
                        >
                            <Plus className="size-4" /> Add Freight Zone Rate
                        </button>
                    )}
                    <button
                        onClick={() => notifications.info("Syncing Logistics", "Refreshed container manifests from Amanat Freight API.")}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-[13px] font-bold text-teal-950 shadow-xs hover:bg-neutral-50"
                    >
                        <RefreshCw className="size-4" /> Sync Freight
                    </button>
                </div>
            </div>

            {/* Quick Summary KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
                    <div className="flex items-center justify-between text-muted">
                        <span className="text-[12px] font-semibold uppercase tracking-wider">Active Containers</span>
                        <Truck className="size-5 text-teal-950" />
                    </div>
                    <p className="mt-2 text-[28px] font-extrabold text-teal-950">
                        {containers.filter(c => c.status === "IN_TRANSIT" || c.status === "CUSTOMS_HOLD").length}
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> 3 Containers in Pipeline
                    </p>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
                    <div className="flex items-center justify-between text-muted">
                        <span className="text-[12px] font-semibold uppercase tracking-wider">Total Tonnage</span>
                        <PackageCheck className="size-5 text-teal-950" />
                    </div>
                    <p className="mt-2 text-[28px] font-extrabold text-teal-950">
                        18.3 <span className="text-[16px] font-normal text-muted">Tons</span>
                    </p>
                    <p className="mt-1 text-[12px] text-muted">1,210 Cases currently in transit</p>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
                    <div className="flex items-center justify-between text-muted">
                        <span className="text-[12px] font-semibold uppercase tracking-wider">Amanat Agents</span>
                        <Users className="size-5 text-teal-950" />
                    </div>
                    <p className="mt-2 text-[28px] font-extrabold text-teal-950">
                        {agents.length} <span className="text-[14px] font-bold text-emerald-600">Active</span>
                    </p>
                    <p className="mt-1 text-[12px] text-muted">Across CA, US, Palestine &amp; Jordan</p>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
                    <div className="flex items-center justify-between text-muted">
                        <span className="text-[12px] font-semibold uppercase tracking-wider">Pending Remittance</span>
                        <DollarSign className="size-5 text-teal-950" />
                    </div>
                    <p className="mt-2 text-[28px] font-extrabold text-teal-950">
                        ${agents.reduce((acc, a) => acc + a.pendingRemittanceCad, 0).toLocaleString("en-CA", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 text-[12px] text-amber-600 font-medium flex items-center gap-1">
                        <Clock className="size-3.5" /> Ready for weekly payout
                    </p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-black/10">
                <button
                    onClick={() => setActiveTab("containers")}
                    className={`flex items-center gap-2 border-b-2 px-5 py-3 text-[14px] font-bold transition-colors ${
                        activeTab === "containers"
                            ? "border-teal-950 text-teal-950"
                            : "border-transparent text-muted hover:text-teal-950"
                    }`}
                >
                    <Truck className="size-4" /> Container &amp; Cargo Manifests
                </button>
                <button
                    onClick={() => setActiveTab("agents")}
                    className={`flex items-center gap-2 border-b-2 px-5 py-3 text-[14px] font-bold transition-colors ${
                        activeTab === "agents"
                            ? "border-teal-950 text-teal-950"
                            : "border-transparent text-muted hover:text-teal-950"
                    }`}
                >
                    <Building2 className="size-4" /> Country Agents &amp; Depots
                </button>
                <button
                    onClick={() => setActiveTab("pricing")}
                    className={`flex items-center gap-2 border-b-2 px-5 py-3 text-[14px] font-bold transition-colors ${
                        activeTab === "pricing"
                            ? "border-teal-950 text-teal-950"
                            : "border-transparent text-muted hover:text-teal-950"
                    }`}
                >
                    <Globe className="size-4" /> Freightcom &amp; Door2Door Rates
                </button>
            </div>

            {/* TAB 1: CONTAINERS & CARGO */}
            {activeTab === "containers" && (
                <div className="space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative max-w-sm flex-1">
                            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                            <input
                                type="text"
                                placeholder="Search container # or origin..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="h-10 w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 text-[13px] font-medium outline-none focus:border-teal-950"
                            />
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xs">
                        <table className="w-full text-left text-[13px]">
                            <thead className="border-b border-black/10 bg-neutral-50 font-bold text-teal-950">
                                <tr>
                                    <th className="px-6 py-4">Container ID</th>
                                    <th className="px-6 py-4">Origin &amp; Route</th>
                                    <th className="px-6 py-4">Cargo Load</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Est. Arrival</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 font-medium text-teal-950">
                                {filteredContainers.map(c => (
                                    <tr key={c.id} className="hover:bg-neutral-50/50">
                                        <td className="px-6 py-4 font-bold">
                                            {c.containerNumber}
                                            <span className="block text-[11px] font-normal text-muted">{c.carrier}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold">{c.origin}</div>
                                            <div className="text-[12px] text-muted">&rarr; {c.destination}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.casesCount} Cases ({c.weightKg.toLocaleString()} kg)
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.status === "IN_TRANSIT" && (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-[11px] font-bold text-blue-700">
                                                    <Clock className="size-3" /> In Transit
                                                </span>
                                            )}
                                            {c.status === "CUSTOMS_HOLD" && (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-700">
                                                    <AlertCircle className="size-3" /> Customs Inspection
                                                </span>
                                            )}
                                            {c.status === "RECEIVED" && (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-700">
                                                    <CheckCircle2 className="size-3" /> Received into Warehouse
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-semibold">{c.eta}</td>
                                        <td className="px-6 py-4 text-right">
                                            {c.status !== "RECEIVED" ? (
                                                <button
                                                    onClick={() => handleReceiveContainer(c.id)}
                                                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-teal-950 px-3 text-[12px] font-bold text-white hover:bg-teal-900"
                                                >
                                                    Receive Cargo
                                                </button>
                                            ) : (
                                                <span className="text-[12px] font-bold text-muted">Unloaded</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: COUNTRY AGENTS */}
            {activeTab === "agents" && (
                <div className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {agents.map(agent => (
                            <div key={agent.id} className="rounded-2xl border border-black/10 bg-white p-6 shadow-xs space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-extrabold text-[16px] text-teal-950">{agent.name}</h3>
                                        <p className="text-[12px] text-muted">{agent.region}</p>
                                    </div>
                                    {agent.status === "APPROVED" ? (
                                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                                            Approved
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                                            Pending Verification
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1.5 text-[13px] font-medium text-teal-950">
                                    <p className="flex items-center gap-2">
                                        <FileText className="size-4 text-muted" /> {agent.email}
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <Globe className="size-4 text-muted" /> {agent.phone}
                                    </p>
                                </div>

                                <hr className="border-black/5" />

                                <div className="flex items-center justify-between text-[13px]">
                                    <div>
                                        <span className="block text-[11px] text-muted uppercase font-semibold">Orders Processed</span>
                                        <span className="font-bold text-teal-950">{agent.totalOrdersHandled} Orders</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[11px] text-muted uppercase font-semibold">Unsettled Payout</span>
                                        <span className="font-extrabold text-teal-950">${agent.pendingRemittanceCad.toFixed(2)} CAD</span>
                                    </div>
                                </div>

                                {agent.status === "PENDING" && (
                                    <button
                                        onClick={() => handleApproveAgent(agent.id)}
                                        className="w-full h-9 rounded-xl bg-lime-500 text-teal-950 font-bold text-[13px] hover:bg-lime-400"
                                    >
                                        Verify &amp; Approve Agent
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: FREIGHTCOM & DOOR2DOOR PRICING */}
            {activeTab === "pricing" && (
                <div className="space-y-6">
                    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-extrabold text-[16px] text-teal-950">Door-to-Door &amp; Freightcom Shipping Rates</h3>
                                <p className="text-[12px] text-muted">Configured freight pricing matrix for cross-border and regional deliveries.</p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-black/10">
                            <table className="w-full text-left text-[13px]">
                                <thead className="border-b border-black/10 bg-neutral-50 font-bold text-teal-950">
                                    <tr>
                                        <th className="px-5 py-3">Shipping Zone</th>
                                        <th className="px-5 py-3">Origin &rarr; Destination</th>
                                        <th className="px-5 py-3">Base Parcel Cost</th>
                                        <th className="px-5 py-3">Per KG Rate</th>
                                        <th className="px-5 py-3">Door-to-Door</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5 font-medium text-teal-950">
                                    {rates.map(r => (
                                        <tr key={r.id} className="hover:bg-neutral-50/50">
                                            <td className="px-5 py-3.5 font-bold">{r.zoneName}</td>
                                            <td className="px-5 py-3.5">{r.originCountry} &rarr; {r.destCountry}</td>
                                            <td className="px-5 py-3.5 font-bold">${r.basePriceCad.toFixed(2)} CAD</td>
                                            <td className="px-5 py-3.5">${r.perKgRateCad.toFixed(2)} / kg</td>
                                            <td className="px-5 py-3.5">
                                                {r.doorToDoorSupported ? (
                                                    <span className="font-bold text-emerald-700">&check; Enabled</span>
                                                ) : (
                                                    <span className="text-muted">Port Direct</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 1: NEW CONTAINER */}
            {showNewContainerModal && (
                <AdminModal
                    open={showNewContainerModal}
                    title="New Container Manifest"
                    onClose={() => setShowNewContainerModal(false)}
                >
                    <form onSubmit={handleAddContainer} className="space-y-4">
                        <div>
                            <h2 className="text-[18px] font-bold text-teal-950">New Container Manifest</h2>
                            <p className="text-[13px] text-muted">Register an inbound sea or air cargo container for inventory tracking.</p>
                        </div>
                        <div>
                            <label className={adminFieldLabelClass}>Container Number</label>
                            <input
                                type="text"
                                required
                                value={containerDraft.containerNumber}
                                onChange={e => setContainerDraft({ ...containerDraft, containerNumber: e.target.value })}
                                placeholder="e.g. AMN-U-984210-5"
                                className={adminFieldClass}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={adminFieldLabelClass}>Origin Port / Depot</label>
                                <input
                                    type="text"
                                    required
                                    value={containerDraft.origin}
                                    onChange={e => setContainerDraft({ ...containerDraft, origin: e.target.value })}
                                    placeholder="e.g. Ashdod Port"
                                    className={adminFieldClass}
                                />
                            </div>
                            <div>
                                <label className={adminFieldLabelClass}>Destination Hub</label>
                                <input
                                    type="text"
                                    required
                                    value={containerDraft.destination}
                                    onChange={e => setContainerDraft({ ...containerDraft, destination: e.target.value })}
                                    placeholder="e.g. Ottawa Warehouse"
                                    className={adminFieldClass}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={adminFieldLabelClass}>Total Cases</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={containerDraft.casesCount}
                                    onChange={e => setContainerDraft({ ...containerDraft, casesCount: Number(e.target.value) })}
                                    className={adminFieldClass}
                                />
                            </div>
                            <div>
                                <label className={adminFieldLabelClass}>Weight (KG)</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={containerDraft.weightKg}
                                    onChange={e => setContainerDraft({ ...containerDraft, weightKg: Number(e.target.value) })}
                                    className={adminFieldClass}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={adminFieldLabelClass}>ETA</label>
                                <input
                                    type="date"
                                    required
                                    value={containerDraft.eta}
                                    onChange={e => setContainerDraft({ ...containerDraft, eta: e.target.value })}
                                    className={adminFieldClass}
                                />
                            </div>
                            <div>
                                <label className={adminFieldLabelClass}>Carrier</label>
                                <input
                                    type="text"
                                    required
                                    value={containerDraft.carrier}
                                    onChange={e => setContainerDraft({ ...containerDraft, carrier: e.target.value })}
                                    className={adminFieldClass}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowNewContainerModal(false)}
                                className="h-10 px-4 rounded-xl border border-black/10 text-teal-950 font-bold text-[13px]"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="h-10 px-5 rounded-xl bg-lime-500 text-teal-950 font-bold text-[13px] hover:bg-lime-400"
                            >
                                Create Container
                            </button>
                        </div>
                    </form>
                </AdminModal>
            )}

            {/* MODAL 2: NEW LOGISTICS AGENT */}
            {showNewAgentModal && (
                <AdminModal
                    open={showNewAgentModal}
                    title="Add Logistics Agent"
                    onClose={() => setShowNewAgentModal(false)}
                >
                    <form onSubmit={handleAddAgent} className="space-y-4">
                        <div>
                            <h2 className="text-[18px] font-bold text-teal-950">Add Logistics Agent</h2>
                            <p className="text-[13px] text-muted">Register a country logistics operations partner or regional agent.</p>
                        </div>
                        <div>
                            <label className={adminFieldLabelClass}>Agent / Partner Name</label>
                            <input
                                type="text"
                                required
                                value={agentDraft.name}
                                onChange={e => setAgentDraft({ ...agentDraft, name: e.target.value })}
                                placeholder="e.g. Amanat Jordan Freight"
                                className={adminFieldClass}
                            />
                        </div>
                        <div>
                            <label className={adminFieldLabelClass}>Operational Region</label>
                            <input
                                type="text"
                                required
                                value={agentDraft.region}
                                onChange={e => setAgentDraft({ ...agentDraft, region: e.target.value })}
                                placeholder="e.g. Amman / Aqaba Port Hub"
                                className={adminFieldClass}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={adminFieldLabelClass}>Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={agentDraft.email}
                                    onChange={e => setAgentDraft({ ...agentDraft, email: e.target.value })}
                                    placeholder="agent@domain.com"
                                    className={adminFieldClass}
                                />
                            </div>
                            <div>
                                <label className={adminFieldLabelClass}>Phone Number</label>
                                <input
                                    type="text"
                                    required
                                    value={agentDraft.phone}
                                    onChange={e => setAgentDraft({ ...agentDraft, phone: e.target.value })}
                                    placeholder="+962 6 000 0000"
                                    className={adminFieldClass}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowNewAgentModal(false)}
                                className="h-10 px-4 rounded-xl border border-black/10 text-teal-950 font-bold text-[13px]"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="h-10 px-5 rounded-xl bg-lime-500 text-teal-950 font-bold text-[13px] hover:bg-lime-400"
                            >
                                Save Agent
                            </button>
                        </div>
                    </form>
                </AdminModal>
            )}

            {/* MODAL 3: NEW FREIGHT RATE */}
            {showNewRateModal && (
                <AdminModal
                    open={showNewRateModal}
                    title="Add Freight Zone Rate"
                    onClose={() => setShowNewRateModal(false)}
                >
                    <form onSubmit={handleAddRate} className="space-y-4">
                        <div>
                            <h2 className="text-[18px] font-bold text-teal-950">Add Freight Zone Rate</h2>
                            <p className="text-[13px] text-muted">Configure door-to-door or commercial freight rates per KG.</p>
                        </div>
                        <div>
                            <label className={adminFieldLabelClass}>Zone Name</label>
                            <input
                                type="text"
                                required
                                value={rateDraft.zoneName}
                                onChange={e => setRateDraft({ ...rateDraft, zoneName: e.target.value })}
                                placeholder="e.g. Canada Door-to-Door Priority"
                                className={adminFieldClass}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={adminFieldLabelClass}>Origin Country</label>
                                <input
                                    type="text"
                                    required
                                    value={rateDraft.originCountry}
                                    onChange={e => setRateDraft({ ...rateDraft, originCountry: e.target.value })}
                                    className={adminFieldClass}
                                />
                            </div>
                            <div>
                                <label className={adminFieldLabelClass}>Destination Country</label>
                                <input
                                    type="text"
                                    required
                                    value={rateDraft.destCountry}
                                    onChange={e => setRateDraft({ ...rateDraft, destCountry: e.target.value })}
                                    className={adminFieldClass}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={adminFieldLabelClass}>Base Price (CAD)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={rateDraft.basePriceCad}
                                    onChange={e => setRateDraft({ ...rateDraft, basePriceCad: Number(e.target.value) })}
                                    className={adminFieldClass}
                                />
                            </div>
                            <div>
                                <label className={adminFieldLabelClass}>Per KG Rate (CAD)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={rateDraft.perKgRateCad}
                                    onChange={e => setRateDraft({ ...rateDraft, perKgRateCad: Number(e.target.value) })}
                                    className={adminFieldClass}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="doorToDoor"
                                checked={rateDraft.doorToDoorSupported}
                                onChange={e => setRateDraft({ ...rateDraft, doorToDoorSupported: e.target.checked })}
                                className="size-4 rounded border-black/20 accent-lime-500"
                            />
                            <label htmlFor="doorToDoor" className="text-[13px] font-bold text-teal-950">
                                Enable Door-to-Door Delivery Service
                            </label>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowNewRateModal(false)}
                                className="h-10 px-4 rounded-xl border border-black/10 text-teal-950 font-bold text-[13px]"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="h-10 px-5 rounded-xl bg-lime-500 text-teal-950 font-bold text-[13px] hover:bg-lime-400"
                            >
                                Save Freight Rate
                            </button>
                        </div>
                    </form>
                </AdminModal>
            )}
        </div>
    );
}
