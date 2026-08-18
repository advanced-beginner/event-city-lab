# Third-party notices

## Event City generated visual assets

The isometric city sprites are newly generated project assets. Their source
prompt, generation date, reference roles, and post-processing record are stored
in `src/assets/city/source/generation-prompt.md`.

The Stable Diffusion Online image linked in that record was used only as visual
direction. It is not redistributed and no runtime asset was extracted from it.

Two Gemini-generated city images supplied and authorized for use by the user
are distributed as optimized runtime derivatives:

- `src/assets/city/background/event-city-main.webp`: Chapter 1 city background,
  derived from `Gemini_Generated_Image_ixg878ixg878ixg8.png` by crop, resize,
  and WebP encoding.
- `src/assets/city/background/event-city-atlas.webp`: Chapter 2–8 shared city
  atlas, derived from `Gemini_Generated_Image_ovrs7covrs7covrs.png` by resize
  and WebP encoding.

The original PNG files are not redistributed. The asset manifest records the
runtime files, source filenames, dimensions, transformations, and usage.

## Nanum Gothic

The UI requests Nanum Gothic through Google Fonts and falls back to system
Korean sans-serif fonts when the service is unavailable. Nanum Gothic is
distributed by Google Fonts under the SIL Open Font License 1.1:

- https://fonts.google.com/specimen/Nanum+Gothic
- https://github.com/google/fonts/tree/main/ofl/nanumgothic
- https://openfontlicense.org/open-font-license-official-text/

Runtime and development dependencies retain their own licenses. Their exact
versions are recorded in `package-lock.json`.

Apache Kafka is a trademark of The Apache Software Foundation. Event City Lab
is an independent educational simulator and is not affiliated with or endorsed
by the Apache Software Foundation.
