/**
 * Basemap configuration for the live bus map.
 *
 * The public OpenStreetMap raster tile server (tile.openstreetmap.org) blocks
 * applications that do not follow its tile usage policy and shows a 403
 * "Access blocked" tile. Do not point the ERP at it.
 *
 * Default: OpenFreeMap "Liberty" vector style — free, no API key, commercial
 * use allowed, self-hosting supported. Override with any MapLibre-compatible
 * style URL:
 *
 *   NEXT_PUBLIC_MAP_STYLE_URL="https://your-tiles.example.com/style.json"
 */
export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() ||
  "https://tiles.openfreemap.org/styles/liberty";
