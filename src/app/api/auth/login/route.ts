import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ success: false, error: 'Usuário e senha são obrigatórios.' }, { status: 400 });
        }

        // Consultar tabela manual de admins no Supabase
        const { data, error } = await supabaseAdmin
            .from('admins')
            .select('id, username')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            return NextResponse.json({ success: false, error: 'Credenciais inválidas.' }, { status: 401 });
        }

        // Login bem sucedido. Criar Cookie.
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
