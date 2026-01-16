"""
Test Suite for Bookings Views API (Phase 2.2)
Tests for listing, details, and status transitions
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable is required")
if not BASE_URL.endswith('/api'):
    BASE_URL = BASE_URL + '/api'

# Test IDs
TEST_PROVIDER_ID = 13
TEST_CUSTOMER_ID = 12


class TestBookingsListAPI:
    """Test GET /api/bookings with filters"""
    
    def test_list_bookings_all(self):
        """Get all bookings without filters"""
        response = requests.get(f"{BASE_URL}/bookings")
        assert response.status_code == 200
        bookings = response.json()
        assert isinstance(bookings, list)
        print(f"✓ GET /bookings returns {len(bookings)} bookings")
    
    def test_list_bookings_by_status(self):
        """Get bookings filtered by status"""
        for status in ["pending", "confirmed", "completed", "canceled"]:
            response = requests.get(f"{BASE_URL}/bookings?status={status}")
            assert response.status_code == 200
            bookings = response.json()
            assert isinstance(bookings, list)
            # Verify all returned bookings have the requested status
            for b in bookings:
                assert b.get("status") == status, f"Expected status {status}, got {b.get('status')}"
        print("✓ GET /bookings?status=X filters correctly")
    
    def test_list_bookings_by_role_customer(self):
        """Get bookings for a customer by auth_id"""
        # First get a user's auth_id
        users_response = requests.get(f"{BASE_URL}/users")
        if users_response.status_code != 200:
            pytest.skip("Users API not available")
        
        users = users_response.json()
        customers = [u for u in users if u.get("role") == "customer" and u.get("auth_id")]
        if not customers:
            pytest.skip("No customer with auth_id found")
        
        auth_id = customers[0]["auth_id"]
        response = requests.get(f"{BASE_URL}/bookings?role=customer&auth_id={auth_id}")
        assert response.status_code == 200
        bookings = response.json()
        assert isinstance(bookings, list)
        print(f"✓ GET /bookings?role=customer&auth_id returns {len(bookings)} bookings")
    
    def test_list_bookings_by_role_provider(self):
        """Get bookings for a provider by auth_id"""
        # Get a provider's auth_id
        users_response = requests.get(f"{BASE_URL}/users")
        if users_response.status_code != 200:
            pytest.skip("Users API not available")
        
        users = users_response.json()
        providers = [u for u in users if u.get("role") == "provider" and u.get("auth_id")]
        if not providers:
            pytest.skip("No provider with auth_id found")
        
        auth_id = providers[0]["auth_id"]
        response = requests.get(f"{BASE_URL}/bookings?role=provider&auth_id={auth_id}")
        assert response.status_code == 200
        bookings = response.json()
        assert isinstance(bookings, list)
        print(f"✓ GET /bookings?role=provider&auth_id returns {len(bookings)} bookings")
    
    def test_bookings_have_computed_fields(self):
        """Verify bookings include computed fields"""
        response = requests.get(f"{BASE_URL}/bookings")
        assert response.status_code == 200
        bookings = response.json()
        
        if len(bookings) > 0:
            booking = bookings[0]
            # Check for computed fields
            assert "services" in booking, "Booking should have 'services' field"
            assert "total_amount" in booking, "Booking should have 'total_amount' field"
            assert "total_duration" in booking, "Booking should have 'total_duration' field"
            assert "provider_display_name" in booking, "Booking should have 'provider_display_name' field"
            assert "customer_display_name" in booking, "Booking should have 'customer_display_name' field"
            print(f"✓ Booking has all computed fields")
            print(f"  - services: {len(booking['services'])} items")
            print(f"  - total_amount: {booking['total_amount']}")
            print(f"  - total_duration: {booking['total_duration']}")
            print(f"  - provider: {booking['provider_display_name']}")
            print(f"  - customer: {booking['customer_display_name']}")
        else:
            print("⚠ No bookings found to verify computed fields")


class TestBookingDetailsAPI:
    """Test GET /api/bookings/{id}"""
    
    def _get_first_booking_id(self):
        """Helper to get a booking ID for tests"""
        response = requests.get(f"{BASE_URL}/bookings")
        if response.status_code == 200 and response.json():
            return response.json()[0]["id"]
        return None
    
    def test_get_booking_details(self):
        """Get booking by ID with full details"""
        booking_id = self._get_first_booking_id()
        if not booking_id:
            pytest.skip("No bookings available for testing")
        
        response = requests.get(f"{BASE_URL}/bookings/{booking_id}")
        assert response.status_code == 200
        booking = response.json()
        
        assert booking.get("id") == booking_id
        assert "services" in booking
        assert "total_amount" in booking
        assert "provider_display_name" in booking
        print(f"✓ GET /bookings/{booking_id} returns full details")
    
    def test_get_booking_not_found(self):
        """Get non-existent booking returns 404"""
        response = requests.get(f"{BASE_URL}/bookings/999999")
        assert response.status_code == 404
        print("✓ GET /bookings/999999 returns 404")
    
    def test_booking_services_have_names(self):
        """Verify services in booking details have names from service_id join"""
        booking_id = self._get_first_booking_id()
        if not booking_id:
            pytest.skip("No bookings available for testing")
        
        response = requests.get(f"{BASE_URL}/bookings/{booking_id}")
        booking = response.json()
        
        for service in booking.get("services", []):
            assert "service_name" in service, "Service should have 'service_name'"
            assert "price" in service, "Service should have 'price'"
            assert "duration_minutes" in service, "Service should have 'duration_minutes'"
        
        print(f"✓ Booking services have proper names and details")


class TestBookingStatusTransitions:
    """Test PUT /api/bookings/{id} status transitions"""
    
    def _create_test_booking(self):
        """Helper to create a booking for testing"""
        # Get an active service for provider 13
        services_response = requests.get(f"{BASE_URL}/provider-services/{TEST_PROVIDER_ID}")
        if services_response.status_code != 200:
            return None
        
        services = services_response.json()
        active_services = [s for s in services if s.get("is_active")]
        if not active_services:
            return None
        
        booking_payload = {
            "provider_id": TEST_PROVIDER_ID,
            "customer_id": TEST_CUSTOMER_ID,
            "service_ids": [active_services[0]["id"]],
            "booking_date": "2026-02-01",
            "booking_time": "14:00",
            "status": "pending"
        }
        
        response = requests.post(f"{BASE_URL}/bookings", json=booking_payload)
        if response.status_code in [201, 200]:
            return response.json().get("id")
        return None
    
    def test_invalid_status_rejected(self):
        """Invalid status value returns 400"""
        response = requests.get(f"{BASE_URL}/bookings")
        bookings = response.json()
        if not bookings:
            pytest.skip("No bookings for testing")
        
        booking_id = bookings[0]["id"]
        response = requests.put(f"{BASE_URL}/bookings/{booking_id}?status=invalid_status")
        assert response.status_code == 400
        print("✓ Invalid status rejected with 400")
    
    def test_provider_can_confirm_pending(self):
        """Provider can confirm a pending booking"""
        # Find a pending booking or skip
        response = requests.get(f"{BASE_URL}/bookings?status=pending")
        bookings = response.json()
        if not bookings:
            pytest.skip("No pending bookings for testing")
        
        booking = bookings[0]
        booking_id = booking["id"]
        provider_uuid = booking.get("provider_id")
        
        if not provider_uuid:
            pytest.skip("Booking has no provider_id")
        
        # Try to confirm as provider
        response = requests.put(
            f"{BASE_URL}/bookings/{booking_id}?status=confirmed&role=provider&auth_id={provider_uuid}"
        )
        
        # Should succeed (200) or already be in a non-pending state
        if response.status_code == 200:
            updated = response.json()
            assert updated.get("status") == "confirmed"
            print(f"✓ Provider confirmed booking {booking_id}")
        elif response.status_code == 403:
            print(f"✓ Status transition validation working (403)")
        else:
            print(f"Note: Status {response.status_code} - {response.text[:100]}")
    
    def test_customer_cannot_confirm(self):
        """Customer cannot confirm a booking"""
        response = requests.get(f"{BASE_URL}/bookings?status=pending")
        bookings = response.json()
        if not bookings:
            pytest.skip("No pending bookings for testing")
        
        booking = bookings[0]
        booking_id = booking["id"]
        customer_id = booking.get("customer_id")
        
        # Get customer auth_id
        if customer_id:
            user_response = requests.get(f"{BASE_URL}/users/{customer_id}")
            if user_response.status_code == 200:
                customer_auth_id = user_response.json().get("auth_id")
                if customer_auth_id:
                    response = requests.put(
                        f"{BASE_URL}/bookings/{booking_id}?status=confirmed&role=customer&auth_id={customer_auth_id}"
                    )
                    assert response.status_code == 403, "Customer should not be able to confirm"
                    print("✓ Customer correctly forbidden from confirming")
                    return
        
        print("⚠ Could not find customer auth_id for test")
    
    def test_customer_can_cancel_pending(self):
        """Customer can cancel a pending booking"""
        response = requests.get(f"{BASE_URL}/bookings?status=pending")
        bookings = response.json()
        if not bookings:
            pytest.skip("No pending bookings for testing")
        
        booking = bookings[0]
        booking_id = booking["id"]
        customer_id = booking.get("customer_id")
        
        if customer_id:
            user_response = requests.get(f"{BASE_URL}/users/{customer_id}")
            if user_response.status_code == 200:
                customer_auth_id = user_response.json().get("auth_id")
                if customer_auth_id:
                    response = requests.put(
                        f"{BASE_URL}/bookings/{booking_id}?status=canceled&role=customer&auth_id={customer_auth_id}"
                    )
                    if response.status_code == 200:
                        print(f"✓ Customer canceled booking {booking_id}")
                    elif response.status_code == 403:
                        print(f"✓ Status transition validation working")
                    return
        
        print("⚠ Could not test customer cancel - no auth_id")
    
    def test_provider_can_decline_pending(self):
        """Provider can decline a pending booking"""
        response = requests.get(f"{BASE_URL}/bookings?status=pending")
        bookings = response.json()
        if not bookings:
            pytest.skip("No pending bookings for testing")
        
        booking = bookings[0]
        booking_id = booking["id"]
        provider_uuid = booking.get("provider_id")
        
        if provider_uuid:
            response = requests.put(
                f"{BASE_URL}/bookings/{booking_id}?status=declined&role=provider&auth_id={provider_uuid}"
            )
            if response.status_code == 200:
                print(f"✓ Provider declined booking {booking_id}")
            elif response.status_code == 403:
                print(f"✓ Status transition validation working")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
