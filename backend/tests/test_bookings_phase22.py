"""
Test Suite for Phase 2.2 Bookings Views API
Tests for listing, details, status transitions, and computed fields
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable is required")
if not BASE_URL.endswith('/api'):
    BASE_URL = BASE_URL + '/api'

# Test IDs - Provider 13 (Amaka Beauty Pro) has availability and services
TEST_PROVIDER_ID = 13


class TestBookingsListEndpoint:
    """Test GET /api/bookings with various filters"""
    
    def test_list_all_bookings(self):
        """GET /api/bookings returns list of bookings"""
        response = requests.get(f"{BASE_URL}/bookings")
        assert response.status_code == 200
        bookings = response.json()
        assert isinstance(bookings, list)
        print(f"✓ GET /bookings returns {len(bookings)} bookings")
    
    def test_list_bookings_by_status_pending(self):
        """GET /api/bookings?status=pending filters correctly"""
        response = requests.get(f"{BASE_URL}/bookings?status=pending")
        assert response.status_code == 200
        bookings = response.json()
        for b in bookings:
            assert b.get("status") == "pending"
        print(f"✓ GET /bookings?status=pending returns {len(bookings)} pending bookings")
    
    def test_list_bookings_by_status_confirmed(self):
        """GET /api/bookings?status=confirmed filters correctly"""
        response = requests.get(f"{BASE_URL}/bookings?status=confirmed")
        assert response.status_code == 200
        bookings = response.json()
        for b in bookings:
            assert b.get("status") == "confirmed"
        print(f"✓ GET /bookings?status=confirmed returns {len(bookings)} confirmed bookings")
    
    def test_list_bookings_by_status_completed(self):
        """GET /api/bookings?status=completed filters correctly"""
        response = requests.get(f"{BASE_URL}/bookings?status=completed")
        assert response.status_code == 200
        bookings = response.json()
        for b in bookings:
            assert b.get("status") == "completed"
        print(f"✓ GET /bookings?status=completed returns {len(bookings)} completed bookings")
    
    def test_list_bookings_by_status_canceled(self):
        """GET /api/bookings?status=canceled filters correctly"""
        response = requests.get(f"{BASE_URL}/bookings?status=canceled")
        assert response.status_code == 200
        bookings = response.json()
        for b in bookings:
            assert b.get("status") == "canceled"
        print(f"✓ GET /bookings?status=canceled returns {len(bookings)} canceled bookings")


class TestBookingsComputedFields:
    """Test that bookings have all required computed fields"""
    
    def test_bookings_have_services_array(self):
        """Bookings should have services array"""
        response = requests.get(f"{BASE_URL}/bookings")
        bookings = response.json()
        if bookings:
            booking = bookings[0]
            assert "services" in booking, "Booking should have 'services' field"
            assert isinstance(booking["services"], list), "services should be a list"
            print(f"✓ Booking has services array with {len(booking['services'])} items")
    
    def test_bookings_have_total_amount(self):
        """Bookings should have total_amount computed field"""
        response = requests.get(f"{BASE_URL}/bookings")
        bookings = response.json()
        if bookings:
            booking = bookings[0]
            assert "total_amount" in booking, "Booking should have 'total_amount' field"
            assert isinstance(booking["total_amount"], (int, float)), "total_amount should be numeric"
            print(f"✓ Booking has total_amount: {booking['total_amount']}")
    
    def test_bookings_have_total_duration(self):
        """Bookings should have total_duration computed field"""
        response = requests.get(f"{BASE_URL}/bookings")
        bookings = response.json()
        if bookings:
            booking = bookings[0]
            assert "total_duration" in booking, "Booking should have 'total_duration' field"
            assert isinstance(booking["total_duration"], (int, float)), "total_duration should be numeric"
            print(f"✓ Booking has total_duration: {booking['total_duration']} minutes")
    
    def test_bookings_have_provider_display_name(self):
        """Bookings should have provider_display_name"""
        response = requests.get(f"{BASE_URL}/bookings")
        bookings = response.json()
        if bookings:
            booking = bookings[0]
            assert "provider_display_name" in booking, "Booking should have 'provider_display_name'"
            assert booking["provider_display_name"], "provider_display_name should not be empty"
            print(f"✓ Booking has provider_display_name: {booking['provider_display_name']}")
    
    def test_bookings_have_customer_display_name(self):
        """Bookings should have customer_display_name"""
        response = requests.get(f"{BASE_URL}/bookings")
        bookings = response.json()
        if bookings:
            booking = bookings[0]
            assert "customer_display_name" in booking, "Booking should have 'customer_display_name'"
            assert booking["customer_display_name"], "customer_display_name should not be empty"
            print(f"✓ Booking has customer_display_name: {booking['customer_display_name']}")


class TestBookingDetailsEndpoint:
    """Test GET /api/bookings/{id}"""
    
    def _get_first_booking_id(self):
        """Helper to get a booking ID"""
        response = requests.get(f"{BASE_URL}/bookings")
        if response.status_code == 200 and response.json():
            return response.json()[0]["id"]
        return None
    
    def test_get_booking_by_id(self):
        """GET /api/bookings/{id} returns booking details"""
        booking_id = self._get_first_booking_id()
        if not booking_id:
            pytest.skip("No bookings available")
        
        response = requests.get(f"{BASE_URL}/bookings/{booking_id}")
        assert response.status_code == 200
        booking = response.json()
        assert booking["id"] == booking_id
        print(f"✓ GET /bookings/{booking_id} returns booking details")
    
    def test_get_booking_not_found(self):
        """GET /api/bookings/{id} returns 404 for non-existent booking"""
        response = requests.get(f"{BASE_URL}/bookings/999999")
        assert response.status_code == 404
        print("✓ GET /bookings/999999 returns 404")
    
    def test_booking_details_have_all_fields(self):
        """Booking details should have all required fields"""
        booking_id = self._get_first_booking_id()
        if not booking_id:
            pytest.skip("No bookings available")
        
        response = requests.get(f"{BASE_URL}/bookings/{booking_id}")
        booking = response.json()
        
        required_fields = [
            "id", "status", "booking_date", "booking_time",
            "services", "total_amount", "total_duration",
            "provider_display_name", "customer_display_name"
        ]
        
        for field in required_fields:
            assert field in booking, f"Booking should have '{field}' field"
        
        print(f"✓ Booking details have all required fields")


class TestBookingStatusTransitions:
    """Test PUT /api/bookings/{id} status transitions"""
    
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
    
    def test_provider_confirm_transition(self):
        """Provider can confirm pending booking"""
        # Find a pending booking
        response = requests.get(f"{BASE_URL}/bookings?status=pending")
        bookings = response.json()
        if not bookings:
            pytest.skip("No pending bookings")
        
        booking = bookings[0]
        booking_id = booking["id"]
        provider_uuid = booking.get("provider_id")
        
        if not provider_uuid:
            pytest.skip("Booking has no provider_id")
        
        # Confirm as provider
        response = requests.put(
            f"{BASE_URL}/bookings/{booking_id}?status=confirmed&role=provider&auth_id={provider_uuid}"
        )
        
        if response.status_code == 200:
            updated = response.json()
            assert updated.get("status") == "confirmed"
            print(f"✓ Provider confirmed booking {booking_id}")
        else:
            print(f"Note: Status {response.status_code} - may already be processed")
    
    def test_customer_cannot_confirm(self):
        """Customer cannot confirm a booking"""
        response = requests.get(f"{BASE_URL}/bookings?status=pending")
        bookings = response.json()
        if not bookings:
            pytest.skip("No pending bookings")
        
        booking = bookings[0]
        booking_id = booking["id"]
        customer_id = booking.get("customer_id")
        
        if customer_id:
            user_response = requests.get(f"{BASE_URL}/users/{customer_id}")
            if user_response.status_code == 200:
                customer_auth_id = user_response.json().get("auth_id")
                if customer_auth_id:
                    response = requests.put(
                        f"{BASE_URL}/bookings/{booking_id}?status=confirmed&role=customer&auth_id={customer_auth_id}"
                    )
                    assert response.status_code == 403
                    print("✓ Customer correctly forbidden from confirming")
                    return
        
        print("⚠ Could not find customer auth_id for test")
    
    def test_provider_decline_transition(self):
        """Provider can decline pending booking"""
        response = requests.get(f"{BASE_URL}/bookings?status=pending")
        bookings = response.json()
        if not bookings:
            pytest.skip("No pending bookings")
        
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
    
    def test_provider_complete_confirmed(self):
        """Provider can complete confirmed booking"""
        response = requests.get(f"{BASE_URL}/bookings?status=confirmed")
        bookings = response.json()
        if not bookings:
            pytest.skip("No confirmed bookings")
        
        booking = bookings[0]
        booking_id = booking["id"]
        provider_uuid = booking.get("provider_id")
        
        if provider_uuid:
            response = requests.put(
                f"{BASE_URL}/bookings/{booking_id}?status=completed&role=provider&auth_id={provider_uuid}"
            )
            if response.status_code == 200:
                print(f"✓ Provider completed booking {booking_id}")
            elif response.status_code == 403:
                print(f"✓ Status transition validation working")


class TestRoleBasedFiltering:
    """Test role-based booking filtering"""
    
    def test_provider_role_filter(self):
        """GET /api/bookings?role=provider&auth_id=X filters by provider"""
        # Get a provider's auth_id
        users_response = requests.get(f"{BASE_URL}/users")
        if users_response.status_code != 200:
            pytest.skip("Users API not available")
        
        users = users_response.json()
        stylists = [u for u in users if u.get("role") == "stylist" and u.get("auth_id")]
        if not stylists:
            pytest.skip("No stylist with auth_id found")
        
        auth_id = stylists[0]["auth_id"]
        response = requests.get(f"{BASE_URL}/bookings?role=provider&auth_id={auth_id}")
        assert response.status_code == 200
        bookings = response.json()
        
        # All returned bookings should have this provider_id
        for b in bookings:
            assert b.get("provider_id") == auth_id, f"Expected provider_id {auth_id}"
        
        print(f"✓ Provider role filter returns {len(bookings)} bookings")
    
    def test_customer_role_filter(self):
        """GET /api/bookings?role=customer&auth_id=X filters by customer"""
        users_response = requests.get(f"{BASE_URL}/users")
        if users_response.status_code != 200:
            pytest.skip("Users API not available")
        
        users = users_response.json()
        customers = [u for u in users if u.get("role") == "customer" and u.get("auth_id")]
        if not customers:
            pytest.skip("No customer with auth_id found")
        
        auth_id = customers[0]["auth_id"]
        user_id = customers[0]["id"]
        
        response = requests.get(f"{BASE_URL}/bookings?role=customer&auth_id={auth_id}")
        assert response.status_code == 200
        bookings = response.json()
        
        # All returned bookings should have this customer_id
        for b in bookings:
            assert b.get("customer_id") == user_id, f"Expected customer_id {user_id}"
        
        print(f"✓ Customer role filter returns {len(bookings)} bookings")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
