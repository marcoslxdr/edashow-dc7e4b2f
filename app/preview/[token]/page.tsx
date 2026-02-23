import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getPostByPreviewToken } from '@/lib/actions/cms-preview'
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

    return (
        <PreviewContent
            post={result.post}
            tokenData={result.token}
            token={token}
        />
    )
}
