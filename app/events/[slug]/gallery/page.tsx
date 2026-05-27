import { redirect } from 'next/navigation'

interface GalleryPageProps {
    params: {
        slug: string
    }
}

export default function EventGalleryRedirectPage({ params }: GalleryPageProps) {
    redirect(`/events/${params.slug}#galeria`)
}
