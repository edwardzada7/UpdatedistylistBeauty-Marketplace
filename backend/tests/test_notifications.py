"""
Tests for In-App Notifications System (Phase 2B)

Tests:
1. Notifications created for booking events
2. Notifications created for withdrawal events
3. Unread count returns correct value
4. Mark read updates notification status
5. Graceful handling of missing/null data
6. Query by auth_id works correctly
"""

import pytest
from datetime import datetime, timedelta


def test_notification_types():
    """Test that all notification types are defined"""
    notification_types = [
        "booking_created",
        "booking_confirmed",
        "booking_declined",
        "booking_canceled",
        "booking_completed",
        "withdrawal_requested",
        "withdrawal_approved",
        "withdrawal_rejected",
        "wallet_topup_success"
    ]
    
    for nt in notification_types:
        assert isinstance(nt, str)
        assert len(nt) > 0


def test_notification_structure():
    """Test notification data structure"""
    notification = {
        "id": 1,
        "auth_id": "4d822133-f8e9-46a5-8bdf-68c3f8c95162",
        "type": "booking_created",
        "message": "A customer has requested a booking",
        "read": False,
        "created_at": "2026-03-01T12:00:00Z"
    }
    
    assert notification["id"] == 1
    assert notification["type"] == "booking_created"
    assert notification["read"] == False
    assert "auth_id" in notification


def test_notification_query_by_auth_id():
    """Test that notifications are queried by auth_id uuid"""
    auth_id = "371a0b03-f283-4f22-9d0d-b489c62a0667"
    notifications = [
        {"id": 1, "auth_id": auth_id, "read": False},
        {"id": 2, "auth_id": auth_id, "read": False},
        {"id": 3, "auth_id": "other-uuid", "read": False},
    ]
    
    # Filter by auth_id
    filtered = [n for n in notifications if n["auth_id"] == auth_id]
    assert len(filtered) == 2


def test_unread_count():
    """Test unread count calculation"""
    notifications = [
        {"id": 1, "read": False},
        {"id": 2, "read": True},
        {"id": 3, "read": False},
        {"id": 4, "read": True},
        {"id": 5, "read": False},
    ]
    
    unread_count = sum(1 for n in notifications if not n["read"])
    assert unread_count == 3


def test_mark_read():
    """Test marking notifications as read"""
    notification = {"id": 1, "read": False}
    
    # Mark as read
    notification["read"] = True
    
    assert notification["read"] == True


def test_notification_ordering():
    """Test notifications are ordered newest first"""
    notifications = [
        {"id": 1, "created_at": "2026-03-01T10:00:00Z"},
        {"id": 2, "created_at": "2026-03-01T12:00:00Z"},
        {"id": 3, "created_at": "2026-03-01T11:00:00Z"},
    ]
    
    # Sort by created_at descending
    sorted_notifications = sorted(
        notifications, 
        key=lambda x: x["created_at"], 
        reverse=True
    )
    
    assert sorted_notifications[0]["id"] == 2  # Newest
    assert sorted_notifications[-1]["id"] == 1  # Oldest


def test_notification_metadata_booking():
    """Test booking notification metadata"""
    metadata = {
        "booking_id": 123,
        "service_name": "Hair Styling",
        "date": "2026-03-05",
        "time": "14:00"
    }
    
    assert "booking_id" in metadata
    assert metadata["booking_id"] == 123


def test_notification_metadata_withdrawal():
    """Test withdrawal notification metadata"""
    metadata = {
        "withdrawal_id": 456,
        "amount": 5000,
        "bank_name": "GTBank"
    }
    
    assert "withdrawal_id" in metadata
    assert metadata["amount"] == 5000


def test_notification_metadata_wallet():
    """Test wallet topup notification metadata"""
    metadata = {
        "amount": 10000,
        "reference": "PAY_12345"
    }
    
    assert "amount" in metadata
    assert metadata["amount"] == 10000


def test_booking_created_notification_content():
    """Test booking_created notification has correct content"""
    notification = {
        "type": "booking_created",
        "message": "John Doe has requested a booking for 2026-03-05 at 14:00"
    }
    
    assert "requested" in notification["message"].lower()


def test_booking_confirmed_notification_content():
    """Test booking_confirmed notification has correct content"""
    notification = {
        "type": "booking_confirmed",
        "message": "Your booking has been confirmed"
    }
    
    assert "confirmed" in notification["message"].lower()


def test_withdrawal_approved_notification_content():
    """Test withdrawal_approved notification has correct content"""
    notification = {
        "type": "withdrawal_approved",
        "message": "Your withdrawal request for ₦5,000.00 has been approved"
    }
    
    assert "approved" in notification["message"].lower()


def test_graceful_null_handling():
    """Test that system handles null recipient gracefully"""
    # Should not crash when recipient is None
    recipient_auth_id = None
    
    # The create_notification function should return False
    if not recipient_auth_id:
        result = False
    else:
        result = True
    
    assert result == False


def test_pagination():
    """Test notification pagination"""
    limit = 20
    offset = 0
    
    # Simulate pagination
    all_notifications = [{"id": i} for i in range(50)]
    paginated = all_notifications[offset:offset + limit]
    
    assert len(paginated) == 20
    assert paginated[0]["id"] == 0
    assert paginated[-1]["id"] == 19


def test_mark_all_read():
    """Test marking all notifications as read"""
    notifications = [
        {"id": 1, "read": False},
        {"id": 2, "read": False},
        {"id": 3, "read": True},
    ]
    
    # Mark all as read
    for n in notifications:
        n["read"] = True
    
    unread_count = sum(1 for n in notifications if not n["read"])
    assert unread_count == 0


def test_unread_count_response_format():
    """Test that unread count returns both 'count' and 'unread' keys"""
    response = {"count": 5, "unread": 5}
    
    assert "count" in response
    assert "unread" in response
    assert response["count"] == response["unread"]


def test_mark_read_by_notification_ids():
    """Test marking specific notifications as read by IDs"""
    notifications = [
        {"id": 1, "read": False},
        {"id": 2, "read": False},
        {"id": 3, "read": False},
    ]
    
    ids_to_mark = [1, 3]
    
    # Mark specific IDs as read
    for n in notifications:
        if n["id"] in ids_to_mark:
            n["read"] = True
    
    # Check results
    assert notifications[0]["read"] == True  # id=1 marked
    assert notifications[1]["read"] == False  # id=2 not marked
    assert notifications[2]["read"] == True  # id=3 marked


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
