"""
iStylist Service Catalog
Phase 1.2 - Complete Service Categories and Sub-Services
"""

SERVICE_CATALOG = {
    "beauty-grooming": {
        "id": "beauty-grooming",
        "name": "Beauty & Grooming",
        "icon": "✨",
        "color": "from-pink-500 to-rose-500",
        "services": {
            "barbers": {
                "id": "barbers",
                "name": "Barbers",
                "icon": "✂️",
                "sub_services": [
                    {"id": "haircut", "name": "Haircut", "default_duration": 30, "default_price": 2000},
                    {"id": "beard-trim", "name": "Beard Trim", "default_duration": 15, "default_price": 1000},
                    {"id": "hair-shave", "name": "Hair Shave", "default_duration": 20, "default_price": 1500},
                    {"id": "line-up-shape-up", "name": "Line Up / Shape Up", "default_duration": 15, "default_price": 1000},
                    {"id": "hair-coloring-highlights", "name": "Hair Coloring / Highlights", "default_duration": 60, "default_price": 5000},
                    {"id": "kids-haircut", "name": "Kids' Haircut", "default_duration": 20, "default_price": 1500},
                ]
            },
            "hair-braiders": {
                "id": "hair-braiders",
                "name": "Hair Braiders",
                "icon": "🧵",
                "sub_services": [
                    {"id": "box-braids", "name": "Box Braids", "default_duration": 240, "default_price": 15000},
                    {"id": "cornrows", "name": "Cornrows", "default_duration": 120, "default_price": 8000},
                    {"id": "twists", "name": "Twists", "default_duration": 180, "default_price": 12000},
                    {"id": "senegalese-twists", "name": "Senegalese Twists", "default_duration": 240, "default_price": 15000},
                    {"id": "feed-in-braids", "name": "Feed-in Braids", "default_duration": 180, "default_price": 12000},
                    {"id": "knotless-braids", "name": "Knotless Braids", "default_duration": 300, "default_price": 20000},
                ]
            },
            "dreadlocks": {
                "id": "dreadlocks",
                "name": "Dreadlocks",
                "icon": "🔒",
                "sub_services": [
                    {"id": "dreadlock-installation", "name": "Dreadlock Installation", "default_duration": 300, "default_price": 25000},
                    {"id": "dreadlock-maintenance", "name": "Dreadlock Maintenance / Retwist", "default_duration": 120, "default_price": 8000},
                    {"id": "dreadlock-removal", "name": "Dreadlock Removal", "default_duration": 180, "default_price": 15000},
                ]
            },
            "hairdressers": {
                "id": "hairdressers",
                "name": "Hairdressers",
                "icon": "💇",
                "sub_services": [
                    {"id": "hair-styling", "name": "Hair Styling", "default_duration": 60, "default_price": 5000},
                    {"id": "hair-coloring", "name": "Hair Coloring / Highlights", "default_duration": 90, "default_price": 8000},
                    {"id": "blowouts", "name": "Blowouts", "default_duration": 45, "default_price": 4000},
                    {"id": "hair-treatment", "name": "Hair Treatment / Deep Conditioning", "default_duration": 60, "default_price": 6000},
                ]
            },
            "wig-specialists": {
                "id": "wig-specialists",
                "name": "Wig Specialists",
                "icon": "👩",
                "sub_services": [
                    {"id": "wig-installation", "name": "Wig Installation", "default_duration": 60, "default_price": 10000},
                    {"id": "wig-styling", "name": "Wig Styling / Cutting", "default_duration": 45, "default_price": 5000},
                    {"id": "wig-maintenance", "name": "Wig Maintenance / Cleaning", "default_duration": 60, "default_price": 4000},
                ]
            },
            "makeup-artists": {
                "id": "makeup-artists",
                "name": "Makeup Artists",
                "icon": "💄",
                "sub_services": [
                    {"id": "bridal-makeup", "name": "Bridal Makeup", "default_duration": 120, "default_price": 30000},
                    {"id": "party-event-makeup", "name": "Party / Event Makeup", "default_duration": 60, "default_price": 15000},
                    {"id": "photoshoot-makeup", "name": "Photoshoot Makeup", "default_duration": 90, "default_price": 20000},
                    {"id": "natural-everyday-makeup", "name": "Natural / Everyday Makeup", "default_duration": 45, "default_price": 8000},
                ]
            },
            "nail-technicians": {
                "id": "nail-technicians",
                "name": "Nail Technicians",
                "icon": "💅",
                "sub_services": [
                    {"id": "manicure", "name": "Manicure", "default_duration": 45, "default_price": 3000},
                    {"id": "pedicure", "name": "Pedicure", "default_duration": 60, "default_price": 4000},
                    {"id": "gel-nails", "name": "Gel Nails", "default_duration": 75, "default_price": 8000},
                    {"id": "acrylic-nails", "name": "Acrylic Nails", "default_duration": 90, "default_price": 12000},
                    {"id": "nail-art", "name": "Nail Art", "default_duration": 30, "default_price": 2000},
                ]
            },
            "eyelash-technicians": {
                "id": "eyelash-technicians",
                "name": "Eyelash Technicians",
                "icon": "👁️",
                "sub_services": [
                    {"id": "lash-extensions", "name": "Lash Extensions", "default_duration": 90, "default_price": 15000},
                    {"id": "lash-lifts", "name": "Lash Lifts", "default_duration": 60, "default_price": 8000},
                    {"id": "brow-lamination", "name": "Brow Lamination", "default_duration": 45, "default_price": 6000},
                    {"id": "microblading", "name": "Microblading", "default_duration": 120, "default_price": 50000},
                    {"id": "microshading", "name": "Microshading", "default_duration": 120, "default_price": 45000},
                    {"id": "brow-tinting", "name": "Brow Tinting", "default_duration": 30, "default_price": 3000},
                ]
            },
            "facials": {
                "id": "facials",
                "name": "Facials (Estheticians)",
                "icon": "🧖",
                "sub_services": [
                    {"id": "basic-facial", "name": "Basic Facial", "default_duration": 45, "default_price": 5000},
                    {"id": "deep-cleansing-facial", "name": "Deep Cleansing Facial", "default_duration": 60, "default_price": 8000},
                    {"id": "anti-aging-facial", "name": "Anti-Aging Facial", "default_duration": 75, "default_price": 12000},
                    {"id": "acne-treatment", "name": "Acne Treatment", "default_duration": 60, "default_price": 10000},
                ]
            },
            "cosmetologists": {
                "id": "cosmetologists",
                "name": "Cosmetologists",
                "icon": "🌸",
                "sub_services": [
                    {"id": "skin-treatment", "name": "Skin Treatment / Care", "default_duration": 60, "default_price": 8000},
                    {"id": "body-treatments", "name": "Body Treatments", "default_duration": 90, "default_price": 15000},
                    {"id": "non-surgical-beauty", "name": "Non-surgical Beauty Procedures", "default_duration": 60, "default_price": 20000},
                ]
            },
        }
    },
    "body-aesthetics": {
        "id": "body-aesthetics",
        "name": "Body & Aesthetics",
        "icon": "💎",
        "color": "from-purple-500 to-indigo-500",
        "notice": "Verified & Regulated Providers Only",
        "services": {
            "non-surgical-body": {
                "id": "non-surgical-body",
                "name": "Non-Surgical Body Enhancement",
                "icon": "💉",
                "requires_verification": True,
                "sub_services": [
                    {"id": "lip-fillers", "name": "Lip Fillers", "default_duration": 60, "default_price": 80000},
                    {"id": "botox", "name": "Botox / Wrinkle Treatments", "default_duration": 45, "default_price": 100000},
                    {"id": "skin-tightening", "name": "Skin Tightening", "default_duration": 60, "default_price": 50000},
                    {"id": "fat-reduction", "name": "Fat Reduction (Non-surgical)", "default_duration": 90, "default_price": 150000},
                ]
            },
            "tattoo-artists": {
                "id": "tattoo-artists",
                "name": "Tattoo Artists",
                "icon": "🎨",
                "sub_services": [
                    {"id": "small-tattoos", "name": "Small / Minimalist Tattoos", "default_duration": 60, "default_price": 15000},
                    {"id": "large-tattoos", "name": "Large / Full Body Tattoos", "default_duration": 300, "default_price": 100000},
                    {"id": "custom-designs", "name": "Custom Designs", "default_duration": 180, "default_price": 50000},
                    {"id": "portrait-tattoos", "name": "Portrait Tattoos", "default_duration": 240, "default_price": 80000},
                    {"id": "coverup-tattoos", "name": "Cover-up Tattoos", "default_duration": 180, "default_price": 60000},
                    {"id": "black-grey-tattoos", "name": "Black & Grey Tattoos", "default_duration": 120, "default_price": 40000},
                    {"id": "color-tattoos", "name": "Color Tattoos", "default_duration": 150, "default_price": 50000},
                    {"id": "tattoo-touchups", "name": "Tattoo Touch ups", "default_duration": 60, "default_price": 20000},
                    {"id": "tattoo-removal", "name": "Tattoo Removal", "default_duration": 60, "default_price": 30000},
                ]
            },
            "body-piercing": {
                "id": "body-piercing",
                "name": "Body Piercing",
                "icon": "💎",
                "sub_services": [
                    {"id": "ear-piercing", "name": "Ear Piercing", "default_duration": 15, "default_price": 3000},
                    {"id": "nose-piercing", "name": "Nose Piercing", "default_duration": 15, "default_price": 5000},
                    {"id": "body-piercing", "name": "Body Piercing", "default_duration": 30, "default_price": 8000},
                ]
            },
            "medical-surgical": {
                "id": "medical-surgical",
                "name": "Medical / Surgical (Verified Only)",
                "icon": "🏥",
                "requires_verification": True,
                "sub_services": [
                    {"id": "teeth-whitening", "name": "Teeth Whitening", "default_duration": 60, "default_price": 50000},
                    {"id": "hair-transplant", "name": "Hair Transplant", "default_duration": 480, "default_price": 500000},
                    {"id": "cosmetic-surgery", "name": "Cosmetic Surgery", "default_duration": 240, "default_price": 1000000},
                ]
            },
        }
    },
    "wellness-care": {
        "id": "wellness-care",
        "name": "Wellness & Care",
        "icon": "🧘",
        "color": "from-green-500 to-teal-500",
        "services": {
            "spa-services": {
                "id": "spa-services",
                "name": "Spa Services",
                "icon": "🧖‍♀️",
                "sub_services": [
                    {"id": "full-body-massage", "name": "Full Body Massage", "default_duration": 90, "default_price": 15000},
                    {"id": "head-neck-massage", "name": "Head & Neck Massage", "default_duration": 30, "default_price": 5000},
                    {"id": "aromatherapy", "name": "Aromatherapy", "default_duration": 60, "default_price": 12000},
                    {"id": "massage-therapy", "name": "Massage Therapy", "default_duration": 60, "default_price": 10000},
                    {"id": "deep-tissue-massage", "name": "Deep Tissue Massage", "default_duration": 75, "default_price": 18000},
                    {"id": "sports-massage", "name": "Sports Massage", "default_duration": 60, "default_price": 15000},
                    {"id": "reflexology", "name": "Reflexology", "default_duration": 45, "default_price": 8000},
                ]
            },
            "body-therapy": {
                "id": "body-therapy",
                "name": "Body Therapy",
                "icon": "🌿",
                "sub_services": [
                    {"id": "body-scrubs", "name": "Body Scrubs / Exfoliation", "default_duration": 60, "default_price": 10000},
                    {"id": "body-wraps", "name": "Body Wraps", "default_duration": 75, "default_price": 15000},
                ]
            },
            "wellness-treatments": {
                "id": "wellness-treatments",
                "name": "Wellness Treatments",
                "icon": "🍃",
                "sub_services": [
                    {"id": "yoga", "name": "Yoga", "default_duration": 60, "default_price": 5000},
                    {"id": "meditation", "name": "Meditation", "default_duration": 45, "default_price": 4000},
                    {"id": "fitness-coaching", "name": "Fitness Coaching", "default_duration": 60, "default_price": 8000},
                ]
            },
        }
    },
    "fashion-bridal": {
        "id": "fashion-bridal",
        "name": "Fashion & Bridal",
        "icon": "👗",
        "color": "from-amber-500 to-orange-500",
        "services": {
            "fashion-designers": {
                "id": "fashion-designers",
                "name": "Fashion Designers",
                "icon": "🎨",
                "sub_services": [
                    {"id": "custom-clothing", "name": "Custom Clothing Design", "default_duration": 120, "default_price": 50000},
                    {"id": "outfit-styling", "name": "Outfit Styling", "default_duration": 90, "default_price": 20000},
                    {"id": "fittings-alterations", "name": "Fittings & Alterations", "default_duration": 60, "default_price": 10000},
                ]
            },
            "bridal-designers": {
                "id": "bridal-designers",
                "name": "Bridal Designers",
                "icon": "👰",
                "sub_services": [
                    {"id": "wedding-dress", "name": "Wedding Dress Design", "default_duration": 180, "default_price": 150000},
                    {"id": "bridal-accessories", "name": "Bridal Accessories", "default_duration": 60, "default_price": 30000},
                    {"id": "bridal-fittings", "name": "Fittings & Alterations", "default_duration": 90, "default_price": 20000},
                ]
            },
            "models": {
                "id": "models",
                "name": "Models",
                "icon": "🚶",
                "sub_services": [
                    {"id": "runway-modeling", "name": "Runway Modeling", "default_duration": 120, "default_price": 50000},
                    {"id": "photoshoot-modeling", "name": "Photoshoot Modeling", "default_duration": 180, "default_price": 40000},
                    {"id": "promotional-events", "name": "Promotional Events", "default_duration": 240, "default_price": 30000},
                ]
            },
        }
    },
    "events-entertainment": {
        "id": "events-entertainment",
        "name": "Events & Entertainment",
        "icon": "🎉",
        "color": "from-blue-500 to-cyan-500",
        "services": {
            "event-planners": {
                "id": "event-planners",
                "name": "Event Planners",
                "icon": "📋",
                "sub_services": [
                    {"id": "weddings", "name": "Weddings", "default_duration": 480, "default_price": 200000},
                    {"id": "birthday-parties", "name": "Birthday Parties", "default_duration": 240, "default_price": 50000},
                    {"id": "corporate-events", "name": "Corporate Events", "default_duration": 360, "default_price": 150000},
                ]
            },
            "mcs": {
                "id": "mcs",
                "name": "MCs",
                "icon": "🎤",
                "sub_services": [
                    {"id": "event-hosting", "name": "Event Hosting", "default_duration": 240, "default_price": 100000},
                    {"id": "public-speaking", "name": "Public Speaking", "default_duration": 60, "default_price": 50000},
                ]
            },
            "djs": {
                "id": "djs",
                "name": "DJs",
                "icon": "🎧",
                "sub_services": [
                    {"id": "music-mixing", "name": "Music Mixing / DJing", "default_duration": 300, "default_price": 80000},
                ]
            },
            "hype-men": {
                "id": "hype-men",
                "name": "Hype Men / Performers",
                "icon": "📢",
                "sub_services": [
                    {"id": "live-performances", "name": "Live Performances", "default_duration": 120, "default_price": 50000},
                    {"id": "crowd-engagement", "name": "Crowd Engagement", "default_duration": 180, "default_price": 40000},
                ]
            },
            "artists": {
                "id": "artists",
                "name": "Artists",
                "icon": "🎭",
                "sub_services": [
                    {"id": "singing-music", "name": "Singing / Music Performances", "default_duration": 120, "default_price": 100000},
                    {"id": "acting-theater", "name": "Acting / Theater", "default_duration": 180, "default_price": 80000},
                ]
            },
            "food-vendors": {
                "id": "food-vendors",
                "name": "Food Vendors",
                "icon": "🍽️",
                "sub_services": [
                    {"id": "catering", "name": "Catering", "default_duration": 300, "default_price": 100000},
                    {"id": "snacks-drinks", "name": "Snacks & Drinks", "default_duration": 180, "default_price": 30000},
                ]
            },
        }
    },
    "classes-learning": {
        "id": "classes-learning",
        "name": "Classes & Learning",
        "icon": "📚",
        "color": "from-violet-500 to-purple-500",
        "services": {
            "beauty-classes": {
                "id": "beauty-classes",
                "name": "Beauty Classes",
                "icon": "🎓",
                "sub_services": [
                    {"id": "makeup-training", "name": "Makeup Training", "default_duration": 240, "default_price": 50000},
                    {"id": "hair-styling-training", "name": "Hair Styling Training", "default_duration": 240, "default_price": 40000},
                    {"id": "nail-lash-training", "name": "Nail & Lash Training", "default_duration": 180, "default_price": 35000},
                    {"id": "tattoo-body-art-training", "name": "Tattoo & Body Art Training", "default_duration": 300, "default_price": 80000},
                ]
            },
            "wellness-training": {
                "id": "wellness-training",
                "name": "Wellness Training",
                "icon": "🧘",
                "sub_services": [
                    {"id": "massage-therapy-training", "name": "Massage Therapy Training", "default_duration": 240, "default_price": 60000},
                    {"id": "fitness-yoga-training", "name": "Fitness / Yoga Training", "default_duration": 180, "default_price": 30000},
                ]
            },
        }
    },
}


def get_all_categories():
    """Get list of all categories"""
    return [
        {
            "id": cat["id"],
            "name": cat["name"],
            "icon": cat["icon"],
            "color": cat["color"],
            "notice": cat.get("notice"),
            "service_count": len(cat["services"])
        }
        for cat in SERVICE_CATALOG.values()
    ]


def get_category(category_id):
    """Get a specific category with its services"""
    return SERVICE_CATALOG.get(category_id)


def get_all_services():
    """Get flat list of all services (parent-level)"""
    services = []
    for cat in SERVICE_CATALOG.values():
        for svc in cat["services"].values():
            services.append({
                "id": svc["id"],
                "name": svc["name"],
                "icon": svc["icon"],
                "category_id": cat["id"],
                "category_name": cat["name"],
                "requires_verification": svc.get("requires_verification", False),
                "sub_service_count": len(svc["sub_services"])
            })
    return services


def get_service(service_id):
    """Get a specific service with sub-services"""
    for cat in SERVICE_CATALOG.values():
        if service_id in cat["services"]:
            svc = cat["services"][service_id]
            return {
                **svc,
                "category_id": cat["id"],
                "category_name": cat["name"]
            }
    return None


def get_all_sub_services():
    """Get flat list of all sub-services"""
    sub_services = []
    for cat in SERVICE_CATALOG.values():
        for svc in cat["services"].values():
            for sub in svc["sub_services"]:
                sub_services.append({
                    **sub,
                    "service_id": svc["id"],
                    "service_name": svc["name"],
                    "category_id": cat["id"],
                    "category_name": cat["name"],
                    "requires_verification": svc.get("requires_verification", False)
                })
    return sub_services


def get_sub_services_by_service(service_id):
    """Get all sub-services for a specific service"""
    svc = get_service(service_id)
    if svc:
        return svc.get("sub_services", [])
    return []
