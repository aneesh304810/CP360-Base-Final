-- CP 360 · Hub component delivery status (Tier-2: shared, reviewable)
-- The ONE surface the UI writes. History table = the review/audit trail.
CREATE TABLE component_status (
  component_id   VARCHAR2(10)  PRIMARY KEY,
  status         VARCHAR2(20)  NOT NULL
                 CHECK (status IN ('Not Started','In Design','In Review',
                                   'Approved','In Build','Complete')),
  pct            NUMBER(3)     NOT NULL CHECK (pct BETWEEN 0 AND 100),
  note           VARCHAR2(400),
  updated_by     VARCHAR2(60)  DEFAULT 'cp360-ui' NOT NULL,
  updated_at     TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE TABLE component_status_hist (
  hist_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  component_id   VARCHAR2(10)  NOT NULL,
  status         VARCHAR2(20)  NOT NULL,
  pct            NUMBER(3)     NOT NULL,
  note           VARCHAR2(400),
  updated_by     VARCHAR2(60)  NOT NULL,
  updated_at     TIMESTAMP     NOT NULL
);
CREATE INDEX ix_comp_status_hist ON component_status_hist (component_id, updated_at);

-- review views
CREATE OR REPLACE VIEW v_component_status_review AS
SELECT h.component_id, h.status, h.pct, h.updated_by, h.updated_at,
       LAG(h.status) OVER (PARTITION BY h.component_id ORDER BY h.updated_at) prev_status,
       LAG(h.pct)    OVER (PARTITION BY h.component_id ORDER BY h.updated_at) prev_pct
FROM   component_status_hist h;
