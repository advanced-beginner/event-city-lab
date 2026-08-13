# Third-party notices

## Event City generated sprites

The isometric city sprites are newly generated project assets. Their source
prompt, generation date, reference roles, and post-processing record are stored
in `src/assets/city/source/generation-prompt.md`.

The Stable Diffusion Online image linked in that record and the user-provided
Gemini image were used only as visual direction. Their original files are not
redistributed, and no asset was extracted from them.

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
