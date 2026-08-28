DROP TRIGGER IF EXISTS action_receipt_ledger_immutable ON "action_receipt_ledger";
DROP TABLE IF EXISTS "action_receipt_ledger";
DROP FUNCTION IF EXISTS rakshex_reject_action_receipt_mutation();
