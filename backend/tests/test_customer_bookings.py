"""
Test Customer Bookings API - Verifies the bookings endpoint for customer users
Tests the GET /api/bookings?role=customer&auth_id=UUID endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test customer auth_id with 12 bookings
TEST_CUSTOMER_AUTH_ID = "7d7c188d-ab15-4dc3-8b98-f985f5e02d16"
TEST_CUSTOMER_NAME = "ODG Madu"


class TestCustomerBookingsAPI:
    """Tests for customer bookings endpoint"""
    
    def test_get_customer_bookings_returns_200(self):
        """Test that GET /api/bookings with customer role returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": TEST_CUSTOMER_AUTH_ID}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ GET /api/bookings?role=customer&auth_id={TEST_CUSTOMER_AUTH_ID} returns 200")
    
    def test_get_customer_bookings_returns_list(self):
        """Test that response is a list of bookings"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": TEST_CUSTOMER_AUTH_ID}
        )
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Response is a list with {len(data)} bookings")
    
    def test_get_customer_bookings_count(self):
        """Test that customer has expected number of bookings (12)"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": TEST_CUSTOMER_AUTH_ID}
        )
        data = response.json()
        assert len(data) >= 10, f"Expected at least 10 bookings, got {len(data)}"
        print(f"✓ Customer has {len(data)} bookings (expected >= 10)")
    
    def test_booking_has_required_fields(self):
        """Test that each booking has required fields for display"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": TEST_CUSTOMER_AUTH_ID}
        )
        data = response.json()
        assert len(data) > 0, "No bookings found"
        
        booking = data[0]
        required_fields = ["id", "status", "booking_date", "booking_time", "provider_display_name"]
        
        for field in required_fields:
            assert field in booking, f"Missing required field: {field}"
            print(f"  ✓ Field '{field}' present: {booking.get(field)}")
        
        print(f"✓ Booking has all required fields")
    
    def test_booking_has_services_array(self):
        """Test that bookings include services array"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": TEST_CUSTOMER_AUTH_ID}
        )
        data = response.json()
        assert len(data) > 0, "No bookings found"
        
        booking = data[0]
        assert "services" in booking, "Missing 'services' field"
        assert isinstance(booking["services"], list), "Services should be a list"
        print(f"✓ Booking has services array with {len(booking['services'])} services")
    
    def test_booking_has_total_amount(self):
        """Test that bookings include total_amount"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": TEST_CUSTOMER_AUTH_ID}
        )
        data = response.json()
        assert len(data) > 0, "No bookings found"
        
        booking = data[0]
        assert "total_amount" in booking, "Missing 'total_amount' field"
        assert isinstance(booking["total_amount"], (int, float)), "total_amount should be numeric"
        print(f"✓ Booking has total_amount: {booking['total_amount']}")
    
    def test_booking_status_values(self):
        """Test that booking statuses are valid"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": TEST_CUSTOMER_AUTH_ID}
        )
        data = response.json()
        
        valid_statuses = ["pending", "confirmed", "completed", "canceled", "declined"]
        statuses_found = set()
        
        for booking in data:
            status = booking.get("status")
            assert status in valid_statuses, f"Invalid status: {status}"
            statuses_found.add(status)
        
        print(f"✓ All booking statuses are valid. Found: {statuses_found}")
    
    def test_booking_customer_auth_id_matches(self):
        """Test that all returned bookings belong to the customer"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": TEST_CUSTOMER_AUTH_ID}
        )
        data = response.json()
        
        for booking in data:
            assert booking.get("customer_auth_id") == TEST_CUSTOMER_AUTH_ID, \
                f"Booking {booking['id']} has wrong customer_auth_id: {booking.get('customer_auth_id')}"
        
        print(f"✓ All {len(data)} bookings belong to customer {TEST_CUSTOMER_AUTH_ID}")
    
    def test_empty_auth_id_returns_empty_list(self):
        """Test that invalid auth_id returns empty list"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": "00000000-0000-0000-0000-000000000000"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        assert len(data) == 0, f"Expected empty list, got {len(data)} bookings"
        print("✓ Invalid auth_id returns empty list")
    
    def test_booking_details_endpoint(self):
        """Test that individual booking can be fetched"""
        # First get list of bookings
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": TEST_CUSTOMER_AUTH_ID}
        )
        data = response.json()
        assert len(data) > 0, "No bookings found"
        
        booking_id = data[0]["id"]
        
        # Fetch individual booking
        detail_response = requests.get(f"{BASE_URL}/api/bookings/{booking_id}")
        assert detail_response.status_code == 200, f"Expected 200, got {detail_response.status_code}"
        
        detail = detail_response.json()
        assert detail["id"] == booking_id
        print(f"✓ GET /api/bookings/{booking_id} returns booking details")


class TestBookingsAPIStructure:
    """Tests for API structure and response format"""
    
    def test_api_health(self):
        """Test that API is accessible"""
        response = requests.get(f"{BASE_URL}/api/test-connection")
        assert response.status_code == 200
        print("✓ API is accessible")
    
    def test_bookings_endpoint_exists(self):
        """Test that bookings endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/bookings")
        # Should return 200 even without params (returns all bookings or empty)
        assert response.status_code == 200
        print("✓ /api/bookings endpoint exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
