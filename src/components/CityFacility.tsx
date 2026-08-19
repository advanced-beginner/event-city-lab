import type { KeyboardEvent, ReactNode } from 'react'

interface CityFacilityProps {
  accessibleName: string
  children: ReactNode
  className?: string | undefined
  hitAreaClassName?: string | undefined
  hitAreaPath: string
  nodeId: string
  onInspect: (nodeId: string) => void
}

export function CityFacility({
  accessibleName,
  children,
  className,
  hitAreaClassName,
  hitAreaPath,
  nodeId,
  onInspect,
}: CityFacilityProps) {
  const handleKeyboard = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onInspect(nodeId)
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={accessibleName}
      data-city-node={nodeId}
      className={className}
      onClick={() => onInspect(nodeId)}
      onKeyDown={handleKeyboard}
    >
      <path className={hitAreaClassName} d={hitAreaPath} />
      {children}
    </g>
  )
}
