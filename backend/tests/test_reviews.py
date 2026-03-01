"""
Tests for Reviews & Ratings API endpoints (Phase 3)
"""
import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app

client = TestClient(app)

# Test UUIDs (using valid UUID format)
TEST_CUSTOMER_AUTH_ID = "11111111-1111-1111-1111-111111111111"
TEST_PROVIDER_AUTH_ID = "22222222-2222-2222-2222-222222222222"
TEST_OTHER_AUTH_ID = "33333333-3333-3333-3333-333333333333"


class TestReviewsEndpoints:
    """Test suite for Reviews API endpoints"""

    def test_create_review_booking_not_found(self):
        """Test creating a review for non-existent booking"""
        response = client.post(
            f"/api/reviews?auth_id={TEST_CUSTOMER_AUTH_ID}",
            json={
                "booking_id": 999999,
                "rating": 5,
                "comment": "Great service!"
            }
        )
        # Should return 404 for booking not found
        assert response.status_code == 404

    def test_create_review_invalid_rating_too_low(self):
        """Test creating a review with rating below 1"""
        response = client.post(
            f"/api/reviews?auth_id={TEST_CUSTOMER_AUTH_ID}",
            json={
                "booking_id": 1,
                "rating": 0,
                "comment": "Bad rating"
            }
        )
        # Should return 422 for validation error
        assert response.status_code == 422

    def test_create_review_invalid_rating_too_high(self):
        """Test creating a review with rating above 5"""
        response = client.post(
            f"/api/reviews?auth_id={TEST_CUSTOMER_AUTH_ID}",
            json={
                "booking_id": 1,
                "rating": 6,
                "comment": "Too high rating"
            }
        )
        # Should return 422 for validation error
        assert response.status_code == 422

    def test_get_provider_reviews_empty(self):
        """Test getting reviews for provider with no reviews"""
        response = client.get(
            f"/api/providers/{TEST_PROVIDER_AUTH_ID}/reviews"
        )
        assert response.status_code == 200
        data = response.json()
        assert "reviews" in data
        assert "avg_rating" in data
        assert "total_reviews" in data
        # Should return empty list and zero stats
        assert data["total_reviews"] == 0
        assert data["avg_rating"] == 0

    def test_get_provider_reviews_with_pagination(self):
        """Test getting provider reviews with pagination params"""
        response = client.get(
            f"/api/providers/{TEST_PROVIDER_AUTH_ID}/reviews?limit=10&offset=0"
        )
        assert response.status_code == 200
        data = response.json()
        assert "reviews" in data
        assert isinstance(data["reviews"], list)

    def test_get_my_reviews_customer(self):
        """Test getting reviews as customer"""
        response = client.get(
            f"/api/reviews/me?auth_id={TEST_CUSTOMER_AUTH_ID}&role=customer"
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_my_reviews_provider(self):
        """Test getting reviews as provider"""
        response = client.get(
            f"/api/reviews/me?auth_id={TEST_PROVIDER_AUTH_ID}&role=provider"
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_my_reviews_invalid_role(self):
        """Test getting reviews with invalid role"""
        response = client.get(
            f"/api/reviews/me?auth_id={TEST_CUSTOMER_AUTH_ID}&role=invalid"
        )
        assert response.status_code == 400

    def test_get_review_by_booking_not_found(self):
        """Test getting review for non-existent booking"""
        response = client.get(
            f"/api/reviews/by-booking/999999?auth_id={TEST_CUSTOMER_AUTH_ID}"
        )
        # Should return 404 for booking not found
        assert response.status_code == 404

    def test_reply_to_review_not_found(self):
        """Test replying to non-existent review"""
        response = client.post(
            f"/api/reviews/999999/reply?auth_id={TEST_PROVIDER_AUTH_ID}",
            json={"provider_reply": "Thank you!"}
        )
        # Should return 404 for review not found
        assert response.status_code == 404

    def test_reply_to_review_missing_reply_text(self):
        """Test replying to review without reply text"""
        response = client.post(
            f"/api/reviews/1/reply?auth_id={TEST_PROVIDER_AUTH_ID}",
            json={"provider_reply": ""}
        )
        # Should return 422 for validation error (min_length=1)
        assert response.status_code == 422


class TestReviewsValidation:
    """Test validation rules for reviews"""

    def test_review_requires_auth_id(self):
        """Test that review creation requires auth_id"""
        response = client.post(
            "/api/reviews",
            json={
                "booking_id": 1,
                "rating": 5,
                "comment": "Great!"
            }
        )
        # Should return 422 for missing required param
        assert response.status_code == 422

    def test_get_my_reviews_requires_auth_id(self):
        """Test that getting my reviews requires auth_id"""
        response = client.get("/api/reviews/me?role=customer")
        # Should return 422 for missing required param
        assert response.status_code == 422

    def test_get_my_reviews_requires_role(self):
        """Test that getting my reviews requires role"""
        response = client.get(f"/api/reviews/me?auth_id={TEST_CUSTOMER_AUTH_ID}")
        # Should return 422 for missing required param
        assert response.status_code == 422


class TestReviewsPermissions:
    """Test permission rules for reviews"""

    def test_only_customer_can_review_their_booking(self):
        """Test that only the customer of a booking can review it"""
        # This test requires an actual booking in the DB
        # For now, we just verify the endpoint exists and handles errors
        response = client.post(
            f"/api/reviews?auth_id={TEST_OTHER_AUTH_ID}",
            json={
                "booking_id": 1,
                "rating": 5,
                "comment": "Not my booking"
            }
        )
        # Will return 404 (booking not found) or 403 (not authorized)
        assert response.status_code in [403, 404]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
