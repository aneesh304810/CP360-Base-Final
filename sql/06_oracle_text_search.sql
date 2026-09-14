-- Oracle Text indexes (optional; needs CTXAPP). Skips cleanly if unavailable.
SET DEFINE OFF;

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_ds_text ON datasets(business_desc) '
    || 'INDEXTYPE IS CTXSYS.CONTEXT PARAMETERS (''''SYNC (ON COMMIT)'''')';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN
    DBMS_OUTPUT.PUT_LINE('Skipping ix_ds_text: ' || SQLERRM);
  END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_col_text ON columns(business_desc) '
    || 'INDEXTYPE IS CTXSYS.CONTEXT PARAMETERS (''''SYNC (ON COMMIT)'''')';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN
    DBMS_OUTPUT.PUT_LINE('Skipping ix_col_text: ' || SQLERRM);
  END IF;
END;
/
