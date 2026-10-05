-- =====================================================================
-- sql/74_hub_signoff_identity.sql
-- Where the sign-off came from, as far as the server could tell.
--
-- ACCEPTED_BY is a name. These three say how much that name is worth:
--
--   LAN_ID      the account, from the sign-in session or from the
--               reverse proxy. NULL when neither was available.
--   HOST_NAME   reverse DNS on the caller's address. Often NULL.
--   CLIENT_IP   always captured.
--   ID_SOURCE   session | proxy | none. "none" means ACCEPTED_BY is
--               self-declared: somebody picked their own name off a
--               list and nothing checked it.
--
-- The source column is the point. Without it every row looks equally
-- well attested, and the ones signed while there was no sign-in look
-- exactly like the ones signed after it was turned on.
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
    raise_application_error(-20074,
      'HUB_ANSWER does not exist: run sql/70_hub_discussion.sql first.');
  END IF;

  alt('ALTER TABLE hub_answer ADD (
    lan_id      VARCHAR2(60),
    host_name   VARCHAR2(160),
    client_ip   VARCHAR2(45),
    id_source   VARCHAR2(10))');
END;
/
