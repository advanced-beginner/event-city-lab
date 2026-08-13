# Event City sprite generation record

- Generated: 2026-08-13
- Tool: OpenAI built-in image generation
- Intent: original modular sprite sheet for the Event City Lab Kafka simulator
- Output workflow: flat chroma-key generation, local alpha extraction, connected-component split, manual semantic naming

## Reference roles

- [Stable Diffusion Online — Isometric City Pixel Art Sprite Sheet](https://stablediffusionweb.com/ko/image/65841461-isometric-city-pixel-art-sprite-sheet?source_site=sdw&source_page_type=prompt_page&source_page_path=%2Fko%2Fprompts%2Fcity-pixel&source_action=view_prompt_image&source_image_slug=65841461-isometric-city-pixel-art-sprite-sheet&source_prompt_slug=city-pixel): geometry, silhouette, outline, and pixel-density direction only. The source image is not redistributed.
- User-provided Gemini image: palette, early golden-hour atmosphere, urban variety, and city liveliness only. The source image is not redistributed.

The generated assets are original compositions and do not reproduce either reference image's exact objects, signs, or arrangement.

## Final generation prompt

Use case: stylized-concept

Asset type: production-ready modular game environment sprite master sheet for the Event City Lab Kafka learning simulator

Create one clean 2048×2048 square isometric pixel-art master sprite sheet containing reusable assets for a bright Kafka learning city. This is an asset sheet, never a completed city scene. Every asset must be isolated, fully visible, non-overlapping, and easy to crop into a separate PNG.

Use a consistent 2:1 isometric projection based on a 64×32 ground tile, the same camera angle and pixel density for every object, crisp hard-edged 16-bit pixel art, nearest-neighbor appearance, a consistent 2–3 pixel deep-violet outline near `#302840`, at least 32 pixels of empty background around each object, and a contained lower-right contact shadow.

Organize the sheet into unlabeled zones containing road and sidewalk modules; six distinct general city buildings; two park modules, three tree variants, a street lamp, and a bench; a yellow Kafka delivery van plus coral and teal compact cars; and three Kafka facility references: a cyan Producer warehouse, lavender Serializer checkpoint, and blue Broker archive.

Use bright early golden-hour light from the upper left, warm cream surfaces, restrained peach and coral highlights, cyan and teal accents, fresh greens, and muted lavender-violet shadows. The facilities and yellow van should have the strongest hierarchy.

Generate on a perfectly flat uniform solid magenta chroma-key backdrop. Do not use magenta inside sprites. No text, letters, numbers, symbols, logos, watermark, people, labels, dividers, overlap, cropping, perspective mismatch, gradients, blur, painterly edges, photorealism, night lighting, cyberpunk darkness, or excessive micro-detail.

## Post-processing

- Removed the flat chroma-key background with the installed image-generation helper.
- Contracted the alpha edge by one pixel to remove the magenta fringe.
- Upscaled the preserved master to 2048×2048 with nearest-neighbor sampling.
- Split 26 disconnected components and assigned semantic filenames.
- Rejected a forced 24-color whole-sheet quantization because it damaged roofs and shadow detail.
- Runtime code imports only the sprites it uses; the generated master and complete split set are source records, not browser runtime dependencies.
