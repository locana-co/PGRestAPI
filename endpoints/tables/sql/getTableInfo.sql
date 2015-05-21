SELECT attname as column_name, atttypid::regtype::character varying AS data_type
FROM   pg_attribute
WHERE  attrelid = '{{table}}'::regclass
AND    attnum > 0
AND    NOT attisdropped;

