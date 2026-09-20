-- ============================================================================
-- 53_event_subscription.sql — who consumes an event, and how critical it is.
--
-- 51_event360.sql holds the CONTRACT: what SEI says an event is. This file
-- holds what BBH decides about it. The two are kept apart on purpose. A
-- consumer list and a criticality band are ours; writing them into
-- META_EVENT_DEFINITION would let an opinion of ours reach a screen wearing
-- the specification's authority.
--
-- WHY CRITICALITY WEIGHTS ARE A TABLE AND NOT A CONSTANT
--
-- A criticality score whose arithmetic is hidden is an opinion in a badge.
-- The weights live here so the API can return them with every score and the
-- screen can show its own working. Changing a weight changes every band, which
-- is the point: if nobody can move it, nobody has agreed to it.
--
-- WHY THE FILTER IS A COLUMN AND NOT A FOOTNOTE
--
-- A subscription is a consumer, a filter and a delivery mode. The filter is
-- what decides how many messages arrive and therefore how many SDC view reads
-- follow, and the read is the cost (see 52_sdc_compute.sql). A subscription
-- list without filters cannot price anything.
--
-- Idempotent: every statement tolerates re-running.
-- ============================================================================

DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE ref_event_consumer (
    consumer_code   VARCHAR2(40)  NOT NULL,
    consumer_name   VARCHAR2(200),
    delivery_mode   VARCHAR2(20),          -- stream | queue | batch
    owner_team      VARCHAR2(120),
    status          VARCHAR2(20),          -- ACTIVE | PLANNED | RETIRED
    notes           VARCHAR2(400),
    updated_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ref_event_consumer PRIMARY KEY (consumer_code))';
EXCEPTION WHEN e THEN NULL; END;
/

-- Grain: one row per (consumer, event). A consumer taking 40 events has 40
-- rows, because each can carry its own filter and go live on its own date.
DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE ctl_event_subscription (
    consumer_code   VARCHAR2(40)  NOT NULL,
    event_id        NUMBER(5)     NOT NULL,
    filter_expr     VARCHAR2(200),         -- ''all operations'', ''op = U'', ...
    delivery_mode   VARCHAR2(20),          -- overrides the consumer default
    status          VARCHAR2(20)  NOT NULL,-- ACTIVE | REQUESTED | RETIRED
    since_dt        DATE,
    retired_dt      DATE,
    requested_by    VARCHAR2(120),
    notes           VARCHAR2(400),
    updated_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ctl_event_subscription PRIMARY KEY (consumer_code, event_id))';
EXCEPTION WHEN e THEN NULL; END;
/

DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE
  'CREATE INDEX ix_ctl_event_sub_event ON ctl_event_subscription (event_id, status)';
EXCEPTION WHEN e THEN NULL; END;
/

-- The five inputs a criticality band is built from, with their weights. Seeded
-- below; change a weight and re-run, or update in place — the API reads this
-- table on every request rather than caching it, so a change takes effect on
-- the next screen refresh and the screen shows the weights it used.
DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE ref_event_criticality_weight (
    input_code      VARCHAR2(20)  NOT NULL,
    label           VARCHAR2(80),
    weight          NUMBER(5,4)   NOT NULL,
    what_it_is      VARCHAR2(400),
    updated_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ref_event_crit_weight PRIMARY KEY (input_code))';
EXCEPTION WHEN e THEN NULL; END;
/

MERGE INTO ref_event_criticality_weight t USING (SELECT
  'reach' c, 'Consumer reach' l, 0.30 w,
  'how many live subscriptions read it' d FROM dual) s ON (t.input_code=s.c)
 WHEN NOT MATCHED THEN INSERT (input_code,label,weight,what_it_is)
 VALUES (s.c,s.l,s.w,s.d);
MERGE INTO ref_event_criticality_weight t USING (SELECT
  'volume' c, 'Message volume' l, 0.25 w,
  'how often it actually fires, from the measured reference month' d FROM dual)
 s ON (t.input_code=s.c) WHEN NOT MATCHED THEN
 INSERT (input_code,label,weight,what_it_is) VALUES (s.c,s.l,s.w,s.d);
MERGE INTO ref_event_criticality_weight t USING (SELECT
  'couple' c, 'Coupling' l, 0.20 w,
  'other events raised by the same source column change' d FROM dual)
 s ON (t.input_code=s.c) WHEN NOT MATCHED THEN
 INSERT (input_code,label,weight,what_it_is) VALUES (s.c,s.l,s.w,s.d);
MERGE INTO ref_event_criticality_weight t USING (SELECT
  'surface' c, 'Trigger surface' l, 0.10 w,
  'how many columns can raise it' d FROM dual)
 s ON (t.input_code=s.c) WHEN NOT MATCHED THEN
 INSERT (input_code,label,weight,what_it_is) VALUES (s.c,s.l,s.w,s.d);
MERGE INTO ref_event_criticality_weight t USING (SELECT
  'risk' c, 'Contract risk' l, 0.15 w,
  'anything the specification leaves unstated, and any LOAD_FLAG' d FROM dual)
 s ON (t.input_code=s.c) WHEN NOT MATCHED THEN
 INSERT (input_code,label,weight,what_it_is) VALUES (s.c,s.l,s.w,s.d);
COMMIT;

-- The commercial inputs. These are BBH's agreement, not SEI's contract and not
-- the reference client's: one row, edited when the agreement changes, read by
-- the cost endpoint. A floor of 15,000 with usage far below it means the floor
-- IS the bill, and the cost screen says so rather than reporting usage as
-- though it were spend.
DECLARE e EXCEPTION; PRAGMA EXCEPTION_INIT(e, -955);
BEGIN EXECUTE IMMEDIATE '
  CREATE TABLE ref_compute_agreement (
    agreement_code   VARCHAR2(40)  NOT NULL,
    credit_price     NUMBER(10,4),          -- $ per credit-hour
    default_wh       VARCHAR2(10),
    concurrency      NUMBER(6,3),           -- uptime / summed query elapsed
    minimum_amount   NUMBER(14,2),          -- contracted floor, or NULL
    minimum_per      VARCHAR2(10),          -- MONTH | YEAR
    target_accounts  NUMBER(12),
    target_positions NUMBER(14),
    target_transactions NUMBER(14),
    growth_per_quarter_pct NUMBER(6,3),
    note             VARCHAR2(400),
    updated_at       TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT pk_ref_compute_agreement PRIMARY KEY (agreement_code))';
EXCEPTION WHEN e THEN NULL; END;
/

-- Seeded with what is known today. CONCURRENCY 1 is an ASSUMPTION -- summed
-- query elapsed treated as warehouse uptime -- and MINIMUM_PER is a guess
-- pending confirmation; both are flagged by the API so no screen presents
-- them as measured.
MERGE INTO ref_compute_agreement t USING (SELECT 'BBH' c FROM dual) s
  ON (t.agreement_code = s.c)
  WHEN NOT MATCHED THEN INSERT
    (agreement_code, credit_price, default_wh, concurrency, minimum_amount,
     minimum_per, target_accounts, growth_per_quarter_pct, note)
  VALUES ('BBH', 7.00, 'XS', 1, 15000, 'YEAR', 15000, 1.0,
          'credit price and floor confirmed; concurrency is an assumption and '
          || 'minimum_per is unconfirmed');
COMMIT;

-- ------------------------------------------------------- post-load checks --
-- SELECT 'subscription on an unknown event' g, consumer_code, event_id
--   FROM ctl_event_subscription s
--  WHERE NOT EXISTS (SELECT 1 FROM meta_event_definition d
--                     WHERE d.event_id = s.event_id)
-- UNION ALL
-- SELECT 'subscription with no consumer', consumer_code, event_id
--   FROM ctl_event_subscription s
--  WHERE NOT EXISTS (SELECT 1 FROM ref_event_consumer c
--                     WHERE c.consumer_code = s.consumer_code);
--
-- SELECT SUM(weight) FROM ref_event_criticality_weight;   -- must be 1.0
