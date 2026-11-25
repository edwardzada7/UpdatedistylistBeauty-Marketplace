"""
Platform gating: block sharing of phone numbers, emails, social handles and external links in user text.

Server-side so it cannot be bypassed by the web app, an old mobile build or a direct API call.
Returns the kind of violation (or None). Word-boundary matching keeps normal beauty words
(wig, big, design, signature, braids...) from being blocked.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

CONTACT_POLICY_MESSAGE = (
    "Message not sent. Sharing phone numbers, emails, social media handles or links is not allowed on iStylist. "
    "Keep your booking, chat and payment inside the app so you stay protected by escrow, reviews and support."
)

_ZERO_WIDTH = dict.fromkeys(map(ord, "​‌‍⁠﻿­"), None)

_NUMBER_WORDS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "oh": "0",
}
_WORD_RE = re.compile(r"\b(" + "|".join(_NUMBER_WORDS) + r")\b")

# 10+ digits possibly separated by spaces, dashes, dots, brackets or slashes
_DIGIT_RUN = re.compile(r"(?:\+?\d[\s\-._()/]{0,2}){10,}")
_NG_MOBILE = re.compile(r"^(?:\+?234|0)?[789][01]\d{8}$")
_INTL = re.compile(r"^\+\d{10,15}$")

_EMAIL = re.compile(
    r"[a-z0-9._%+\-]+\s*(?:@|\(\s*at\s*\)|\[\s*at\s*\]|\{\s*at\s*\})\s*[a-z0-9\-]+\s*(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)\s*[a-z]{2,}"
)
_EMAIL_WORDS = re.compile(r"\b(?:gmail|yahoo|hotmail|outlook|icloud|protonmail)\b\s*(?:\.|dot)?\s*(?:com|ng|net)\b")

_SOCIAL = re.compile(
    r"\b(?:instagram|insta|whatsapp|whatsap|whats\s?app|snapchat|snap\s?chat|tiktok|tik\s?tok|twitter|telegram|facebook|"
    r"call\s+me|text\s+me|dm\s+me|add\s+me|ping\s+me|contact\s+me|my\s+(?:number|digits|handle|insta|ig|snap|whatsapp|telegram))\b"
)
_HANDLE = re.compile(r"(?<![\w@])@[a-z0-9_.]{3,}")
_LINK = re.compile(r"(?:https?://|www\.|wa\.me/|t\.me/|\b[a-z0-9\-]+\.(?:com|ng|me|co|io|net|org|ly|gl)\b)")
_ALLOWED_LINK = re.compile(r"istylist\.online")


def find_contact_violation(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    t = unicodedata.normalize("NFKC", str(text)).translate(_ZERO_WIDTH).lower()

    if _EMAIL.search(t) or _EMAIL_WORDS.search(t):
        return "email"
    if _SOCIAL.search(t) or _HANDLE.search(t):
        return "social"
    for m in _LINK.finditer(t):
        # allow our own domain only
        window = t[max(0, m.start() - 12): m.end() + 20]
        if not _ALLOWED_LINK.search(window):
            return "link"

    spelled = _WORD_RE.sub(lambda m: _NUMBER_WORDS[m.group(1)], t)
    for source in (t, spelled):
        # spelled-out digits are separated by spaces; the digit-run regex handles that
        for m in _DIGIT_RUN.finditer(source):
            run = m.group(0)
            digits = re.sub(r"\D", "", run)
            compact = ("+" if run.strip().startswith("+") else "") + digits
            if 10 <= len(digits) <= 15 and (_NG_MOBILE.match(digits) or _NG_MOBILE.match(compact) or _INTL.match(compact)):
                return "phone"
    return None


def enforce_no_contact_sharing(text: Optional[str]) -> None:
    kind = find_contact_violation(text)
    if kind:
        import logging
        from fastapi import HTTPException
        logging.info(f"[contact_guard] blocked a message containing {kind}")
        raise HTTPException(status_code=422, detail=CONTACT_POLICY_MESSAGE)
