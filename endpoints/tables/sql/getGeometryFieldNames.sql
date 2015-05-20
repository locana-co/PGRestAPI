SELECT attname::text as column_name         
FROM   pg_attribute
WHERE  attrelid = '{{table}}'::regclass
AND    attnum > 0
AND    NOT attisdropped
AND atttypid::regtype::character varying  = 'geometry';