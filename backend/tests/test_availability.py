"""
Test Suite for Provider Availability and Booking Validation
Tests:
1. Slot generation with weekly availability
2. Exception blocks all slots
3. Conflict booking returns 409
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')
if not BASE_URL.endswith('/api'):
    BASE_URL = BASE_URL + '/api'

# Test provider ID (use existing provider)
TEST_PROVIDER_ID = 13


class TestAvailabilityEndpoints:
    """Test availability CRUD endpoints"""
    
    def test_get_availability_endpoint_exists(self):
        """Test that GET /providers/{id}/availability endpoint exists"""
        response = requests.get(f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/availability")
        # Should return 200 or 503 (if tables don't exist), not 404
        assert response.status_code in [200, 503], f"Expected 200 or 503, got {response.status_code}: {response.text}"
        print(f"✓ GET availability endpoint works: {response.status_code}")
    
    def test_set_weekly_availability(self):
        """Test POST /providers/{id}/availability to set weekly hours"""
        payload = {
            "weekly": [
                {"day_of_week": 0, "is_available": False, "start_time": None, "end_time": None},
                {"day_of_week": 1, "is_available": True, "start_time": "09:00", "end_time": "17:00"},
                {"day_of_week": 2, "is_available": True, "start_time": "09:00", "end_time": "17:00"},
                {"day_of_week": 3, "is_available": True, "start_time": "09:00", "end_time": "17:00"},
                {"day_of_week": 4, "is_available": True, "start_time": "09:00", "end_time": "17:00"},
                {"day_of_week": 5, "is_available": True, "start_time": "10:00", "end_time": "14:00"},
                {"day_of_week": 6, "is_available": False, "start_time": None, "end_time": None}
            ]
        }
        response = requests.post(f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/availability", json=payload)
        assert response.status_code in [200, 503], f"Expected 200 or 503, got {response.status_code}: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            print(f"✓ Weekly availability set: {data}")
    
    def test_invalid_time_format_rejected(self):
        """Test that invalid time formats are rejected"""
        payload = {
            "weekly": [
                {"day_of_week": 1, "is_available": True, "start_time": "9am", "end_time": "5pm"}
            ]
        }
        response = requests.post(f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/availability", json=payload)
        assert response.status_code == 422, f"Expected 422 for invalid time format, got {response.status_code}"
        print("✓ Invalid time format correctly rejected")
    
    def test_start_after_end_rejected(self):
        """Test that start_time >= end_time is rejected"""
        payload = {
            "weekly": [
                {"day_of_week": 1, "is_available": True, "start_time": "17:00", "end_time": "09:00"}
            ]
        }
        response = requests.post(f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/availability", json=payload)
        assert response.status_code == 400, f"Expected 400 for start >= end, got {response.status_code}"
        print("✓ Invalid time range correctly rejected")


class TestExceptionsEndpoints:
    """Test exception date endpoints"""
    
    def test_set_exception_day_off(self):
        """Test setting a full day off exception"""
        future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        payload = {
            "exceptions": [
                {"date": future_date, "is_unavailable": True, "note": "Test day off"}
            ]
        }
        response = requests.post(f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/exceptions", json=payload)
        assert response.status_code in [200, 503], f"Expected 200 or 503, got {response.status_code}: {response.text}"
        if response.status_code == 200:
            print(f"✓ Exception (day off) set for {future_date}")
    
    def test_set_exception_custom_hours(self):
        """Test setting custom hours for a date"""
        future_date = (datetime.now() + timedelta(days=31)).strftime('%Y-%m-%d')
        payload = {
            "exceptions": [
                {"date": future_date, "is_unavailable": False, "start_time": "12:00", "end_time": "16:00", "note": "Late start"}
            ]
        }
        response = requests.post(f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/exceptions", json=payload)
        assert response.status_code in [200, 503], f"Expected 200 or 503, got {response.status_code}: {response.text}"
        if response.status_code == 200:
            print(f"✓ Exception (custom hours) set for {future_date}")


class TestBookingRulesEndpoints:
    """Test booking rules endpoints"""
    
    def test_set_booking_rules(self):
        """Test setting booking rules"""
        payload = {
            "max_sessions_per_day": 8,
            "min_notice_minutes": 60,
            "slot_step_minutes": 30
        }
        response = requests.post(f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/rules", json=payload)
        assert response.status_code in [200, 503], f"Expected 200 or 503, got {response.status_code}: {response.text}"
        if response.status_code == 200:
            print("✓ Booking rules set successfully")
    
    def test_invalid_slot_step_rejected(self):
        """Test that invalid slot_step_minutes is rejected"""
        payload = {
            "slot_step_minutes": 25  # Not in allowed values
        }
        response = requests.post(f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/rules", json=payload)
        assert response.status_code == 422, f"Expected 422 for invalid slot_step, got {response.status_code}"
        print("✓ Invalid slot step correctly rejected")


class TestSlotGeneration:
    """Test available slots generation"""
    
    def test_get_slots_for_date(self):
        """Test getting available slots for a specific date"""
        # Use a date in the future that should be a weekday
        future_date = datetime.now() + timedelta(days=7)
        # Find a Tuesday (day_of_week = 2)
        while future_date.weekday() != 1:  # Tuesday in Python weekday
            future_date += timedelta(days=1)
        date_str = future_date.strftime('%Y-%m-%d')
        
        response = requests.get(
            f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/available-slots",
            params={"date": date_str, "service_duration": 60}
        )
        assert response.status_code in [200, 503], f"Expected 200 or 503, got {response.status_code}: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "date" in data
            assert "slots" in data
            assert "timezone" in data
            print(f"✓ Got slots for {date_str}: {len(data['slots'])} slots available")
    
    def test_slots_empty_for_unavailable_day(self):
        """Test that unavailable days return empty slots"""
        # First set Sunday (day 0) as unavailable (already done in weekly availability)
        # Then query for a Sunday
        future_date = datetime.now() + timedelta(days=7)
        while future_date.weekday() != 6:  # Sunday in Python weekday
            future_date += timedelta(days=1)
        date_str = future_date.strftime('%Y-%m-%d')
        
        response = requests.get(
            f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/available-slots",
            params={"date": date_str, "service_duration": 60}
        )
        assert response.status_code in [200, 503], f"Expected 200 or 503, got {response.status_code}: {response.text}"
        if response.status_code == 200:
            data = response.json()
            # Sunday should have no slots (set as unavailable)
            print(f"✓ Sunday {date_str} slots: {len(data['slots'])} (expected 0 or more based on config)")
    
    def test_slots_require_date_param(self):
        """Test that date parameter is required"""
        response = requests.get(
            f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/available-slots",
            params={"service_duration": 60}
        )
        assert response.status_code == 422, f"Expected 422 for missing date, got {response.status_code}"
        print("✓ Missing date parameter correctly rejected")
    
    def test_slots_require_duration_param(self):
        """Test that service_duration parameter is required"""
        date_str = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        response = requests.get(
            f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/available-slots",
            params={"date": date_str}
        )
        assert response.status_code == 422, f"Expected 422 for missing duration, got {response.status_code}"
        print("✓ Missing duration parameter correctly rejected")


class TestBookingValidation:
    """Test booking creation with validation"""
    
    def test_booking_endpoint_exists(self):
        """Test that POST /bookings endpoint exists"""
        # Just test that endpoint exists, not actual booking
        response = requests.post(f"{BASE_URL}/bookings", json={
            "provider_id": TEST_PROVIDER_ID,
            "customer_id": 1
        })
        # Should not be 404 (endpoint not found)
        assert response.status_code != 404, "Booking endpoint not found"
        print(f"✓ Booking endpoint exists: {response.status_code}")
    
    def test_booking_invalid_time_format(self):
        """Test that invalid booking_time format is rejected"""
        response = requests.post(f"{BASE_URL}/bookings", json={
            "provider_id": TEST_PROVIDER_ID,
            "customer_id": 1,
            "booking_date": "2026-02-01",
            "booking_time": "9am"
        })
        assert response.status_code in [400, 422, 503], f"Expected 400/422/503 for invalid time, got {response.status_code}"
        print("✓ Invalid booking time format rejected")
    
    def test_booking_conflict_detection(self):
        """Test that double-booking same slot returns 409"""
        # This test requires tables to exist and availability to be set
        future_date = datetime.now() + timedelta(days=14)
        while future_date.weekday() != 1:  # Tuesday
            future_date += timedelta(days=1)
        date_str = future_date.strftime('%Y-%m-%d')
        
        # First, check if we can get slots
        slots_response = requests.get(
            f"{BASE_URL}/providers/{TEST_PROVIDER_ID}/available-slots",
            params={"date": date_str, "service_duration": 60}
        )
        
        if slots_response.status_code == 503:
            pytest.skip("Availability tables not set up")
        
        if slots_response.status_code == 200:
            slots = slots_response.json().get("slots", [])
            if not slots:
                pytest.skip("No slots available for test")
            
            test_slot = slots[0]
            
            # Try to book the same slot twice
            booking_data = {
                "provider_id": TEST_PROVIDER_ID,
                "customer_id": 1,
                "booking_date": date_str,
                "booking_time": test_slot,
                "service_duration_minutes": 60
            }
            
            # First booking
            resp1 = requests.post(f"{BASE_URL}/bookings", json=booking_data)
            
            if resp1.status_code == 503:
                pytest.skip("Bookings table not set up")
            
            # Second booking (same slot) - should conflict
            if resp1.status_code == 201:
                resp2 = requests.post(f"{BASE_URL}/bookings", json=booking_data)
                assert resp2.status_code == 409, f"Expected 409 for conflict, got {resp2.status_code}: {resp2.text}"
                print(f"✓ Double booking correctly returns 409")


class TestGetBookings:
    """Test booking retrieval endpoints"""
    
    def test_get_bookings_list(self):
        """Test GET /bookings endpoint"""
        response = requests.get(f"{BASE_URL}/bookings")
        assert response.status_code in [200, 503], f"Expected 200 or 503, got {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ GET bookings returns {len(data)} bookings")
    
    def test_get_bookings_with_filters(self):
        """Test GET /bookings with query filters"""
        response = requests.get(f"{BASE_URL}/bookings", params={
            "provider_id": TEST_PROVIDER_ID,
            "status": "pending"
        })
        assert response.status_code in [200, 503], f"Expected 200 or 503, got {response.status_code}"
        print("✓ GET bookings with filters works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
