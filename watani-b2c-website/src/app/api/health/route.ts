import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json({
        status: "UP",
        service: "watani-b2c-website",
        timestamp: new Date().toISOString()
    }, { status: 200 });
}
