# Public Sea city tiles

The map archive is a single PMTiles file for the areas around the 60 seeded
shores in Macau, Hong Kong, Taipei, Tokyo, Kyoto, Seoul, Singapore, Bangkok,
Beijing, and Kuala Lumpur. The extraction region is
[`public-sea-cities.geojson`](public-sea-cities.geojson): each city's shore
extent plus roughly 5 km on each side. This covers the 3 km throwing area and
the 5 km nearby view around the initial shores. The map may be blank elsewhere.
The Hong Kong polygon also extends to Clear Water Bay and HKUST, through
longitude 114.280 and latitude 22.350.

Source: Protomaps daily planet build, 2026-11-07,
`https://build.protomaps.com/20261107.pmtiles`. Extracted with go-pmtiles
v1.31.2:

```sh
pmtiles extract https://build.protomaps.com/20261107.pmtiles sea-cities.pmtiles \
  --region=docs/design/public-sea-cities.geojson
```

The archive has 2,080 vector tile entries, zooms 0–15, and is 98,984,820 bytes
(99.0 MB). MapLibre
overscales zoom 15 above that. SHA-256:
`8d690333d07a0da418ae1f18558ad6f912aa71828977c20963f9c475121c34fa`.
The archive itself is stored in the `time-capsule-map-tiles` Cloudflare R2
bucket, not in Git. The pilot URL is
`https://pub-be241edeef89474b860a7180130c5daa.r2.dev/sea-cities.pmtiles`.
Cloudflare rate-limits `r2.dev`; use a custom domain for broader production use.
The uploaded archive returned `206 Partial Content` for a 16,384-byte range;
the bytes matched the local file. The Journey map rendered HKUST's buildings
and curved monument against the expanded tiles at 22.3374255, 114.2629606.

The bucket's CORS rule allows public `GET` and `HEAD` with `Range`, exposes
range and length response headers, and uses `AllowedOrigins: ["*"]`. A wildcard
is needed because the Expo Go WebView can have an opaque origin; the bucket
contains public map data only. The production Vercel and `localhost:8088`
origins are included by that rule.
