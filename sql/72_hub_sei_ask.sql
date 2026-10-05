-- =====================================================================
-- sql/72_hub_sei_ask.sql
-- One column: the question to put to SEI.
--
-- A BBH recommendation sometimes has an SEI-facing half — "does SWP
-- deliver on Saturdays?" is not something BBH can decide alone. Those
-- are the rows that turn a review into an agenda, so they are a column
-- rather than a sentence buried in the body: they have to be
-- extractable as a list.
--
-- Guarded. Requires 70_ and 71_.
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
    raise_application_error(-20072,
      'HUB_ANSWER does not exist: run sql/70_hub_discussion.sql and '
      || 'sql/71_hub_discussion_corpus.sql before this script.');
  END IF;

  alt('ALTER TABLE hub_answer ADD (sei_ask VARCHAR2(1000))');
END;
/
