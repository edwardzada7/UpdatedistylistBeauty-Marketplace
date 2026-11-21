-- Phase 28: use istylist.online for contact emails in legal pages and mention the web app. Safe to re-run.
UPDATE legal_pages
SET content = REPLACE(content, '@istylist.app', '@istylist.online'),
    updated_at = NOW()
WHERE content LIKE '%@istylist.app%';

UPDATE legal_pages
SET content = content || E'\n\n## Web App\niStylist is also available on the web at https://app.istylist.online. This policy applies to both the mobile app and the web app.',
    updated_at = NOW()
WHERE slug IN ('privacy', 'terms') AND content NOT LIKE '%app.istylist.online%';
