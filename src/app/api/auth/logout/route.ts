import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true, message: 'Logout realizado com sucesso.' });
    
    // Remove o cookie para deslogar
    response.cookies.delete('auth_token');
    
    return response;
}
