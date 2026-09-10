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
- **Inside:** step through nearby arrows, use **Next room / Previous room**, or **Play tour** for eighteen stops across four levels. Looking around, choosing a room, opening photos, or hiding the tab pauses autoplay.
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

## Full-house cinematic tour

**Take a cinematic tour** plays a 90-second film with fourteen chapters across all four levels: foyer, living room, dining room, kitchen, sunroom, powder room, upstairs hall, three bedrooms, upstairs bathroom, loft, and basement. The opening follows a continuous path through the first floor; later room studies use gentle camera moves and brief fades between locations. Pause, scrub, jump to a chapter, restart, or return to exploring. Reduced-motion mode starts paused. Hiding the tab pauses playback. The camera and transitions follow the same deterministic timeline used for the downloadable film.

The shared model uses subtle furniture/cabinet bevels, finer wood grain, satin floor reflections and fabric sheen, with the agreed paint palette throughout. The cinematic route is composed for the default furniture arrangement; a custom layout can alter the framing.

A silent **90-second, 1920 × 1080, 24 fps MP4** is included in `media/budd-street-cinematic.mp4` and available through **Save film**. It is rendered frame by frame, with 4× MSAA, full-resolution 48-sample ambient occlusion and room titles. This avoids dropped frames during recording on slower devices. The interactive **Play tour** remains a separate guided exploration mode with eighteen stops across four levels.

### Reproduce the exports

The website still serves static files without a build step. Export tooling uses development dependencies only:

```sh
npm ci
npm run dev
# In a second terminal; requires Google Chrome and ffmpeg:
npm run render:film
npm run test:browser
# Review every chapter before a full export:
npm run render:film -- --mode=stills --width=960 --height=540
# Check a short section at a lower resolution:
npm run render:film -- --start=18 --end=22 --width=960 --height=540 --output=rendered/check
# Optional physical-lighting still (five light bounces):
npm run render:film -- --mode=trace --time=8 --samples=128 --width=1280 --height=720
```

Set `CHROME_PATH` if Chrome is installed somewhere other than the default macOS location, and `FFMPEG_PATH` if ffmpeg is not on the executable path. Exports go to the ignored `rendered/` directory. `--output=...`, `--width=...`, `--height=...`, and `--fps=...` control the destination, resolution, and frame rate; MP4 dimensions must be even. The tool reads the duration and chapter positions from the scene rather than hard-coding a frame count. `--mode=stills` writes a frame for every chapter, a labeled `contact-sheet.png`, and a manifest. Film frames stream directly to ffmpeg; the final MP4 replaces an existing export only after rendering and encoding both succeed. A JSON manifest records the timeline, output settings, and render time.

The default encoder is software H.264 at CRF 18. `--encoder=h264_videotoolbox` enables optional macOS hardware encoding at 20 Mbps. Chrome uses Metal on macOS. The path tracer loads only in the export tool, follows the room fixtures on every floor, uses a dedicated render context, and does not add work to the interactive renderer. Its stills are lighting studies; the included moving film uses the faster raster pipeline.

`npm run build:renderer` rebuilds the checked-in export bundle from the pinned Three.js-compatible path tracer. Third-party license notices are kept beside the vendored files.
