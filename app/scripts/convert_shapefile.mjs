/**
 * Convert Thailand ECT election constituency Shapefile to optimized TopoJSON.
 *
 * @description Reads .shp/.dbf → GeoJSON → TopoJSON with simplification
 *              and quantization for efficient web delivery.
 *              Reduces ~80MB Shapefile to ~1-3MB TopoJSON.
 */

import * as shapefile from "shapefile";
import * as topojsonServer from "topojson-server";
import * as topojsonSimplify from "topojson-simplify";
import * as topojsonClient from "topojson-client";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHP_PATH = join(__dirname, "../tmp_shp/constituencies.shp");
const DBF_PATH = join(__dirname, "../tmp_shp/constituencies.dbf");
const OUTPUT_DIR = join(__dirname, "../public/data");
const OUTPUT_TOPO = join(OUTPUT_DIR, "constituencies_topo.json");
const OUTPUT_GEO = join(OUTPUT_DIR, "constituencies.json");

async function main() {
  console.log("[convert] Reading shapefile...");

  const features = [];
  const source = await shapefile.open(SHP_PATH, DBF_PATH, {
    encoding: "utf-8",
  });

  let result = await source.read();
  while (!result.done) {
    features.push(result.value);
    result = await source.read();
  }

  console.log(`[convert] Read ${features.length} features`);
  console.log("[convert] Sample:", JSON.stringify(features[0].properties));

  const geojson = { type: "FeatureCollection", features };

  // ── Step 1: Convert to TopoJSON (shares arcs between adjacent polygons) ──
  console.log("[convert] Converting to TopoJSON...");
  const topology = topojsonServer.topology(
    { constituencies: geojson },
    1e5 // quantization: 100k grid
  );

  console.log(
    `[convert] TopoJSON arcs: ${topology.arcs.length}, objects: constituencies`
  );

  // ── Step 2: Simplify (Douglas-Peucker topology-preserving) ──
  console.log("[convert] Simplifying...");
  const presimplified = topojsonSimplify.presimplify(topology);
  const min_weight = topojsonSimplify.quantile(presimplified, 0.02); // keep top 98%
  const simplified = topojsonSimplify.simplify(presimplified, min_weight);

  // ── Step 3: Filter small detached rings ──
  const filtered = topojsonSimplify.filter(
    simplified,
    topojsonSimplify.filterWeight(
      simplified,
      min_weight * 0.5
    )
  );

  const final_topo = filtered || simplified;

  // ── Step 4: Write TopoJSON ──
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const topo_str = JSON.stringify(final_topo);
  writeFileSync(OUTPUT_TOPO, topo_str);
  const topo_mb = (Buffer.byteLength(topo_str) / 1024 / 1024).toFixed(2);
  console.log(`[convert] TopoJSON output: ${topo_mb} MB`);

  // ── Step 5: Also write back as simplified GeoJSON for easy use ──
  const simplified_geo = topojsonClient.feature(
    final_topo,
    final_topo.objects.constituencies
  );
  const geo_str = JSON.stringify(simplified_geo);
  writeFileSync(OUTPUT_GEO, geo_str);
  const geo_mb = (Buffer.byteLength(geo_str) / 1024 / 1024).toFixed(2);
  console.log(`[convert] GeoJSON output: ${geo_mb} MB`);

  console.log(`[convert] Done. ${features.length} constituencies processed.`);

  // ── Verify feature count ──
  const verify = topojsonClient.feature(
    final_topo,
    final_topo.objects.constituencies
  );
  console.log(`[convert] Verification: ${verify.features.length} features in output`);
}

main().catch((err) => {
  console.error("[convert] Error:", err);
  process.exit(1);
});
