-- =====================================================================
-- sql/73_hub_signoff.sql
-- What the person actually agreed to when they signed off.
--
-- ACCEPTED_BY and ACCEPTED_AT already say who and when. They do not say
-- WHAT: a row that records a click is weaker evidence than one that
-- records the sentence somebody ticked. If the wording of the sign-off
-- is ever changed, rows signed under the old wording still carry it.
--
-- Guarded. Requires 70_.
-- =====================================================================
SET DEFINE OFF;
DECLARE
  n NUMBER;
  PROCEDURE alt(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE NOT IN (-1430, -1442, -1451) THEN RAISE; END IF;
  END;
BEGIN
  SELECT COUNT(*) INTO n FROM user_tables WHERE table_name = 'HUB_ANSWER';
  IF n = 0 THEN
    raise_application_error(-20073,
      'HUB_ANSWER does not exist: run sql/70_hub_discussion.sql first.');
  END IF;

  alt('ALTER TABLE hub_answer ADD (signoff VARCHAR2(600))');
END;
/
