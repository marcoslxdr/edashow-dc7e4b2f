import { getEvents, getEventBySlug, getPostsByEventSlug } from '@/lib/supabase/api'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { MapPin, ArrowLeft, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EventDateCard } from '@/components/event-date-card'
import { EventOrganizers } from '@/components/event-organizers'
import { EventSponsors } from '@/components/event-sponsors'
import { EventSpeakers } from '@/components/event-speakers'
import { getGalleryByEventSlug } from '@/lib/actions/cms-event-photos'
import { getEventVideosBySlug } from '@/lib/actions/cms-event-videos'
import { EventVideoEmbeds } from '@/components/events/EventVideoEmbeds'
import { EventInlineGallery } from '@/components/events/EventInlineGallery'
import { EventCoveragePosts } from '@/components/events/EventCoveragePosts'

// Força renderização dinâmica para evitar erros de serialização durante build
export const dynamic = 'force-dynamic'
export const dynamicParams = true

interface EventPageProps {
  params: {
    slug: string
  }
}

// Gerar páginas estáticas para eventos existentes
export async function generateStaticParams() {
  const events = await getEvents({ limit: 100, status: 'upcoming' })

  return events.map((event: any) => ({
    slug: event.slug,
  }))
}

// Metadados da página
export async function generateMetadata({ params }: EventPageProps) {
  const event = await getEventBySlug(params.slug)

  if (!event) {
    return {
      title: 'Evento não encontrado',
    }
  }

  return {
    title: `${event.title} | EdaShow`,
    description: typeof event.description === 'string'
      ? event.description
      : 'Confira os detalhes do evento',
    openGraph: {
      title: event.title,
      description: typeof event.description === 'string' ? event.description : '',
      images: event.image_url ? [event.image_url] : [],
    },
  }
}

export default async function EventPage({ params }: EventPageProps) {
  const event = await getEventBySlug(params.slug)

  if (!event) {
    notFound()
  }

  const [gallery, eventVideos, coveragePosts] = await Promise.all([
    getGalleryByEventSlug(params.slug),
    getEventVideosBySlug(params.slug),
    getPostsByEventSlug(params.slug),
  ])

  const galleryPhotos = gallery?.photos ?? []

  const startDate = new Date(event.event_date || event.date)
  const endDate = event.end_date ? new Date(event.end_date) : null

  // Status badge
  const getStatusBadge = (status: string) => {
    const badges = {
      upcoming: { label: 'Próximo', color: 'bg-orange-100 text-orange-800' },
      ongoing: { label: 'Em Andamento', color: 'bg-green-100 text-green-800' },
      finished: { label: 'Finalizado', color: 'bg-gray-100 text-gray-800' },
      cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
    }
    return badges[status as keyof typeof badges] || badges.upcoming
  }

  const statusBadge = getStatusBadge(event.status)

  // Tipo de evento
  const getEventType = (type: string) => {
    const types = {
      'in-person': 'Presencial',
      'online': 'Online',
      'hybrid': 'Híbrido',
    }
    return types[type as keyof typeof types] || type
  }

  const imageUrl = event.cover_image_url || event.image_url || '/conference-healthcare-panel.jpg'

  return (
    <div className="min-h-screen bg-background">
      {/* Botão Voltar */}
      <div className="container mx-auto px-4 py-6">
        <Link href="/events">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Eventos
          </Button>
        </Link>
      </div>

      {/* Hero Section com Imagem */}
      <div className="relative w-full h-[60vh] min-h-[400px] mb-8">
        <Image
          src={imageUrl}
          alt={event.title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 container mx-auto px-4 pb-8">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 mb-4">
              <Badge className={`${statusBadge.color} border-0 shadow-md`}>
                {statusBadge.label}
              </Badge>
              {event.event_type && (
                <Badge variant="secondary" className="bg-orange-500/90 text-white border-orange-400/50 shadow-md">
                  {getEventType(event.event_type)}
                </Badge>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
              {event.title}
            </h1>
          </div>
        </div>
      </div>

      <article className="container mx-auto px-4 pb-12 max-w-6xl">
        {/* Card de Data Destacado */}
        <div className="mb-8">
          <EventDateCard
            startDate={event.event_date || event.date}
            endDate={event.end_date}
          />
        </div>

        {/* Localização Destacada */}
        {event.location && (
          <div className="mb-8 p-6 bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 rounded-lg border-2 border-orange-300 shadow-md">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg shadow-md">
                <MapPin className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-orange-900 mb-2">Local do Evento</h3>
                <p className="text-orange-800 text-lg font-medium">{event.location}</p>
              </div>
            </div>
          </div>
        )}

        {/* Botão de Inscrição Principal */}
        {event.registration_url && (
          <div className="mb-12 text-center p-8 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-xl shadow-xl border-2 border-orange-600">
            <h2 className="text-3xl font-bold text-white mb-3">Não perca esta oportunidade!</h2>
            <p className="text-white/95 mb-6 text-lg font-medium">
              Garanta sua vaga e participe deste evento incrível
            </p>
            <a
              href={event.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50 hover:text-orange-700 font-bold text-lg px-8 py-6 gap-2 shadow-lg border-2 border-white/20">
                Inscrever-se Agora
                <ExternalLink className="h-5 w-5" />
              </Button>
            </a>
          </div>
        )}

        <EventVideoEmbeds videos={eventVideos} className="mb-12" />

        {galleryPhotos.length > 0 && (
          <EventInlineGallery
            photos={galleryPhotos}
            driveDownloadUrl={gallery?.drive_download_url}
          />
        )}

        {coveragePosts.length > 0 && (
          <section id="cobertura" className="mb-12 scroll-mt-24">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Cobertura</h2>
            <EventCoveragePosts posts={coveragePosts} />
          </section>
        )}

        {/* Descrição do Evento */}
        {event.description && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Sobre o Evento</h2>
            <div className="prose prose-lg max-w-none">
              {typeof event.description === 'string' ? (
                <p className="text-gray-700 leading-relaxed text-lg">{event.description}</p>
              ) : (
                <div
                  className="text-gray-700 leading-relaxed text-lg"
                  dangerouslySetInnerHTML={{ __html: event.description }}
                />
              )}
            </div>
          </section>
        )}

        {/* Organizadores */}
        <EventOrganizers
          organizers={event.organizers}
          className="mb-12"
        />

        {/* Empresas Patrocinadoras */}
        <EventSponsors
          sponsors={event.sponsors}
          className="mb-12"
        />

        {/* Palestrantes */}
        <EventSpeakers
          speakers={event.speakers}
          className="mb-12"
        />

        {/* CTA Final */}
        {event.registration_url && (
          <div className="mt-12 pt-12 border-t-2 border-orange-200 text-center bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-8">
            <h3 className="text-2xl font-bold mb-4 text-orange-900">Pronto para participar?</h3>
            <p className="text-orange-800 mb-6 text-lg font-medium">
              Faça sua inscrição agora e garante sua vaga neste evento exclusivo.
            </p>
            <a
              href={event.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button size="lg" className="bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 font-bold text-lg px-8 py-6 gap-2 shadow-lg border-2 border-orange-600">
                Inscrever-se no Evento
                <ExternalLink className="h-5 w-5" />
              </Button>
            </a>
          </div>
        )}
      </article>
    </div>
  )
}



