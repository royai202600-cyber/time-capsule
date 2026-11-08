# Public Sea city tiles

The map archive is a single PMTiles file for the areas around the 60 seeded
shores in Macau, Hong Kong, Taipei, Tokyo, Kyoto, Seoul, Singapore, Bangkok,
Beijing, and Kuala Lumpur. The extraction region is
[`public-sea-cities.geojson`](public-sea-cities.geojson): each city's shore
extent plus roughly 5 km on each side. This covers the 3 km throwing area and
the 5 km nearby view around the initial shores. The map may be blank elsewhere.

Source: Protomaps daily planet build, 2026-11-07,
`https://build.protomaps.com/20261107.pmtiles`. Extracted with go-pmtiles
v1.31.2:

```sh
pmtiles extract https://build.protomaps.com/20261107.pmtiles sea-cities.pmtiles \
  --region=docs/design/public-sea-cities.geojson
```

The archive has 2,006 vector tile entries, zooms 0–15, and is 98 MB. MapLibre
overscales zoom 15 above that. SHA-256:
`b721ad604602f33bd61ce4fe2f6491ef27b7708a5beb4483aa01e773bb89b0d2`.
The archive itself is stored in the `time-capsule-map-tiles` Cloudflare R2
bucket, not in Git. The pilot URL is
`https://pub-be241edeef89474b860a7180130c5daa.r2.dev/sea-cities.pmtiles`.
Cloudflare rate-limits `r2.dev`; use a custom domain for broader production use.

The bucket's CORS rule allows public `GET` and `HEAD` with `Range`, exposes
range and length response headers, and uses `AllowedOrigins: ["*"]`. A wildcard
is needed because the Expo Go WebView can have an opaque origin; the bucket
contains public map data only. The production Vercel and `localhost:8088`
origins are included by that rule.
