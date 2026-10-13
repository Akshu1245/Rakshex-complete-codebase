-- Preserve all existing evidence and serialize writers during validation.
LOCK TABLE action_receipt_ledger IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE duplicate_groups bigint;
BEGIN
  SELECT count(*) INTO duplicate_groups FROM (
    SELECT workspace_id, request_id, event_type
    FROM action_receipt_ledger
    GROUP BY workspace_id, request_id, event_type
    HAVING count(*) > 1
  ) duplicates;
  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION 'action_receipt_ledger has % duplicate event groups; operator reconciliation required', duplicate_groups;
  END IF;
END;
$$;
CREATE UNIQUE INDEX IF NOT EXISTS action_receipt_ledger_event_idempotency_uniq
  ON action_receipt_ledger (workspace_id, request_id, event_type);
