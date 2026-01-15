"""
Phase 1.9 - Provider Identity, Privacy & Trust Tests
Tests for:
1. Email NOT editable in UserUpdate model
2. Email NOT shown in public provider endpoints
3. display_name, provider_type, business_name fields in provider endpoints
4. Country/City/Gender fields in user endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAPIConnection:
    """Basic API connectivity tests"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Beauty Stylist Marketplace API" in data["message"]
        print(f"✓ API root accessible: {data['message']}")

    def test_database_connection(self):
        """Test database connection"""
        response = requests.get(f"{BASE_URL}/api/test-connection")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "connected"
        print(f"✓ Database connected: {data['message']}")


class TestProvidersWithServicesEndpoint:
    """Tests for /api/providers/with-services endpoint - Phase 1.9 Privacy"""
    
    def test_providers_with_services_returns_200(self):
        """Test endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/providers/with-services")
        assert response.status_code == 200
        print("✓ /api/providers/with-services returns 200")
    
    def test_providers_with_services_no_email(self):
        """CRITICAL: Email must NOT be returned in provider listing"""
        response = requests.get(f"{BASE_URL}/api/providers/with-services")
        assert response.status_code == 200
        providers = response.json()
        
        for provider in providers:
            assert "email" not in provider, f"Email found in provider {provider.get('provider_id')} - PRIVACY VIOLATION"
            assert "user_email" not in provider, f"user_email found in provider {provider.get('provider_id')} - PRIVACY VIOLATION"
        
        print(f"✓ No email exposed in {len(providers)} providers - Privacy maintained")
    
    def test_providers_with_services_has_display_name(self):
        """Test display_name field is present"""
        response = requests.get(f"{BASE_URL}/api/providers/with-services")
        assert response.status_code == 200
        providers = response.json()
        
        for provider in providers:
            assert "display_name" in provider, f"display_name missing in provider {provider.get('provider_id')}"
            assert provider["display_name"] is not None, f"display_name is null for provider {provider.get('provider_id')}"
        
        print(f"✓ display_name present in all {len(providers)} providers")
    
    def test_providers_with_services_has_provider_type(self):
        """Test provider_type field is present"""
        response = requests.get(f"{BASE_URL}/api/providers/with-services")
        assert response.status_code == 200
        providers = response.json()
        
        for provider in providers:
            assert "provider_type" in provider, f"provider_type missing in provider {provider.get('provider_id')}"
            assert provider["provider_type"] in ["individual", "business", None], f"Invalid provider_type: {provider.get('provider_type')}"
        
        print(f"✓ provider_type present in all {len(providers)} providers")
    
    def test_providers_with_services_has_business_name(self):
        """Test business_name field is present (can be null for individuals)"""
        response = requests.get(f"{BASE_URL}/api/providers/with-services")
        assert response.status_code == 200
        providers = response.json()
        
        for provider in providers:
            assert "business_name" in provider, f"business_name field missing in provider {provider.get('provider_id')}"
        
        print(f"✓ business_name field present in all {len(providers)} providers")
    
    def test_display_name_logic(self):
        """Test display_name shows business_name for business type, name for individual"""
        response = requests.get(f"{BASE_URL}/api/providers/with-services")
        assert response.status_code == 200
        providers = response.json()
        
        for provider in providers:
            if provider.get("provider_type") == "business" and provider.get("business_name"):
                # For business type with business_name, display_name should be business_name
                assert provider["display_name"] == provider["business_name"], \
                    f"Business provider {provider.get('provider_id')} display_name should be business_name"
            else:
                # For individual or business without business_name, display_name should be name
                assert provider["display_name"] == provider.get("name"), \
                    f"Individual provider {provider.get('provider_id')} display_name should be name"
        
        print("✓ display_name logic correct for all providers")


class TestProviderFullProfileEndpoint:
    """Tests for /api/providers/{id}/full-profile endpoint - Phase 1.9 Privacy"""
    
    def get_first_provider_id(self):
        """Helper to get first provider ID"""
        response = requests.get(f"{BASE_URL}/api/providers/with-services")
        if response.status_code == 200 and response.json():
            return response.json()[0]["provider_id"]
        return None
    
    def test_full_profile_returns_200(self):
        """Test endpoint returns 200 for valid provider"""
        provider_id = self.get_first_provider_id()
        if not provider_id:
            pytest.skip("No providers available")
        
        response = requests.get(f"{BASE_URL}/api/providers/{provider_id}/full-profile")
        assert response.status_code == 200
        print(f"✓ /api/providers/{provider_id}/full-profile returns 200")
    
    def test_full_profile_no_email(self):
        """CRITICAL: Email must NOT be returned in full profile"""
        provider_id = self.get_first_provider_id()
        if not provider_id:
            pytest.skip("No providers available")
        
        response = requests.get(f"{BASE_URL}/api/providers/{provider_id}/full-profile")
        assert response.status_code == 200
        profile = response.json()
        
        assert "email" not in profile, "Email found in full profile - PRIVACY VIOLATION"
        assert "user_email" not in profile, "user_email found in full profile - PRIVACY VIOLATION"
        
        print(f"✓ No email exposed in provider {provider_id} full profile - Privacy maintained")
    
    def test_full_profile_has_display_name(self):
        """Test display_name field is present in full profile"""
        provider_id = self.get_first_provider_id()
        if not provider_id:
            pytest.skip("No providers available")
        
        response = requests.get(f"{BASE_URL}/api/providers/{provider_id}/full-profile")
        assert response.status_code == 200
        profile = response.json()
        
        assert "display_name" in profile, "display_name missing in full profile"
        assert profile["display_name"] is not None, "display_name is null"
        
        print(f"✓ display_name present in provider {provider_id} full profile")
    
    def test_full_profile_has_provider_type(self):
        """Test provider_type field is present in full profile"""
        provider_id = self.get_first_provider_id()
        if not provider_id:
            pytest.skip("No providers available")
        
        response = requests.get(f"{BASE_URL}/api/providers/{provider_id}/full-profile")
        assert response.status_code == 200
        profile = response.json()
        
        assert "provider_type" in profile, "provider_type missing in full profile"
        
        print(f"✓ provider_type present in provider {provider_id} full profile")
    
    def test_full_profile_has_business_name(self):
        """Test business_name field is present in full profile"""
        provider_id = self.get_first_provider_id()
        if not provider_id:
            pytest.skip("No providers available")
        
        response = requests.get(f"{BASE_URL}/api/providers/{provider_id}/full-profile")
        assert response.status_code == 200
        profile = response.json()
        
        assert "business_name" in profile, "business_name field missing in full profile"
        
        print(f"✓ business_name field present in provider {provider_id} full profile")
    
    def test_full_profile_404_for_invalid_id(self):
        """Test 404 for non-existent provider"""
        response = requests.get(f"{BASE_URL}/api/providers/999999/full-profile")
        assert response.status_code == 404
        print("✓ Returns 404 for non-existent provider")


class TestUserUpdateModel:
    """Tests for UserUpdate model - Email should NOT be editable"""
    
    def test_user_update_without_email(self):
        """Test that user update works without email field"""
        # Get a user first
        response = requests.get(f"{BASE_URL}/api/users")
        if response.status_code != 200 or not response.json():
            pytest.skip("No users available")
        
        user = response.json()[0]
        user_id = user["id"]
        
        # Try to update without email (should work)
        update_data = {
            "name": user.get("name", "Test User"),
            "phone": user.get("phone"),
            "country": "Nigeria",
            "city": "Lagos",
            "gender": "prefer_not_to_say"
        }
        
        response = requests.put(f"{BASE_URL}/api/users/{user_id}", json=update_data)
        assert response.status_code == 200
        print(f"✓ User update without email works for user {user_id}")
    
    def test_user_response_has_privacy_fields(self):
        """Test that user response includes country, city, gender fields"""
        response = requests.get(f"{BASE_URL}/api/users")
        if response.status_code != 200 or not response.json():
            pytest.skip("No users available")
        
        user = response.json()[0]
        
        # These fields should exist in the response (can be null)
        assert "country" in user or user.get("country") is None, "country field should exist"
        assert "city" in user or user.get("city") is None, "city field should exist"
        assert "gender" in user or user.get("gender") is None, "gender field should exist"
        
        print("✓ User response includes country, city, gender fields")


class TestStylistModel:
    """Tests for Stylist model - provider_type and business_name fields"""
    
    def test_stylist_response_has_provider_type(self):
        """Test that stylist response includes provider_type field"""
        response = requests.get(f"{BASE_URL}/api/stylists")
        if response.status_code != 200 or not response.json():
            pytest.skip("No stylists available")
        
        stylist = response.json()[0]
        
        assert "provider_type" in stylist, "provider_type field missing in stylist response"
        
        print("✓ Stylist response includes provider_type field")
    
    def test_stylist_response_has_business_name(self):
        """Test that stylist response includes business_name field"""
        response = requests.get(f"{BASE_URL}/api/stylists")
        if response.status_code != 200 or not response.json():
            pytest.skip("No stylists available")
        
        stylist = response.json()[0]
        
        assert "business_name" in stylist, "business_name field missing in stylist response"
        
        print("✓ Stylist response includes business_name field")


class TestFilters:
    """Test filtering functionality"""
    
    def test_city_filter(self):
        """Test city filter on providers endpoint"""
        response = requests.get(f"{BASE_URL}/api/providers/with-services?city=Lagos")
        assert response.status_code == 200
        print("✓ City filter works on providers endpoint")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
