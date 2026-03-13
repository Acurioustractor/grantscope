#!/usr/bin/env python3
"""
Build a complete postcode → SA2 mapping using point-in-polygon spatial lookup.
Uses postcode centroids from postcode_geo and SA2 boundaries from sa2-2021.json.

Outputs CSV: postcode,sa2_code,sa2_name
"""
import json
import csv
import subprocess
import sys
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

# Load SA2 GeoJSON
print("Loading SA2 boundaries...")
with open("apps/web/public/geo/sa2-2021.json") as f:
    geojson = json.load(f)

sa2_polygons = []
sa2_props = []
for feat in geojson["features"]:
    try:
        geom = shape(feat["geometry"])
        if geom.is_valid:
            sa2_polygons.append(geom)
            sa2_props.append(feat["properties"])
    except Exception:
        pass

print(f"Loaded {len(sa2_polygons)} SA2 polygons")

# Build spatial index
tree = STRtree(sa2_polygons)

# Get postcode centroids from database via psql (no row limit)
print("Fetching postcode centroids...")
import os
env = {**os.environ}
# Load .env manually
with open(".env") as ef:
    for line in ef:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k] = v.strip('"')

result = subprocess.run(
    ["psql", "-h", "aws-0-ap-southeast-2.pooler.supabase.com", "-p", "5432",
     "-U", f"postgres.tednluwflfhxyucgwigh", "-d", "postgres",
     "-t", "-A", "-F", "|",
     "-c", "SELECT DISTINCT postcode, latitude, longitude FROM postcode_geo WHERE latitude IS NOT NULL AND longitude IS NOT NULL"],
    capture_output=True, text=True,
    env={**env, "PGPASSWORD": env.get("DATABASE_PASSWORD", "")}
)

postcodes = []
for line in result.stdout.strip().split("\n"):
    line = line.strip()
    if not line or "postcode" in line.lower():
        continue
    parts = [p.strip() for p in line.split("|")]
    if len(parts) == 3:
        try:
            postcodes.append((parts[0], float(parts[1]), float(parts[2])))
        except ValueError:
            pass

print(f"Got {len(postcodes)} postcodes with coordinates")

# Point-in-polygon lookup
print("Running spatial lookup...")
results = []
missed = 0
for postcode, lat, lng in postcodes:
    point = Point(lng, lat)
    # Query the spatial index
    candidates = tree.query(point)
    found = False
    for idx in candidates:
        if sa2_polygons[idx].contains(point):
            props = sa2_props[idx]
            results.append((postcode, props["SA2_CODE21"], props["SA2_NAME21"]))
            found = True
            break
    if not found:
        # Try nearest
        nearest_idx = tree.nearest(point)
        props = sa2_props[nearest_idx]
        results.append((postcode, props["SA2_CODE21"], props["SA2_NAME21"]))

print(f"Mapped {len(results)} postcodes to SA2s")

# Count unique SA2s
unique_sa2s = set(r[1] for r in results)
print(f"Unique SA2s covered: {len(unique_sa2s)}")

# Write CSV
output = "/tmp/postcode_sa2_map.csv"
with open(output, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["postcode", "sa2_code", "sa2_name"])
    for row in sorted(results):
        writer.writerow(row)

print(f"Written to {output}")

# Also output SQL for updating postcode_geo
sql_output = "/tmp/update_postcode_sa2.sql"
with open(sql_output, "w") as f:
    f.write("-- Update postcode_geo sa2 codes from spatial lookup\n")
    f.write("BEGIN;\n")
    for postcode, sa2_code, sa2_name in sorted(results):
        sa2_name_escaped = sa2_name.replace("'", "''")
        f.write(f"UPDATE postcode_geo SET sa2_code = '{sa2_code}', sa2_name = '{sa2_name_escaped}' WHERE postcode = '{postcode}' AND sa2_code IS NULL;\n")
    f.write("COMMIT;\n")

print(f"SQL updates written to {sql_output}")
