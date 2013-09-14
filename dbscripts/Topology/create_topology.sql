
Set search_path TO topology,public;

--Create A Topology
 -- do this if you don't have a topology setup already
-- creates topology not allowing any tolerance
SELECT topology.CreateTopology('nigeria_states', 4326);

-- create a new table
CREATE TABLE public.topo_nigeria_states(gid serial primary key, name varchar(30));

--add a topogeometry column to it
SELECT topology.AddTopoGeometryColumn('nigeria_states', 'public', 'topo_nigeria_states', 'topo', 'MULTIPOLYGON') As new_layer_id;
--layer id = 1

--use new layer id in populating the new topogeometry column
-- we add the topogeoms to the new layer with 0 tolerance
INSERT INTO public.topo_nigeria_states(name, topo)
SELECT adm1_name,  topology.toTopoGeom(geom, 'nigeria_states', 1)
FROM public.nigeria_states;

--use to verify what has happened --
SELECT * FROM 
    topology.TopologySummary('nigeria_states'); 





    --CREATE TEMP TABLE edgemap(arc_id serial, edge_id int unique);
    
























-- header
SELECT '{ "type": "Topology", "transform": { "scale": [1,1], "translate": [0,0] }, "objects": {'

-- objects
UNION ALL SELECT '"' || cntry_name || '": ' || topology.AsTopoJSON(geom, 'edgemap')
FROM nigeria_states;

-- arcs
WITH edges AS ( 
  SELECT m.arc_id, e.geom FROM edgemap m, city_data.edge e
  WHERE e.edge_id = m.edge_id
), points AS (
  SELECT arc_id, (st_dumppoints(geom)).* FROM edges
), compare AS (
  SELECT p2.arc_id,
         CASE WHEN p1.path IS NULL THEN p2.geom
              ELSE ST_Translate(p2.geom, -ST_X(p1.geom), -ST_Y(p1.geom))
         END AS geom
  FROM points p2 LEFT OUTER JOIN points p1
  ON ( p1.arc_id = p2.arc_id AND p2.path[1] = p1.path[1]+1 )
  ORDER BY arc_id, p2.path
), arcsdump AS (
  SELECT arc_id, (regexp_matches( ST_AsGeoJSON(geom), '\[.*\]'))[1] as t
  FROM compare
), arcs AS (
  SELECT arc_id, '[' || array_to_string(array_agg(t), ',') || ']' as a FROM arcsdump
  GROUP BY arc_id
  ORDER BY arc_id
)
SELECT '}, "arcs": [' UNION ALL
SELECT array_to_string(array_agg(a), E',\n') from arcs

-- footer
UNION ALL SELECT ']}'::text as t;

select * from topology.layer