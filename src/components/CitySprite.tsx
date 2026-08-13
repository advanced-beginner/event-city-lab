import buildingCoffeeShop from '../assets/city/sprites/building-coffee-shop.png'
import buildingCornerStore from '../assets/city/sprites/building-corner-store.png'
import buildingMidriseApartment from '../assets/city/sprites/building-midrise-apartment.png'
import buildingModernOffice from '../assets/city/sprites/building-modern-office.png'
import buildingSmallApartment from '../assets/city/sprites/building-small-apartment.png'
import buildingTownhouse from '../assets/city/sprites/building-townhouse.png'
import parkGarden from '../assets/city/sprites/park-garden.png'
import propStreetLamp from '../assets/city/sprites/prop-street-lamp.png'
import roadCorner from '../assets/city/sprites/road-corner.png'
import roadIntersection from '../assets/city/sprites/road-intersection.png'
import roadStraight from '../assets/city/sprites/road-straight.png'
import roadTJunction from '../assets/city/sprites/road-t-junction.png'
import treeConical from '../assets/city/sprites/tree-conical.png'
import treeOval from '../assets/city/sprites/tree-oval.png'
import treeRound from '../assets/city/sprites/tree-round.png'
import vehicleCoralCar from '../assets/city/sprites/vehicle-coral-car.png'
import vehicleTealCar from '../assets/city/sprites/vehicle-teal-car.png'

const citySprites = {
  'building-coffee-shop': { href: buildingCoffeeShop, width: 229, height: 255 },
  'building-corner-store': { href: buildingCornerStore, width: 218, height: 274 },
  'building-midrise-apartment': { href: buildingMidriseApartment, width: 220, height: 305 },
  'building-modern-office': { href: buildingModernOffice, width: 218, height: 302 },
  'building-small-apartment': { href: buildingSmallApartment, width: 196, height: 271 },
  'building-townhouse': { href: buildingTownhouse, width: 187, height: 253 },
  'park-garden': { href: parkGarden, width: 234, height: 215 },
  'prop-street-lamp': { href: propStreetLamp, width: 67, height: 175 },
  'road-corner': { href: roadCorner, width: 250, height: 178 },
  'road-intersection': { href: roadIntersection, width: 320, height: 194 },
  'road-straight': { href: roadStraight, width: 255, height: 158 },
  'road-t-junction': { href: roadTJunction, width: 239, height: 181 },
  'tree-conical': { href: treeConical, width: 95, height: 178 },
  'tree-oval': { href: treeOval, width: 110, height: 169 },
  'tree-round': { href: treeRound, width: 109, height: 178 },
  'vehicle-coral-car': { href: vehicleCoralCar, width: 165, height: 135 },
  'vehicle-teal-car': { href: vehicleTealCar, width: 166, height: 136 },
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
