import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const messagesFilePath = path.join(process.cwd(), 'messages.json');

const defaultMessages = {
    day0: "Olá {nome}, lembramos que sua mensalidade de {plano} no valor de R$ {valor} vence hoje!",
    day5: "⚠️ Olá {nome}, notamos que sua mensalidade de {plano} encontra-se 5 dias em atraso. Por favor, regularize o pagamento para evitar multas ou bloqueio do acesso."
};

export async function GET() {
    try {
        if (!fs.existsSync(messagesFilePath)) {
            fs.writeFileSync(messagesFilePath, JSON.stringify(defaultMessages, null, 2));
        }

        const data = fs.readFileSync(messagesFilePath, 'utf-8');
        return NextResponse.json(JSON.parse(data));
    } catch (error: any) {
        return NextResponse.json(defaultMessages); // return defaults if file system fails
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const currentMessages = fs.existsSync(messagesFilePath)
            ? JSON.parse(fs.readFileSync(messagesFilePath, 'utf-8'))
            : defaultMessages;

        const newMessages = {
            ...currentMessages,
            day0: body.day0 || currentMessages.day0,
            day5: body.day5 || currentMessages.day5
        };

        fs.writeFileSync(messagesFilePath, JSON.stringify(newMessages, null, 2));

        return NextResponse.json({ success: true, messages: newMessages });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
