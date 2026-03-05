import { NextResponse } from 'next/server'

// This route is no longer used - auth is handled by NextAuth.js
// Keeping this file to avoid 404 errors from any lingering links
export async function GET(request: Request) {
    const { origin } = new URL(request.url)
    return NextResponse.redirect(`${origin}/cms/dashboard`)
}
