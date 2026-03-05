import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { sql } from '@/lib/db/client'
import bcrypt from 'bcryptjs'

declare module 'next-auth' {
    interface User {
        role?: string
    }
    interface Session {
        user: {
            id: string
            email: string
            name: string
            role: string
        }
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        role?: string
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Senha', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null

                try {
                    const rows = await sql`
                        SELECT
                            p.id,
                            p.email,
                            p.name,
                            ur.role,
                            pa.password_hash
                        FROM profiles p
                        JOIN user_roles ur ON ur.user_id = p.id
                        JOIN profile_auth pa ON pa.user_id = p.id
                        WHERE p.email = ${credentials.email as string}
                        AND ur.role IN ('admin', 'editor')
                        LIMIT 1
                    `

                    if (!rows || rows.length === 0) return null

                    const user = rows[0]
                    const passwordValid = await bcrypt.compare(
                        credentials.password as string,
                        user.password_hash as string
                    )

                    if (!passwordValid) return null

                    return {
                        id: user.id as string,
                        email: user.email as string,
                        name: (user.name as string) || (user.email as string).split('@')[0],
                        role: user.role as string,
                    }
                } catch (error) {
                    console.error('Auth error:', error)
                    return null
                }
            },
        }),
    ],
    callbacks: {
        jwt({ token, user }) {
            if (user) {
                token.role = user.role
            }
            return token
        },
        session({ session, token }) {
            if (token.role) {
                session.user.role = token.role as string
            }
            return session
        },
    },
    pages: {
        signIn: '/cms/login',
    },
    session: {
        strategy: 'jwt',
    },
})
