import { ScrambleLink } from '@/components/motion/scramble-link'

export function SiteWordmark({ className }: { readonly className?: string }) {
  return (
    <ScrambleLink
      className={className}
      href='/'
      label='Cultural Alignment home'
      prefix='Cultural '
      duration={260}
      delay={180}
    >
      Alignment
    </ScrambleLink>
  )
}
