import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const evoUrl = process.env.EVOLUTION_API_URL
        const evoKey = process.env.EVOLUTION_API_KEY
        const instanceName = process.env.EVOLUTION_INSTANCE_NAME

        if (!evoUrl || !evoKey || !instanceName) {
            return NextResponse.json({ error: "Variáveis de ambiente Evolution API não configuradas." }, { status: 500 })
        }

        const headers = {
            'apikey': evoKey,
            'Content-Type': 'application/json'
        }

        const stateRes = await fetch(`${evoUrl}/instance/connectionState/${instanceName}`, { headers, cache: 'no-store' });
        if (stateRes.ok) {
            const stateData = await stateRes.json();
            return NextResponse.json({ state: stateData.instance?.state || 'unknown' });
        }

        return NextResponse.json({ state: 'disconnected' });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
