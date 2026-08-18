import vehicleKafkaVanNortheast from '../assets/city/sprites/vehicle-kafka-van-northeast.png'

const citySprites = {
  'vehicle-kafka-van-northeast': { href: vehicleKafkaVanNortheast, width: 192, height: 171 },
} as const

export type CitySpriteId = keyof typeof citySprites

interface CitySpriteProps {
  id: CitySpriteId
  x: number
  y: number
  scale?: number
  className?: string | undefined
}

export function CitySprite({ id, x, y, scale = 1, className }: CitySpriteProps) {
  const sprite = citySprites[id]
  return (
    <image
      className={className}
      data-city-sprite={id}
      href={sprite.href}
      x={-sprite.width / 2}
      y={-sprite.height}
      width={sprite.width}
      height={sprite.height}
      transform={`translate(${x} ${y}) scale(${scale})`}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    />
  )
}
