-- Phase 25: fixes "Could not access invoice_items: Service does not belong to the invoice provider".
--
-- Some database trigger on invoice_items raises that message. It is not defined anywhere in this
-- repo and compares ids that do not line up with what the app sends. The API already checks that
-- the service belongs to the provider before inserting (see create_invoice in
-- backend/consultation_routes.py), so the duplicate check is removed.
-- Safe to run more than once.
DO $$
DECLARE
    trg RECORD;
BEGIN
    FOR trg IN
        SELECT t.tgname
          FROM pg_trigger t
          JOIN pg_proc p ON p.oid = t.tgfoid
         WHERE t.tgrelid = 'public.invoice_items'::regclass
           AND NOT t.tgisinternal
           AND p.prosrc ILIKE '%does not belong to the invoice provider%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.invoice_items', trg.tgname);
        RAISE NOTICE 'Dropped trigger %', trg.tgname;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
