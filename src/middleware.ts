import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Obter o cookie de autenticação
  const authToken = request.cookies.get('auth_token')?.value

  // Caminhos que não requerem autenticação
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')

  // Se for uma rota de API (por exemplo, a de cobrança via Vercel Cron), passa direto
  // A segurança da API de cobrança já é feita pelo CRON_SECRET no próprio arquivo
  if (isApiRoute) {
    return NextResponse.next()
  }

  // Se o usuário não estiver logado e tentar acessar uma página protegida (como a raiz '/')
  if (!authToken && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Se o usuário já estiver logado e tentar acessar a página de login, manda de volta pro painel
  if (authToken && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

// Configurar em quais caminhos este middleware deve rodar
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
