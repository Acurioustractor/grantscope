#!/usr/bin/env python3
"""
Build a many-to-many postcode → SA2 concordance table.

Problem: postcode_geo stores ONE SA2 per postcode, but postcodes often span
multiple SA2s. This means ~1,000 SA2s get zero entities because their
postcodes are mapped to a neighboring SA2.

Solution: For each SA2 boundary, find ALL postcodes whose centroid falls within
or near that SA2. Then for postcodes not covered by centroid matching,
use the SA2 boundaries to find overlapping postcodes.

Outputs SQL to create and populate a postcode_sa2_concordance table.
"""
import json
import subprocess
import os
import sys
from collections import defaultdict
from shapely.geometry import Point, shape, MultiPolygon
from shapely.strtree import STRtree
from shapely.ops import unary_union

# Load SA2 GeoJSON
print("Loading SA2 boundaries...")
with open("apps/web/public/geo/sa2-2021.json") as f:
    geojson = json.load(f)

sa2_polygons = []
sa2_props = []
for feat in geojson["features"]:
    try:
        geom = shape(feat["geometry"])
        if geom.is_valid and not geom.is_empty:
            sa2_polygons.append(geom)
            sa2_props.append(feat["properties"])
    except Exception:
        pass

print(f"Loaded {len(sa2_polygons)} SA2 polygons")
tree = STRtree(sa2_polygons)

# Get ALL postcodes with coordinates
print("Fetching postcodes...")
env = {**os.environ}
with open(".env") as ef:
    for line in ef:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k] = v.strip('"')

result = subprocess.run(
    ["psql", "-h", "aws-0-ap-southeast-2.pooler.supabase.com", "-p", "5432",
     "-U", "postgres.tednluwflfhxyucgwigh", "-d", "postgres",
     "-t", "-A", "-F", "|",
     "-c", "SELECT DISTINCT postcode, latitude, longitude FROM postcode_geo WHERE latitude IS NOT NULL AND longitude IS NOT NULL"],
    capture_output=True, text=True,
    env={**env, "PGPASSWORD": env.get("DATABASE_PASSWORD", "")}
)

postcodes = {}
for line in result.stdout.strip().split("\n"):
    line = line.strip()
    if not line:
        continue
    parts = [p.strip() for p in line.split("|")]
    if len(parts) == 3:
        try:
            postcodes[parts[0]] = (float(parts[1]), float(parts[2]))
        except ValueError:
            pass

print(f"Got {len(postcodes)} postcodes")

# Phase 1: Point-in-polygon — which SA2 does each postcode centroid fall in?
print("\nPhase 1: Centroid matching...")
centroid_map = {}  # postcode → sa2_code
for pc, (lat, lng) in postcodes.items():
    point = Point(lng, lat)
    candidates = tree.query(point)
    for idx in candidates:
        if sa2_polygons[idx].contains(point):
            centroid_map[pc] = sa2_props[idx]["SA2_CODE21"]
            break
    if pc not in centroid_map:
        # Use nearest
        nearest_idx = tree.nearest(point)
        centroid_map[pc] = sa2_props[nearest_idx]["SA2_CODE21"]

print(f"  Mapped {len(centroid_map)} postcodes by centroid")

# Phase 2: For each SA2, find postcodes within a buffer distance
# SA2s are often smaller than postcodes, so we need to find ALL postcodes
# that could contain addresses in this SA2
print("\nPhase 2: Finding all postcodes near each SA2...")
sa2_to_postcodes = defaultdict(set)  # sa2_code → set of postcodes

# First add centroid matches
for pc, sa2_code in centroid_map.items():
    sa2_to_postcodes[sa2_code].add(pc)

# For SA2s that still have no postcodes, find nearest postcodes
# by checking which postcode centroids are closest to SA2 centroid
postcode_points = {pc: Point(lng, lat) for pc, (lat, lng) in postcodes.items()}
postcode_list = list(postcode_points.keys())
postcode_geoms = [postcode_points[pc] for pc in postcode_list]
pc_tree = STRtree(postcode_geoms)

empty_count = 0
for i, props in enumerate(sa2_props):
    sa2_code = props["SA2_CODE21"]
    if sa2_to_postcodes[sa2_code]:
        continue  # already has postcodes

    poly = sa2_polygons[i]
    centroid = poly.centroid

    # Find postcodes within the SA2 boundary (with a small buffer for edge cases)
    buffered = poly.buffer(0.02)  # ~2km buffer
    candidates = pc_tree.query(buffered)
    for idx in candidates:
        pc = postcode_list[idx]
        if buffered.contains(postcode_points[pc]):
            sa2_to_postcodes[sa2_code].add(pc)

    # If still empty, find the 3 nearest postcodes
    if not sa2_to_postcodes[sa2_code]:
        # Use nearest from the tree
        nearest_indices = pc_tree.query(centroid.buffer(0.1))
        if not len(nearest_indices):
            nearest_indices = pc_tree.query(centroid.buffer(0.5))

        dists = []
        for idx in nearest_indices:
            d = centroid.distance(postcode_geoms[idx])
            dists.append((d, postcode_list[idx]))
        dists.sort()
        for _, pc in dists[:3]:
            sa2_to_postcodes[sa2_code].add(pc)

        if not sa2_to_postcodes[sa2_code]:
            # absolute fallback: nearest single postcode
            nearest_idx = pc_tree.nearest(centroid)
            sa2_to_postcodes[sa2_code].add(postcode_list[nearest_idx])

    empty_count += 1

# Stats
covered = sum(1 for v in sa2_to_postcodes.values() if v)
total_sa2 = len(sa2_props)
print(f"  Filled {empty_count} previously empty SA2s")
print(f"  SA2s with postcode mapping: {covered}/{total_sa2} ({100*covered/total_sa2:.1f}%)")

# Build concordance rows
print("\nBuilding concordance...")
rows = []
for sa2_code, pcs in sa2_to_postcodes.items():
    sa2_name = next((p["SA2_NAME21"] for p in sa2_props if p["SA2_CODE21"] == sa2_code), "")
    for pc in sorted(pcs):
        rows.append((pc, sa2_code, sa2_name))

print(f"Total concordance rows: {len(rows)}")
print(f"Unique postcodes: {len(set(r[0] for r in rows))}")
print(f"Unique SA2s: {len(set(r[1] for r in rows))}")

# Write SQL migration
sql_path = "/tmp/sa2_postcode_concordance.sql"
with open(sql_path, "w") as f:
    f.write("-- Postcode ↔ SA2 many-to-many concordance\n")
    f.write("-- Generated by build-sa2-postcode-concordance.py\n\n")
    f.write("CREATE TABLE IF NOT EXISTS postcode_sa2_concordance (\n")
    f.write("  postcode text NOT NULL,\n")
    f.write("  sa2_code text NOT NULL REFERENCES sa2_reference(sa2_code),\n")
    f.write("  sa2_name text,\n")
    f.write("  PRIMARY KEY (postcode, sa2_code)\n")
    f.write(");\n\n")
    f.write("TRUNCATE postcode_sa2_concordance;\n\n")
    f.write("INSERT INTO postcode_sa2_concordance (postcode, sa2_code, sa2_name) VALUES\n")

    for i, (pc, sa2, name) in enumerate(sorted(rows)):
        name_esc = name.replace("'", "''")
        comma = "," if i < len(rows) - 1 else ";"
        f.write(f"  ('{pc}', '{sa2}', '{name_esc}'){comma}\n")

print(f"\nSQL written to {sql_path}")
