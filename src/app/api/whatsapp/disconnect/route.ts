import { NextResponse } from 'next/server';

export async function DELETE() {
    try {
        const evoUrl = process.env.EVOLUTION_API_URL;
        const evoKey = process.env.EVOLUTION_API_KEY;
        const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

        if (!evoUrl || !evoKey || !instanceName) {
            return NextResponse.json({ error: "Missing Evolution API env vars" }, { status: 500 });
        }

        const res = await fetch(`${evoUrl}/instance/logout/${instanceName}`, {
            method: 'DELETE',
            headers: {
                'apikey': evoKey
            }
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(`Failed to logout: ${data.message || res.statusText}`);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
