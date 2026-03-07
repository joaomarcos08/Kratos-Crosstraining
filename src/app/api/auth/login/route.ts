import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Basic in-memory rate limiting for brute force protection
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 5 * 60 * 1000; // 5 minutos

export async function POST(request: Request) {
    try {
        // 1. IP Tracking para Rate Limit
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        const now = Date.now();
        const userRateLimit = rateLimitMap.get(ip);

        // Limpa IPs expirados do mapa para evitar vazamento de memória
        if (userRateLimit && now > userRateLimit.resetTime) {
            rateLimitMap.delete(ip);
        }
        
        if (userRateLimit && now < userRateLimit.resetTime) {
            if (userRateLimit.count >= MAX_ATTEMPTS) {
                return NextResponse.json(
                    { success: false, error: 'Muitas tentativas de login. Tente novamente em 5 minutos.' }, 
                    { status: 429 }
                );
            }
        }

        // 2. Artificial Delay (1 segundo) contra Timing Attacks e Bots de Força Bruta
        await new Promise(resolve => setTimeout(resolve, 1000));

        const body = await request.json();
        let { username, password } = body;

        // 3. Input Sanitization e DOS Protection (Limite de Caracteres rigoroso)
        if (!username || !password) {
            return NextResponse.json({ success: false, error: 'Usuário e senha são obrigatórios.' }, { status: 400 });
        }
        
        username = String(username).trim();
        password = String(password).trim();
        
        if (username.length > 50 || password.length > 50) {
            return NextResponse.json({ success: false, error: 'Credenciais com tamanho inválido.' }, { status: 400 });
        }

        // Consultar tabela manual de admins no Supabase
        const { data, error } = await supabaseAdmin
            .from('admins')
            .select('id, username')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            // Falha: Incrementa o contador de rate limit
            const currentCount = userRateLimit && now < userRateLimit.resetTime ? userRateLimit.count : 0;
            rateLimitMap.set(ip, { count: currentCount + 1, resetTime: now + LOCKOUT_TIME_MS });
            
            return NextResponse.json({ success: false, error: 'Credenciais inválidas.' }, { status: 401 });
        }

        // Login bem sucedido. Reseta o rate limit pro IP.
        rateLimitMap.delete(ip);

        // Criar Cookie de sessão segura.
        const response = NextResponse.json({ success: true, message: 'Login realizado com sucesso.' });
        
        // Seta um cookie chamado 'auth_token'. 
        // HTTP-Only = Não acessível por JavaScript (mais seguro contra XSS)
        // Secure = Só trafega em HTTPS (importante na Vercel)
        response.cookies.set({
            name: 'auth_token',
            value: data.id, 
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/', // Válido pro site todo
            maxAge: 60 * 60 * 24 * 7 // Expira em 7 dias
        });

        return response;

    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
