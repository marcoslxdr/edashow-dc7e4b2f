"use client";

import { Card, CardContent } from "@/components/ui/card"
import { Calendar, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getEvents } from "@/lib/supabase/api"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { motion } from "framer-motion"
import { container, fadeIn } from "@/lib/motion"
import { useEffect, useState } from "react"

// Imagens de exemplo para eventos
const eventExampleImages = [
  "/conference-healthcare-panel.jpg",
  "/workshop-business-meeting.jpg",
  "/healthcare-launch-event.jpg",
  "/award-ceremony-healthcare.jpg",
  "/corporate-event-celebration.png",
  "/healthcare-award-ceremony.jpg",
  "/odont-award-ceremony.jpg",
]

function parseEventDate(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatEventSchedule(event: {
  event_date?: string | null
  date?: string | null
  end_date?: string | null
  endDate?: string | null
}): string {
  const start = parseEventDate(event.event_date ?? event.date)
  if (!start) return "Data a confirmar"

  let label = format(start, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const end = parseEventDate(event.end_date ?? event.endDate)
  if (end) {
    label += ` - ${format(end, "dd/MM/yyyy", { locale: ptBR })}`
  }
  return label
}

// Função para garantir que eventos sempre tenham uma imagem de exemplo
function ensureEventImage(event: any, index: number): any {
  if (!event.cover_image_url && !event.image_url) {
    const imageIndex = index % eventExampleImages.length
    return {
      ...event,
      image_url: eventExampleImages[imageIndex]
    }
  }
  return {
    ...event,
    image_url: event.cover_image_url || event.image_url
  }
}

interface EventsProps {
  initialEvents?: any[]
}

export function Events({ initialEvents = [] }: EventsProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (initialEvents.length > 0) {
      setEvents(initialEvents.map((event: any, index: number) => ensureEventImage(event, index)));
      setIsLoading(false);
    } else {
      const fetchData = async () => {
        try {
          let data = await getEvents({
            limit: 3,
            status: 'upcoming'
          });

          if (!data || data.length === 0) {
            data = [];
          } else {
            data = data.map((event: any, index: number) => ensureEventImage(event, index));
          }

          setEvents(data);
        } catch (e) {
          console.error("Error fetching events:", e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [initialEvents]);

  // Não renderiza nada se não houver eventos após o carregamento
  if (!isLoading && events.length === 0) {
    return null;
  }

  return (
    <section className="w-full bg-gradient-to-r from-orange-500 to-amber-500 py-12 md:py-16">
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-50px" }}
        className="container mx-auto px-4"
      >
        <motion.h2 variants={fadeIn("up")} className="text-2xl md:text-3xl font-bold text-center mb-8 md:mb-12 text-white">
          Próximos eventos
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
          {events.map((event: any, index: number) => {
            const eventDate = parseEventDate(event.event_date ?? event.date)
            const day = eventDate ? format(eventDate, "dd") : "??"
            const month = eventDate
              ? format(eventDate, "MMM", { locale: ptBR }).toUpperCase()
              : "???"

            const eventWithImage = ensureEventImage(event, index)
            const imageUrl = eventWithImage.image_url

            return (
              <motion.div
                key={event.id}
                variants={fadeIn("up", index * 0.1 + 0.2)}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Link href={`/events/${event.slug}`} className="block h-full">
                  <Card className="overflow-hidden bg-white hover:shadow-2xl transition-all h-full flex flex-col border-0 shadow-lg group/card pt-0">
                    {/* Borda infinita apenas ao redor da imagem */}
                    <div className="relative p-[3px] rounded-t-xl overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-conic animate-[spin_3s_linear_infinite] opacity-80"></div>
                      <div className="relative w-full h-48 md:h-52 overflow-hidden rounded-t-xl bg-white">
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          transition={{ duration: 0.6 }}
                          className="w-full h-full relative"
                        >
                          <Image
                            src={imageUrl}
                            alt={event.title}
                            fill
                            className="object-cover"
                          />
                        </motion.div>
                      </div>
                      <div className="absolute top-3 left-3 bg-white text-center p-1.5 px-2.5 rounded-lg shadow-md border-l-4 border-orange-500 z-10">
                        <div className="text-xl font-bold text-gray-900 leading-none mb-1">{day}</div>
                        <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider leading-none">{month}</div>
                      </div>
                    </div>
                    <CardContent className="p-4 md:p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-base md:text-lg mb-2 line-clamp-2 group-hover/card:text-orange-600 transition-colors text-gray-900">{event.title}</h3>

                      {event.description && (
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-1 leading-relaxed">
                          {typeof event.description === 'string'
                            ? event.description
                            : 'Confira os detalhes do evento'}
                        </p>
                      )}

                      <div className="space-y-2 text-xs text-gray-500 mt-auto pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-full bg-orange-50 text-orange-500">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-medium text-sm">
                            {formatEventSchedule(event)}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-full bg-orange-50 text-orange-500">
                              <MapPin className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-medium text-sm truncate">{event.location}</span>
                          </div>
                        )}
                      </div>

                      <Button
                        className="w-full mt-5 h-10 md:h-auto text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 shadow-sm transition-all duration-300 uppercase tracking-wide min-h-[44px]"
                        onClick={(e) => {
                          if (event.registration_url) {
                            e.preventDefault()
                            window.open(event.registration_url, '_blank')
                          }
                        }}
                      >
                        {event.registration_url ? 'Inscrever-se' : 'Ver Detalhes'}
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </section>
  )
}
