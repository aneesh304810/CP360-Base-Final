-- CP Catalog 360 view
SET DEFINE OFF;

CREATE OR REPLACE VIEW v_dataset_360 AS
SELECT d.platform_id, d.schema_name, d.object_name,
       d.platform_id || '.' || d.schema_name || '.' || d.object_name AS dataset_key,
       d.object_type, d.project_id, d.layer, d.domain,
       NVL(d.business_desc, d.tech_desc) AS description,
       d.owner, d.tags, d.feed_class, d.geography, d.regulatory_scope,
       (SELECT COUNT(*) FROM columns c
         WHERE c.platform_id = d.platform_id AND c.schema_name = d.schema_name
           AND c.object_name = d.object_name) AS column_count,
       (SELECT COUNT(*) FROM columns c
         WHERE c.platform_id = d.platform_id AND c.schema_name = d.schema_name
           AND c.object_name = d.object_name AND c.is_pii = 'Y') AS pii_column_count
FROM datasets d;
