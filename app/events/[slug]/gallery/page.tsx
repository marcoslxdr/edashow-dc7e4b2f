import { getEventBySlug, getEvents } from '@/lib/supabase/api'
import { getGalleryByEventSlug } from '@/lib/actions/cms-event-photos'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, MessageCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { GalleryClient } from './GalleryClient'

export const dynamic = 'force-dynamic'

interface GalleryPageProps {
    params: {
        slug: string
    }
}

export async function generateStaticParams() {
    const events = await getEvents({ limit: 100 })
    return events.map((event: any) => ({ slug: event.slug }))
}

export async function generateMetadata({ params }: GalleryPageProps) {
    const event = await getEventBySlug(params.slug)
    if (!event) {
        return { title: 'Galeria não encontrada | EdaShow' }
    }
    return {
        title: `Galeria de Fotos - ${event.title} | EdaShow`,
        description: `Veja as fotos do evento ${event.title}`,
    }
}

export default async function GalleryPage({ params }: GalleryPageProps) {
    const event = await getEventBySlug(params.slug)
    
    if (!event) {
        notFound()
    }
    
    const gallery = await getGalleryByEventSlug(params.slug)
    
    if (!gallery) {
        notFound()
    }
    
    const photos = (gallery.photos || []).sort((a: any, b: any) => a.display_order - b.display_order)
    
    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-6">
                <Link href={`/events/${params.slug}`}>
                    <Button variant="ghost" className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Voltar ao Evento
                    </Button>
                </Link>
            </div>
            
            <div className="container mx-auto px-4 pb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                    {gallery.title}
                </h1>
                <p className="text-gray-600 mb-2">
                    {event.title}
                </p>
                {gallery.description && (
                    <p className="text-gray-500 max-w-2xl">
                        {gallery.description}
                    </p>
                )}
            </div>
            
            <div className="container mx-auto px-4 pb-12">
                <GalleryClient photos={photos} />
            </div>
            
            <div className="container mx-auto px-4 pb-12">
                <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-xl p-8 text-center shadow-xl">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                        Quer as fotos em alta qualidade?
                    </h2>
                    <p className="text-white/90 mb-6 max-w-xl mx-auto">
                        Entre em contato conosco para receber as imagens originais sem marca d'água.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
                        {gallery.drive_download_url && (
                            <a
                                href={gallery.drive_download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex"
                            >
                                <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50 font-bold gap-2">
                                    <Download className="h-5 w-5" />
                                    Baixar fotos no Drive
                                </Button>
                            </a>
                        )}
                        {gallery.contact_email && (
                            <a 
                                href={`mailto:${gallery.contact_email}?subject=Solicitação de Fotos - ${event.title}`}
                                className="inline-flex"
                            >
                                <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50 font-bold gap-2">
                                    <Mail className="h-5 w-5" />
                                    Enviar Email
                                </Button>
                            </a>
                        )}
                        {gallery.contact_whatsapp && (
                            <a 
                                href={`https://wa.me/${gallery.contact_whatsapp}?text=Olá! Gostaria de solicitar as fotos em alta qualidade do evento ${event.title}.`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex"
                            >
                                <Button size="lg" className="bg-green-500 text-white hover:bg-green-600 font-bold gap-2">
                                    <MessageCircle className="h-5 w-5" />
                                    WhatsApp
                                </Button>
                            </a>
                        )}
                        {!gallery.drive_download_url && !gallery.contact_email && !gallery.contact_whatsapp && (
                            <p className="text-white/80 text-sm">
                                Informações de contato em breve.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
