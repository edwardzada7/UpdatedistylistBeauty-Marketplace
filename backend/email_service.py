"""Minimal transactional email sender (guest event tickets).

Configure ONE of:
  - Resend:  RESEND_API_KEY  (+ EMAIL_FROM, e.g. "iStylist <tickets@istylist.online>", on a verified domain)
  - SMTP:    SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD (+ EMAIL_FROM)
If neither is set, sending is skipped and `email_configured()` is False.
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage

import requests

logger = logging.getLogger(__name__)


def email_configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY") or os.environ.get("SMTP_HOST"))


def send_email(to: str, subject: str, html: str, text: str) -> bool:
    """Returns True if the provider accepted the message."""
    sender = os.environ.get("EMAIL_FROM") or "iStylist <no-reply@istylist.online>"
    try:
        api_key = os.environ.get("RESEND_API_KEY")
        if api_key:
            res = requests.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"from": sender, "to": [to], "subject": subject, "html": html, "text": text},
                timeout=15,
            )
            if res.status_code >= 300:
                logger.warning("Resend rejected email to %s: %s %s", to, res.status_code, res.text[:200])
                return False
            return True
        host = os.environ.get("SMTP_HOST")
        if host:
            msg = EmailMessage()
            msg["From"], msg["To"], msg["Subject"] = sender, to, subject
            msg.set_content(text)
            msg.add_alternative(html, subtype="html")
            with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587")), timeout=15) as smtp:
                smtp.starttls()
                if os.environ.get("SMTP_USER"):
                    smtp.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
                smtp.send_message(msg)
            return True
    except Exception as exc:  # noqa: BLE001 - never break checkout over email
        logger.warning("Email to %s failed: %s", to, exc)
    return False
