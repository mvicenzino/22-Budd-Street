# 22 Budd Street — A place to call home

An interactive exterior and four-level interior walkthrough, built with locally bundled Three.js. Static hosting; no build, API keys, runtime packages, or external asset requests are required.

## Run

Use Node.js 22 or later:

```sh
npm run dev
# http://127.0.0.1:4173
npm test
```

Deploy the repository root as a static site on Vercel. Open it through a web server, not a `file://` URL, so browser modules load correctly.

## Explore

- **Outside:** choose a viewpoint, start a walk-around, or open **Finishes & garden**. Camera presets ease into place; dragging interrupts the movement.
- **Inside:** step through nearby arrows, use **Next room / Previous room**, or **Play tour** for twelve stops across four levels. Looking around, choosing a room, opening photos, or hiding the tab pauses autoplay.
- **Rooms & finishes:** choose a floor and destination, change wall colors, furniture and floors, and show dimensions. **Floor plan** frames the complete current floor; **Eye level** returns to where you stood.
- **Quality:** Auto begins with High on desktop and Balanced on compact/touch screens, then lowers quality if sustained frame times exceed 34 ms after warm-up. High, Balanced and Light can also be selected explicitly. Reduced camera motion follows the system preference initially and can be changed here.

## Agreed wall palette

Digital swatches were taken from Benjamin Moore's official `bmc_color_hex` metadata on September 9, 2026:

| Spaces | Color | Digital swatch |
| --- | --- | --- |
| Living, dining, foyer/halls, bedrooms, loft and connecting interior spaces | [Pale Oak OC-20](https://www.benjaminmoore.com/en-us/paint-colors/color/oc-20/pale-oak) | `#DDD9CE` |
| Kitchen, sunroom and basement | [Seapearl OC-19](https://www.benjaminmoore.com/en-us/paint-colors/color/oc-19/seapearl) | `#E7E4D9` |
| Upstairs bathroom and powder room | [Classic Gray OC-23](https://www.benjaminmoore.com/en-us/paint-colors/color/oc-23/classic-gray) | `#E3E0D7` |

The existing rear screened porch is identified as the sunroom; its house-facing wall receives Seapearl without changing the modeled enclosure. Basement block walls retain their texture beneath the selected paint. The exterior porch, trim and ceilings keep their existing finishes.

Design storage version 5 replaces earlier saved wall experiments with this palette once, preserving furniture, flooring and kitchen settings. Subsequent wall changes continue to save locally. Reset returns to the agreed room colors.

## Rendering

AgX tone mapping, HDR color where supported, antialiased scene rendering, depth-aware ambient occlusion (8–32 samples by quality), filtered environment lighting and procedural surface detail. The depth pass excludes transparent glazing and navigation overlays; shadow maps render once per frame. Quality controls adjust resolution, antialiasing, occlusion resolution and shadow-map size. Inactive tabs suspend scene rendering and pause tours.

This remains a conceptual, real-time model based on photos and floor plans, not a measured survey or a photorealistic scan. Paint is a digital approximation affected by the simulated lighting and display. The sky photograph is Poly Haven's CC0 “Kloofendal 48d partly cloudy.”
