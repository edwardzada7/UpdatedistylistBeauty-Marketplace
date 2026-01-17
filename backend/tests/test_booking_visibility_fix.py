"""
Test Suite for Booking Visibility Fix (Phase 2.3)
Tests for:
1. GET /api/bookings?role=customer&auth_id=UUID returns bookings for that customer
2. GET /api/bookings?role=provider&auth_id=UUID returns bookings for that provider
3. GET /api/providers/metrics?auth_id=UUID returns correct booking counts
4. POST /api/bookings with customer_auth_id creates booking with correct customer_auth_id
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable is required")

# Test credentials from the review request
TEST_CUSTOMER_USER_ID = 21
TEST_CUSTOMER_AUTH_ID = "7d7c188d-ab15-4dc3-8b98-f985f5e02d16"
TEST_PROVIDER_USER_ID = 13
TEST_PROVIDER_AUTH_ID = "15fcb394-64cb-41d7-bdb4-90678e4f4fcc"


class TestCustomerBookingVisibility:
    """Test that customers can see their bookings using auth_id (UUID)"""
    
    def test_customer_bookings_by_auth_id(self):
        """GET /api/bookings?role=customer&auth_id=UUID returns bookings for that customer"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": TEST_CUSTOMER_AUTH_ID}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        bookings = response.json()
        assert isinstance(bookings, list), "Response should be a list"
        
        # According to the review request, test customer (user 21) should have 9 bookings
        print(f"✓ Customer {TEST_CUSTOMER_AUTH_ID} has {len(bookings)} bookings")
        
        # Verify all returned bookings belong to this customer
        for booking in bookings:
            customer_auth_id = booking.get("customer_auth_id")
            # The booking should have customer_auth_id matching our test customer
            if customer_auth_id:
                assert customer_auth_id == TEST_CUSTOMER_AUTH_ID, \
                    f"Booking {booking.get('id')} has wrong customer_auth_id: {customer_auth_id}"
        
        print(f"✓ All {len(bookings)} bookings correctly filtered by customer_auth_id")
        return len(bookings)
    
    def test_customer_bookings_have_computed_fields(self):
        """Verify customer bookings include computed fields"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": TEST_CUSTOMER_AUTH_ID}
        )
        
        assert response.status_code == 200
        bookings = response.json()
        
        if len(bookings) > 0:
            booking = bookings[0]
            # Check for computed fields
            assert "services" in booking, "Booking should have 'services' field"
            assert "total_amount" in booking, "Booking should have 'total_amount' field"
            assert "total_duration" in booking, "Booking should have 'total_duration' field"
            assert "provider_display_name" in booking, "Booking should have 'provider_display_name' field"
            print(f"✓ Customer booking has all computed fields")
        else:
            print("⚠ No bookings found to verify computed fields")


class TestProviderBookingVisibility:
    """Test that providers can see their bookings using auth_id (UUID)"""
    
    def test_provider_bookings_by_auth_id(self):
        """GET /api/bookings?role=provider&auth_id=UUID returns bookings for that provider"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "provider", "auth_id": TEST_PROVIDER_AUTH_ID}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        bookings = response.json()
        assert isinstance(bookings, list), "Response should be a list"
        
        print(f"✓ Provider {TEST_PROVIDER_AUTH_ID} has {len(bookings)} bookings")
        
        # Verify all returned bookings belong to this provider
        for booking in bookings:
            provider_id = booking.get("provider_id")
            # The booking should have provider_id matching our test provider's auth_id
            if provider_id:
                assert provider_id == TEST_PROVIDER_AUTH_ID, \
                    f"Booking {booking.get('id')} has wrong provider_id: {provider_id}"
        
        print(f"✓ All {len(bookings)} bookings correctly filtered by provider_id (auth_id)")
        return len(bookings)
    
    def test_provider_bookings_have_computed_fields(self):
        """Verify provider bookings include computed fields"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "provider", "auth_id": TEST_PROVIDER_AUTH_ID}
        )
        
        assert response.status_code == 200
        bookings = response.json()
        
        if len(bookings) > 0:
            booking = bookings[0]
            # Check for computed fields
            assert "services" in booking, "Booking should have 'services' field"
            assert "total_amount" in booking, "Booking should have 'total_amount' field"
            assert "customer_display_name" in booking, "Booking should have 'customer_display_name' field"
            print(f"✓ Provider booking has all computed fields")
        else:
            print("⚠ No bookings found to verify computed fields")


class TestProviderMetrics:
    """Test GET /api/providers/metrics endpoint"""
    
    def test_provider_metrics_returns_counts(self):
        """GET /api/providers/metrics?auth_id=UUID returns correct booking counts"""
        response = requests.get(
            f"{BASE_URL}/api/providers/metrics",
            params={"auth_id": TEST_PROVIDER_AUTH_ID}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        metrics = response.json()
        
        # Verify response structure
        assert "pending_count" in metrics, "Metrics should have 'pending_count'"
        assert "confirmed_count" in metrics, "Metrics should have 'confirmed_count'"
        assert "completed_count" in metrics, "Metrics should have 'completed_count'"
        assert "canceled_count" in metrics, "Metrics should have 'canceled_count'"
        assert "total_count" in metrics, "Metrics should have 'total_count'"
        
        # Verify counts are non-negative integers
        assert isinstance(metrics["pending_count"], int) and metrics["pending_count"] >= 0
        assert isinstance(metrics["confirmed_count"], int) and metrics["confirmed_count"] >= 0
        assert isinstance(metrics["completed_count"], int) and metrics["completed_count"] >= 0
        assert isinstance(metrics["canceled_count"], int) and metrics["canceled_count"] >= 0
        assert isinstance(metrics["total_count"], int) and metrics["total_count"] >= 0
        
        # Verify total equals sum of individual counts
        expected_total = (
            metrics["pending_count"] + 
            metrics["confirmed_count"] + 
            metrics["completed_count"] + 
            metrics["canceled_count"]
        )
        assert metrics["total_count"] == expected_total, \
            f"Total count {metrics['total_count']} should equal sum of individual counts {expected_total}"
        
        print(f"✓ Provider metrics: pending={metrics['pending_count']}, confirmed={metrics['confirmed_count']}, "
              f"completed={metrics['completed_count']}, canceled={metrics['canceled_count']}, total={metrics['total_count']}")
        
        return metrics
    
    def test_provider_metrics_matches_bookings_list(self):
        """Verify metrics match actual bookings count"""
        # Get metrics
        metrics_response = requests.get(
            f"{BASE_URL}/api/providers/metrics",
            params={"auth_id": TEST_PROVIDER_AUTH_ID}
        )
        assert metrics_response.status_code == 200
        metrics = metrics_response.json()
        
        # Get actual bookings
        bookings_response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "provider", "auth_id": TEST_PROVIDER_AUTH_ID}
        )
        assert bookings_response.status_code == 200
        bookings = bookings_response.json()
        
        # Count by status from bookings list
        actual_pending = sum(1 for b in bookings if b.get("status") == "pending")
        actual_confirmed = sum(1 for b in bookings if b.get("status") == "confirmed")
        actual_completed = sum(1 for b in bookings if b.get("status") == "completed")
        actual_canceled = sum(1 for b in bookings if b.get("status") in ["canceled", "declined"])
        
        # Compare
        assert metrics["pending_count"] == actual_pending, \
            f"Pending count mismatch: metrics={metrics['pending_count']}, actual={actual_pending}"
        assert metrics["confirmed_count"] == actual_confirmed, \
            f"Confirmed count mismatch: metrics={metrics['confirmed_count']}, actual={actual_confirmed}"
        assert metrics["completed_count"] == actual_completed, \
            f"Completed count mismatch: metrics={metrics['completed_count']}, actual={actual_completed}"
        assert metrics["canceled_count"] == actual_canceled, \
            f"Canceled count mismatch: metrics={metrics['canceled_count']}, actual={actual_canceled}"
        
        print(f"✓ Provider metrics match actual bookings list counts")
    
    def test_provider_metrics_requires_auth_id(self):
        """GET /api/providers/metrics without auth_id returns 422"""
        response = requests.get(f"{BASE_URL}/api/providers/metrics")
        
        # Should return 422 Unprocessable Entity (missing required parameter)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Provider metrics requires auth_id parameter")


class TestBookingCreationWithCustomerAuthId:
    """Test POST /api/bookings with customer_auth_id"""
    
    def test_create_booking_with_customer_auth_id(self):
        """POST /api/bookings with customer_auth_id creates booking with correct customer_auth_id"""
        # First, get an active service for the provider
        services_response = requests.get(f"{BASE_URL}/api/provider-services/{TEST_PROVIDER_USER_ID}")
        if services_response.status_code != 200:
            pytest.skip("Could not get provider services")
        
        services = services_response.json()
        active_services = [s for s in services if s.get("is_active")]
        if not active_services:
            pytest.skip("No active services for provider")
        
        service_id = active_services[0]["id"]
        
        # Create booking with customer_auth_id
        booking_payload = {
            "provider_id": TEST_PROVIDER_USER_ID,
            "customer_id": TEST_CUSTOMER_USER_ID,  # Legacy integer ID
            "customer_auth_id": TEST_CUSTOMER_AUTH_ID,  # UUID auth_id
            "service_ids": [service_id],
            "booking_date": "2026-03-15",
            "booking_time": "10:00",
            "status": "pending",
            "notes": "TEST_VISIBILITY_FIX - Test booking for visibility fix"
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_payload)
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        booking = response.json()
        
        # Verify customer_auth_id was set correctly
        assert booking.get("customer_auth_id") == TEST_CUSTOMER_AUTH_ID, \
            f"Booking customer_auth_id should be {TEST_CUSTOMER_AUTH_ID}, got {booking.get('customer_auth_id')}"
        
        print(f"✓ Created booking {booking.get('id')} with customer_auth_id={booking.get('customer_auth_id')}")
        
        # Verify the booking appears in customer's list
        list_response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": TEST_CUSTOMER_AUTH_ID}
        )
        assert list_response.status_code == 200
        bookings = list_response.json()
        
        booking_ids = [b.get("id") for b in bookings]
        assert booking.get("id") in booking_ids, \
            f"New booking {booking.get('id')} should appear in customer's booking list"
        
        print(f"✓ New booking appears in customer's booking list")
        
        return booking.get("id")
    
    def test_create_booking_without_customer_auth_id_falls_back(self):
        """POST /api/bookings without customer_auth_id looks up from customer_id"""
        # First, get an active service for the provider
        services_response = requests.get(f"{BASE_URL}/api/provider-services/{TEST_PROVIDER_USER_ID}")
        if services_response.status_code != 200:
            pytest.skip("Could not get provider services")
        
        services = services_response.json()
        active_services = [s for s in services if s.get("is_active")]
        if not active_services:
            pytest.skip("No active services for provider")
        
        service_id = active_services[0]["id"]
        
        # Create booking WITHOUT customer_auth_id (only customer_id)
        booking_payload = {
            "provider_id": TEST_PROVIDER_USER_ID,
            "customer_id": TEST_CUSTOMER_USER_ID,  # Only integer ID
            # No customer_auth_id - should be looked up
            "service_ids": [service_id],
            "booking_date": "2026-03-16",
            "booking_time": "11:00",
            "status": "pending",
            "notes": "TEST_VISIBILITY_FIX - Test fallback lookup"
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_payload)
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        booking = response.json()
        
        # Verify customer_auth_id was looked up and set
        assert booking.get("customer_auth_id") == TEST_CUSTOMER_AUTH_ID, \
            f"Booking customer_auth_id should be looked up to {TEST_CUSTOMER_AUTH_ID}, got {booking.get('customer_auth_id')}"
        
        print(f"✓ Created booking {booking.get('id')} with fallback customer_auth_id lookup")
        
        return booking.get("id")


class TestBackfillMigration:
    """Test the backfill migration endpoint"""
    
    def test_backfill_endpoint_exists(self):
        """POST /api/migrate/backfill-customer-auth-ids endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/migrate/backfill-customer-auth-ids")
        
        # Should return 200 (success) - migration already run
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        
        assert "message" in result, "Response should have 'message'"
        assert "updated" in result, "Response should have 'updated' count"
        
        print(f"✓ Backfill migration: {result.get('message')}, updated={result.get('updated')}")


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_invalid_auth_id_returns_empty_list(self):
        """GET /api/bookings with invalid auth_id returns empty list"""
        response = requests.get(
            f"{BASE_URL}/api/bookings",
            params={"role": "customer", "auth_id": "invalid-uuid-12345"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        bookings = response.json()
        assert isinstance(bookings, list), "Response should be a list"
        assert len(bookings) == 0, "Invalid auth_id should return empty list"
        
        print("✓ Invalid auth_id returns empty list")
    
    def test_provider_metrics_invalid_auth_id_returns_zeros(self):
        """GET /api/providers/metrics with invalid auth_id returns zero counts"""
        response = requests.get(
            f"{BASE_URL}/api/providers/metrics",
            params={"auth_id": "invalid-uuid-12345"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        metrics = response.json()
        
        assert metrics["total_count"] == 0, "Invalid auth_id should return zero total"
        print("✓ Invalid auth_id returns zero metrics")
    
    def test_bookings_without_role_returns_all(self):
        """GET /api/bookings without role filter returns all bookings"""
        response = requests.get(f"{BASE_URL}/api/bookings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        bookings = response.json()
        assert isinstance(bookings, list), "Response should be a list"
        
        print(f"✓ GET /api/bookings without filters returns {len(bookings)} bookings")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
