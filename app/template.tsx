"use client"

import { motion } from "framer-motion"
import { usePathname } from "next/navigation"

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Não aplicar animações em rotas do admin do Payload CMS
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/preview')) {
    return <>{children}</>
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ ease: "easeInOut", duration: 0.5 }}
    >
      {children}
    </motion.div>
  )
}














