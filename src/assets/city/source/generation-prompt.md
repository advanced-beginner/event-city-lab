# Event City visual asset record

## Current approved composition

- Updated: 2026-08-18
- Background source: user-provided `Gemini_Generated_Image_ixg878ixg878ixg8.png`
- Runtime asset: `../background/event-city-main.webp`
- Runtime size: 1600×975, center-cropped and encoded as WebP at quality 88
- Composition rule: the approved city image is the complete visual background. Runtime code must not rebuild its roads, buildings, parks, or props from separate sprites.

The three large buildings in the center are the Kafka learning facilities:

1. Center-left dark tower: Producer 출발센터
2. Center glass building with the `URBAN PLAZA` sign: Serializer 검사소
3. Center-right blue-and-cream building with the `ZENITH APTS` sign: Broker 기록센터

Their interaction targets, state lamps, labels, failure state, ACK path, and arrival-message card remain semantic SVG overlays. The moving yellow Kafka van remains a separate transparent PNG so simulation events can move it along the road.

## Retired sprite composition

The previous generated city sprite master, split building/facility/road/park/tree images, and derived road-network images were removed at the user's direction. They must not be restored or imported. Only vehicle images were preserved from that set. The exact supplied background is retained only as a local visual-audit reference under ignored `.omx/artifacts`; it is not duplicated in the tracked source-asset directory.

## Preserved vehicle rule

- Runtime vehicle: `sprites/vehicle-kafka-van-northeast.png`
- Direction: rear at lower-left, front at upper-right
- Runtime rotation: `0deg`; do not rotate the already-isometric van to compensate for direction
- Other `vehicle-*` files are preserved as source variants but are not imported unless a later chapter explicitly needs them
