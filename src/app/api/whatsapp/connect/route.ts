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

        // 1. Tenta pegar o status primeiro
        const stateRes = await fetch(`${evoUrl}/instance/connectionState/${instanceName}`, { headers, cache: 'no-store' });
        if (stateRes.ok) {
            const stateData = await stateRes.json();
            if (stateData.instance?.state === 'open') {
                return NextResponse.json({ status: 'open', message: 'Já conectado.' });
            }
        }

        // 2. Se não estiver "open", deletamos e recriamos para forçar a geração de um novo QRCode.
        await fetch(`${evoUrl}/instance/logout/${instanceName}`, { method: 'DELETE', headers }).catch(() => { });
        await fetch(`${evoUrl}/instance/delete/${instanceName}`, { method: 'DELETE', headers }).catch(() => { });

        const createRes = await fetch(`${evoUrl}/instance/create`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                instanceName,
                qrcode: true
            })
        });

        const createData = await createRes.json();

        if (createData?.qrcode?.base64) {
            return NextResponse.json({ base64: createData.qrcode.base64 });
        }

        return NextResponse.json({
            error: "Falha ao gerar QR Code",
            details: createData
        }, { status: 500 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
