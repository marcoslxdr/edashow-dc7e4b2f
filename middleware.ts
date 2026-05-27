import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicKey } from '@/lib/supabase/env-keys'

// Cookie name for remember-me preference
const REMEMBER_ME_COOKIE = 'cms_remember_me'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        getSupabasePublicKey(),
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })

                    // Check remember-me preference for cookie settings
                    const rememberMe = request.cookies.get(REMEMBER_ME_COOKIE)?.value === 'true'

                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, {
                            ...options,
                            // If remember-me is false, don't set maxAge (session cookie)
                            ...(rememberMe ? {} : { maxAge: undefined }),
                        })
                    )
                },
            },
        }
    )

    // Refresh session - this is important to keep sessions alive
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Check if accessing CMS routes
    const isCmsRoute = request.nextUrl.pathname.startsWith('/cms')
    const isLoginRoute = request.nextUrl.pathname === '/cms/login'

    if (isCmsRoute && !isLoginRoute) {
        if (!user) {
            // User is not logged in, redirect to login
            const url = request.nextUrl.clone()
            url.pathname = '/cms/login'
            return NextResponse.redirect(url)
        }

        // Verify user has admin/editor role
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        if (!roleData || (roleData.role !== 'admin' && roleData.role !== 'editor')) {
            const url = request.nextUrl.clone()
            url.pathname = '/cms/login'
            return NextResponse.redirect(url)
        }
    }

    // If logged in user tries to access login page, redirect to dashboard
    if (isLoginRoute && user) {
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        if (roleData && (roleData.role === 'admin' || roleData.role === 'editor')) {
            const url = request.nextUrl.clone()
            url.pathname = '/cms/dashboard'
            return NextResponse.redirect(url)
        }
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         * - api routes (these handle their own auth)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)',
    ],
}
