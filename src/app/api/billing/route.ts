import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const isManual = url.searchParams.get('manual') === 'true';

        const today = new Date();
        const currentDay = today.getDate();
        const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        const fiveDaysAgo = new Date(today);
        fiveDaysAgo.setDate(today.getDate() - 5);
        const day5 = fiveDaysAgo.getDate();
        const month5Str = `${fiveDaysAgo.getFullYear()}-${String(fiveDaysAgo.getMonth() + 1).padStart(2, '0')}`;

        const prevMonthDate = new Date(today);
        prevMonthDate.setMonth(today.getMonth() - 1);
        const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

        let studentsQuery = supabaseAdmin.from('students').select('*').eq('is_active', true);

        // Se não for manual (cron diário), filtra APENAS quem vence hoje ou venceu há exatos 5 dias
        if (!isManual) {
            studentsQuery = studentsQuery.in('due_day', [currentDay, day5]);
        }

        const { data: students, error: studentsError } = await studentsQuery;

        if (studentsError) throw studentsError;
        if (!students || students.length === 0) {
            return NextResponse.json({ message: 'Nenhum aluno ativo encontrado para validação.' });
        }

        // 2. Determine who hasn't paid and map to correct message
        const defaulters: any[] = [];
        const studentIds = students.map(s => s.id);

        const { data: payments, error: paymentsError } = await supabaseAdmin
            .from('payments')
            .select('student_id, reference_month')
            .in('student_id', studentIds)
            .eq('status', 'paid');

        if (paymentsError) throw paymentsError;

        const debugLogs: any[] = [];

        for (const student of students) {
            if (!isManual) {
                // Rotina Diária (CRON): Só manda para Dia 0 ou Dia 5 exatos
                const isDay0 = student.due_day === currentDay;
                const isDay5 = student.due_day === day5;

                debugLogs.push(`CRON Check student ${student.name} - due_day: ${student.due_day}`);

                if (isDay0) {
                    const hasPaidMonth0 = payments?.some(p => p.student_id === student.id && p.reference_month === currentMonthStr);
                    if (!hasPaidMonth0) {
                        defaulters.push({ ...student, delayType: 'day0' });
                        continue;
                    }
                }

                if (isDay5) {
                    const hasPaidMonth5 = payments?.some(p => p.student_id === student.id && p.reference_month === month5Str);
                    if (!hasPaidMonth5) {
                        defaulters.push({ ...student, delayType: 'day5' });
                    }
                }
            } else {
                // Rotina Manual: Verifica TODAS as inadimplências (Vence Hoje ou Atrasado) baseando-se na mesma lógica do painel

                const hasPaidCurrentMonth = payments?.some(p => p.student_id === student.id && p.reference_month === currentMonthStr);
                const hasPaidPrevMonth = payments?.some(p => p.student_id === student.id && p.reference_month === prevMonthStr);

                if (hasPaidCurrentMonth) {
                    debugLogs.push(`MANUAL Check student ${student.name} - already paid current month. Skipping.`);
                    continue; // Em dia
                }

                if (student.due_day === currentDay) {
                    // Vence Hoje
                    defaulters.push({ ...student, delayType: 'day0' });
                } else if (student.due_day < currentDay) {
                    // Já venceu neste mês e não pagou (hasPaidCurrentMonth é falso)
                    defaulters.push({ ...student, delayType: 'day5' });
                } else {
                    // O vencimento deste mês ainda não chegou (due_day > currentDay).
                    // Então a checagem de inadimplência recai sobre o mês passado.
                    if (!hasPaidPrevMonth) {
                        defaulters.push({ ...student, delayType: 'day5' });
                    } else {
                        debugLogs.push(`MANUAL Check student ${student.name} - not due this month yet, and paid last month. Skipping.`);
                    }
                }
            }
        }

        console.log("=== API DEFAULTERS MANUAL ===", defaulters.map(d => ({ name: d.name, delayType: d.delayType })));

        debugLogs.push(`Final defaulters: ${JSON.stringify(defaulters.map(d => ({ name: d.name, delayType: d.delayType })))}`);

        if (defaulters.length === 0) {
            return NextResponse.json({ message: 'Nenhum aluno inadimplente encontrado.' });
        }

        // 4. Send messages via Evolution API (WhatsApp)

        const messagesFilePath = path.join(process.cwd(), 'messages.json');
        let customMessages = {
            day0: "Olá {nome}, lembramos que sua mensalidade de {plano} no valor de R$ {valor} vence hoje!",
            day5: "⚠️ Olá {nome}, notamos que sua mensalidade de {plano} encontra-se 5 dias em atraso. Por favor, regularize o pagamento para evitar multas ou bloqueio do acesso."
        };
        try {
            if (fs.existsSync(messagesFilePath)) {
                customMessages = JSON.parse(fs.readFileSync(messagesFilePath, 'utf-8'));
            }
        } catch (e) {
            console.error("Error loading messages.json", e);
        }
        const evoUrl = process.env.EVOLUTION_API_URL;
        const evoKey = process.env.EVOLUTION_API_KEY;
        const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

        if (evoUrl && evoKey && instanceName && defaulters.length > 0) {
            // Enviar todas as mensagens em paralelo usando Promise.all
            // Evolution API processará a fila nativamente sem travar a Vercel
            await Promise.all(defaulters.map(async (s, i) => {
                let jid = s.whatsapp.replace(/\D/g, '');
                if (!jid.startsWith('55')) jid = `55${jid}`;

                let template = s.delayType === 'day5' ? customMessages.day5 : customMessages.day0;
                let messageText = template
                    .replace(/{nome}/g, s.name)
                    .replace(/{plano}/g, s.plan_type)
                    .replace(/{valor}/g, Number(s.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

                try {
                    await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': evoKey
                        },
                        body: JSON.stringify({
                            number: jid,
                            // Evolution API delay parameter space them out slightly (1.2s base + optional spacing)
                            options: { delay: 1200 + (i * 1000), presence: "composing" },
                            textMessage: {
                                text: messageText
                            }
                        })
                    });
                    console.log(`Mensagem de cobrança enviada para ${s.name} (${jid})`);
                } catch (e) {
                    console.error(`Erro ao enviar cobrança para ${s.name}:`, e);
                }
            }));
        }

        return NextResponse.json({
            success: true,
            defaultersCount: defaulters.length,
            totalSent: defaulters.length,
            message: "Cobranças iniciadas em segundo plano",
            debugLogs
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
