#!/usr/bin/env python3
"""
For SA2s that still show zero entities, find the closest postcodes that DO have
entities and add them to the concordance. Uses a proximity approach.
"""
import json
import subprocess
import os
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

# Load SA2 GeoJSON
with open("apps/web/public/geo/sa2-2021.json") as f:
    geojson = json.load(f)

sa2_by_code = {}
sa2_polygons_by_code = {}
for feat in geojson["features"]:
    code = feat["properties"]["SA2_CODE21"]
    try:
        geom = shape(feat["geometry"])
        if geom.is_valid:
            sa2_by_code[code] = feat["properties"]
            sa2_polygons_by_code[code] = geom
    except Exception:
        pass

# Get empty SA2s from DB
env = {**os.environ}
with open(".env") as ef:
    for line in ef:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k] = v.strip('"')

pg_env = {**env, "PGPASSWORD": env.get("DATABASE_PASSWORD", "")}
pg_args = ["psql", "-h", "aws-0-ap-southeast-2.pooler.supabase.com", "-p", "5432",
           "-U", "postgres.tednluwflfhxyucgwigh", "-d", "postgres", "-t", "-A", "-F", "|"]

# Get empty SA2 codes
result = subprocess.run(
    pg_args + ["-c", """
    SELECT m.sa2_code FROM get_sa2_map_data() m
    JOIN sa2_reference r ON r.sa2_code = m.sa2_code
    WHERE m.entity_count = 0 AND m.seifa_decile = 5
    AND r.sa2_name NOT LIKE 'Migratory%%' AND r.sa2_name NOT LIKE 'No usual%%'
    AND r.sa2_name != 'Outside Australia'
    """],
    capture_output=True, text=True, env=pg_env
)
empty_sa2s = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
print(f"Empty SA2s to fix: {len(empty_sa2s)}")

# Get all postcodes that HAVE entities, with their lat/lng
result = subprocess.run(
    pg_args + ["-c", """
    SELECT DISTINCT e.postcode, p.latitude, p.longitude
    FROM gs_entities e
    JOIN postcode_geo p ON p.postcode = e.postcode
    WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
    """],
    capture_output=True, text=True, env=pg_env
)

entity_postcodes = {}
for line in result.stdout.strip().split("\n"):
    parts = [p.strip() for p in line.split("|")]
    if len(parts) == 3:
        try:
            entity_postcodes[parts[0]] = Point(float(parts[2]), float(parts[1]))
        except ValueError:
            pass

print(f"Postcodes with entities and coords: {len(entity_postcodes)}")

# Build spatial index of entity postcodes
pc_list = list(entity_postcodes.keys())
pc_points = [entity_postcodes[pc] for pc in pc_list]
pc_tree = STRtree(pc_points)

# For each empty SA2, find the 3 nearest postcodes that have entities
new_entries = []
for sa2_code in empty_sa2s:
    if sa2_code not in sa2_polygons_by_code:
        continue

    poly = sa2_polygons_by_code[sa2_code]
    centroid = poly.centroid
    sa2_name = sa2_by_code[sa2_code]["SA2_NAME21"]

    # Find postcodes within expanding buffer
    found = []
    for buf_size in [0.01, 0.02, 0.05, 0.1, 0.2, 0.5]:
        candidates = pc_tree.query(centroid.buffer(buf_size))
        for idx in candidates:
            d = centroid.distance(pc_points[idx])
            found.append((d, pc_list[idx]))
        if len(found) >= 3:
            break

    if not found:
        nearest_idx = pc_tree.nearest(centroid)
        found = [(centroid.distance(pc_points[nearest_idx]), pc_list[nearest_idx])]

    found.sort()
    for _, pc in found[:3]:  # Take top 3 nearest
        new_entries.append((pc, sa2_code, sa2_name))

print(f"New concordance entries: {len(new_entries)}")

# Write SQL
with open("/tmp/fix_empty_sa2.sql", "w") as f:
    f.write("-- Fix remaining empty SA2s by adding nearest entity-bearing postcodes\n")
    for pc, sa2, name in new_entries:
        name_esc = name.replace("'", "''")
        f.write(f"INSERT INTO postcode_sa2_concordance (postcode, sa2_code, sa2_name) VALUES ('{pc}', '{sa2}', '{name_esc}') ON CONFLICT DO NOTHING;\n")

print(f"SQL written to /tmp/fix_empty_sa2.sql")
