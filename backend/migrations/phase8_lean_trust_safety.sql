-- ============================================================================
-- Phase 8 Lean - Trust, Safety, Reporting & App Store Compliance Foundation
-- Fully additive. Three new tables. Safe to re-run.
-- ============================================================================

-- 1) Legal pages (privacy, terms, community-guidelines, refund-policy)
CREATE TABLE IF NOT EXISTS legal_pages (
    id         BIGSERIAL PRIMARY KEY,
    slug       VARCHAR(64) UNIQUE NOT NULL,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_legal_pages_slug ON legal_pages(slug);

-- Seed the 4 required pages. ON CONFLICT keeps any admin edits intact.
INSERT INTO legal_pages (slug, title, content) VALUES
('privacy', 'Privacy Policy',
$$# Privacy Policy

_Last updated: {{TODAY}}_

iStylist ("we", "us") respects your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile and web applications.

## Information We Collect
- Account information you provide (name, email, phone, profile photo)
- KYC verification documents (used only for identity verification)
- Booking, wallet, payment, and chat history
- Device, IP, and usage data for security and fraud prevention

## How We Use Information
- To operate bookings, payments, and provider verification
- To prevent fraud, abuse, and protect users
- To send service-related notifications
- To comply with legal and regulatory requirements (Nigeria NDPA, GDPR where applicable)

## Sharing
We do not sell your data. We share data with:
- Payment processors (Flutterwave) strictly for processing your transactions
- Cloud infrastructure providers under standard data-processing agreements
- Authorities when required by law

## Your Rights
You may request access, correction, or deletion of your data at any time via Profile → Danger Zone → Delete My Account, or by contacting support.

## Contact
Email: privacy@istylist.app
$$),
('terms', 'Terms of Service',
$$# Terms of Service

_Last updated: {{TODAY}}_

By creating an account on iStylist, you agree to these Terms.

## Eligibility
You must be at least 18 years old and able to enter binding contracts under Nigerian law.

## Bookings & Payments
- Customers fund bookings into escrow; funds are released to providers after service completion.
- Providers must complete KYC verification before requesting payouts.
- Platform fees are disclosed before each transaction.

## Conduct
You agree not to: harass other users, post illegal content, impersonate others, defraud the platform, or scrape our service.

## Termination
We may suspend or delete accounts that violate these Terms or our Community Guidelines.

## Liability
The platform is provided "as is". We are not liable for the conduct of third-party providers or customers, beyond the protections built into our escrow and dispute system.

## Governing Law
These Terms are governed by the laws of the Federal Republic of Nigeria.

## Contact
Email: legal@istylist.app
$$),
('community-guidelines', 'Community Guidelines',
$$# Community Guidelines

iStylist is a marketplace for beauty, fashion, and event service providers. To keep it safe and welcoming, every user must follow these guidelines.

## Be Respectful
No harassment, hate speech, threats, or discrimination based on race, religion, gender, sexuality, or disability.

## Be Honest
- Use real photos and accurate descriptions
- No fake profiles, impersonation, or misleading service claims
- Reviews must reflect your actual experience

## Keep It Safe
- No illegal content, weapons, drugs, or adult content
- No solicitation outside the platform
- Report suspicious behavior immediately

## Respect Bookings
- Honor confirmed appointments
- Communicate promptly through in-app chat
- Use the no-show reporting flow if a party fails to appear

## Consequences
Violations may result in content removal, account suspension, or permanent ban. We cooperate with law enforcement when required.

## Report
Use the Report button on any provider, post, review, or chat to flag a violation. Our moderation team reviews every report.
$$),
('refund-policy', 'Refund Policy',
$$# Refund Policy

## Booking Refunds
Funds for confirmed bookings are held in escrow until the appointment is completed or marked as a no-show.

- **Customer no-show**: provider keeps the booking amount (less platform fees).
- **Provider no-show**: full refund issued to the customer.
- **Disputed bookings**: held until our team reviews and adjudicates.

## Wallet Refunds
Top-up amounts that have not been spent can be refunded by contacting support. Processing time: 5-10 business days.

## Withdrawal Fees
Platform withdrawal fees are non-refundable once a payout has been approved and processed.

## How to Request a Refund
1. Open the booking or transaction in your wallet
2. Tap "Report Issue" or "Dispute"
3. Or email refunds@istylist.app with the transaction reference

## Chargebacks
Fraudulent chargebacks will result in account suspension and potential legal action.
$$)
ON CONFLICT (slug) DO NOTHING;

-- 2) Reports
CREATE TABLE IF NOT EXISTS reports (
    id                  BIGSERIAL PRIMARY KEY,
    reporter_auth_id    UUID NOT NULL,
    target_type         VARCHAR(32) NOT NULL
                            CHECK (target_type IN ('provider', 'customer', 'post', 'review', 'chat')),
    target_id           TEXT NOT NULL,
    reason              VARCHAR(48) NOT NULL,
    description         TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
    admin_notes         TEXT,
    resolved_by         UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_status      ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target      ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter    ON reports(reporter_auth_id);
CREATE INDEX IF NOT EXISTS idx_reports_created     ON reports(created_at DESC);

-- 3) Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id            BIGSERIAL PRIMARY KEY,
    user_auth_id  UUID,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL,
    category      VARCHAR(32) NOT NULL,
    subject       TEXT NOT NULL,
    message       TEXT NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'in_progress', 'resolved')),
    admin_notes   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_status  ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_created ON support_tickets(created_at DESC);

-- ============================================================================
-- Rollback:
--   DROP TABLE IF EXISTS legal_pages;
--   DROP TABLE IF EXISTS reports;
--   DROP TABLE IF EXISTS support_tickets;
-- ============================================================================
