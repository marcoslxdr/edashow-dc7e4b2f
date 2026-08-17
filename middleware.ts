import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicKey } from '@/lib/supabase/env-keys'

// Cookie name for remember-me preference
const REMEMBER_ME_COOKIE = 'cms_remember_me'

async function getUserRole(supabase: ReturnType<typeof createServerClient>, userId: string) {
    const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single()

    return roleData?.role
}

function isAllowedCmsRole(role: string | undefined): role is 'admin' | 'editor' {
    return role === 'admin' || role === 'editor'
}

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

                    const rememberMe = request.cookies.get(REMEMBER_ME_COOKIE)?.value === 'true'

                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, {
                            ...options,
                            ...(rememberMe ? {} : { maxAge: undefined }),
                        })
                    )
                },
            },
        }
    )

    const isLoginRoute = request.nextUrl.pathname === '/cms/login'

    let user: { id: string } | null = null

    try {
        const { data } = await supabase.auth.getUser()
        user = data.user
    } catch (error) {
        console.error('[middleware] Supabase auth check failed:', error)

        if (!isLoginRoute) {
            const url = request.nextUrl.clone()
            url.pathname = '/cms/login'
            return NextResponse.redirect(url)
        }

        return supabaseResponse
    }

    if (!isLoginRoute) {
        if (!user) {
            const url = request.nextUrl.clone()
            url.pathname = '/cms/login'
            return NextResponse.redirect(url)
        }

        const role = await getUserRole(supabase, user.id)

        if (!isAllowedCmsRole(role)) {
            const url = request.nextUrl.clone()
            url.pathname = '/cms/login'
            return NextResponse.redirect(url)
        }
    } else if (user) {
        const role = await getUserRole(supabase, user.id)

        if (isAllowedCmsRole(role)) {
            const url = request.nextUrl.clone()
            url.pathname = '/cms/dashboard'
            return NextResponse.redirect(url)
        }
    }

    return supabaseResponse
}

export const config = {
    // Auth only on CMS/legacy admin routes — public pages must not call Supabase in Edge middleware
    matcher: ['/cms/:path*', '/admin/:path*'],
}
