import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
    const isCmsRoute = req.nextUrl.pathname.startsWith('/cms')
    const isLoginRoute = req.nextUrl.pathname === '/cms/login'
    const session = req.auth

    if (isCmsRoute && !isLoginRoute && !session) {
        return NextResponse.redirect(new URL('/cms/login', req.url))
    }

    if (isLoginRoute && session) {
        return NextResponse.redirect(new URL('/cms/dashboard', req.url))
    }
})

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/auth).*)',
    ],
}
