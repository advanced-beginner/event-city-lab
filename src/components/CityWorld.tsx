import type { ReactNode } from 'react'

interface CityWorldProps {
  backgroundUrl: string
  children: ReactNode
  className?: string | undefined
  description: string
  imageClassName?: string | undefined
  preserveAspectRatio?: 'xMidYMid meet' | 'xMidYMid slice'
  reducedMotion: boolean
  title: string
  viewBox: string
}

export function CityWorld({
  backgroundUrl,
  children,
  className,
  description,
  imageClassName,
  preserveAspectRatio = 'xMidYMid meet',
  reducedMotion,
  title,
  viewBox,
}: CityWorldProps) {
  const titleId = `city-world-title-${title.replace(/[^a-zA-Z0-9\u3131-\uD79D]+/g, '-').toLowerCase()}`
  const descriptionId = `${titleId}-description`

  return (
    <svg
      className={`${className ?? ''} ${reducedMotion ? 'city-world-reduced-motion' : ''}`.trim()}
      viewBox={viewBox}
      role="img"
      aria-labelledby={`${titleId} ${descriptionId}`}
      preserveAspectRatio="xMidYMid meet"
      data-city-world
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
    >
      <title id={titleId}>{title}</title>
      <desc id={descriptionId}>{description}</desc>
      <image
        className={imageClassName}
        href={backgroundUrl}
        width="100%"
        height="100%"
        preserveAspectRatio={preserveAspectRatio}
        aria-hidden="true"
      />
      {children}
    </svg>
  )
}
