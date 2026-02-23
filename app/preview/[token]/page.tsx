import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getPostByPreviewToken } from '@/lib/actions/cms-preview'
import { getSponsors } from '@/lib/supabase/api'
import { PreviewContent } from './preview-content'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Preview do Rascunho',
    robots: { index: false, follow: false },
}

interface PreviewPageProps {
    params: Promise<{ token: string }>
}

export default async function PreviewPage({ params }: PreviewPageProps) {
    const { token } = await params

    const result = await getPostByPreviewToken(token)

    if (!result) {
        notFound()
    }

    const sponsors = await getSponsors({ active: true })

    return (
        <PreviewContent
            post={result.post}
            tokenData={result.token}
            token={token}
            sponsors={sponsors}
        />
    )
}
