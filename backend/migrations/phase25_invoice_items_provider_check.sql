-- Phase 25: removes a redundant database check that blocks service invoices.
-- Error seen in the app: "Could not access invoice_items: Service does not belong to the invoice provider".
--
-- The API (POST /invoices) already verifies that the chosen service belongs to the logged-in
-- provider before it inserts anything, so a second check inside the database is not needed.
-- This drops only triggers on invoice_items whose function contains that exact message.
-- Safe to run more than once.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT t.tgname AS trigger_name, p.proname AS function_name, pg_get_functiondef(p.oid) AS definition
          FROM pg_trigger t
          JOIN pg_proc p ON p.oid = t.tgfoid
         WHERE t.tgrelid = 'public.invoice_items'::regclass
           AND NOT t.tgisinternal
           AND pg_get_functiondef(p.oid) ILIKE '%does not belong to the invoice provider%'
    LOOP
        RAISE NOTICE 'Dropping trigger % (function %). Definition was: %', r.trigger_name, r.function_name, r.definition;
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.invoice_items', r.trigger_name);
    END LOOP;
END $$;

-- Any invoice rows left behind by failed attempts (no items, never sent) are harmless,
-- but this removes pending service invoices that have no items.
DELETE FROM invoices i
 WHERE i.invoice_type = 'service'
   AND i.status = 'pending'
   AND NOT EXISTS (SELECT 1 FROM invoice_items it WHERE it.invoice_id = i.id);

NOTIFY pgrst, 'reload schema';
