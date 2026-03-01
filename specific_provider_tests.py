#!/usr/bin/env python3
"""
Specific Provider Services Tests as requested in the review
Testing the exact scenarios mentioned in the review request
"""

import requests
import json

# Backend URL from frontend .env
BACKEND_URL = "https://istylist-payments.preview.emergentagent.com/api"

def test_provider_services_with_specific_providers():
    """Test GET /api/provider-services/{provider_id} with providers 12, 13, 14"""
    print("🔍 Testing Provider Services with specific provider IDs (12, 13, 14)")
    
    for provider_id in [12, 13, 14]:
        try:
            response = requests.get(f"{BACKEND_URL}/provider-services/{provider_id}", timeout=10)
            if response.status_code == 200:
                services = response.json()
                print(f"✅ Provider {provider_id}: {len(services)} services found")
                
                # Verify response format for first service if exists
                if services:
                    first_service = services[0]
                    required_fields = ['id', 'provider_id', 'sub_service_id', 'sub_service_name', 
                                     'service_id', 'category_id', 'price', 'duration_minutes', 
                                     'is_active', 'in_store', 'home_service', 'travel_service']
                    
                    missing_fields = [field for field in required_fields if field not in first_service]
                    if not missing_fields:
                        print(f"   ✅ Response format correct for provider {provider_id}")
                        print(f"   📋 Sample service: {first_service['sub_service_name']} - ₦{first_service['price']}, {first_service['duration_minutes']} mins")
                    else:
                        print(f"   ❌ Missing fields for provider {provider_id}: {missing_fields}")
                else:
                    print(f"   ℹ️ Provider {provider_id}: No services configured")
            else:
                print(f"❌ Provider {provider_id}: HTTP {response.status_code} - {response.text}")
        except Exception as e:
            print(f"❌ Provider {provider_id}: Error - {str(e)}")

def test_pedicure_service_toggle():
    """Test the exact pedicure service toggle example from review request"""
    print("\n💅 Testing Pedicure Service Toggle (Exact Review Example)")
    
    provider_id = 13  # Using provider 13 as specified
    
    # Test toggle ON for pedicure service (exact example from review)
    toggle_data = {
        "services": [
            {
                "sub_service_id": "pedicure",
                "sub_service_name": "Pedicure",
                "service_id": "nail-technicians",
                "category_id": "beauty-grooming",
                "is_active": True,
                "price": 4500,
                "duration_minutes": 60,
                "in_store": True,
                "home_service": True,
                "travel_service": False
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/provider-services/toggle/{provider_id}", 
            json=toggle_data,
            timeout=10
        )
        if response.status_code == 200:
            result = response.json()
            print("✅ Pedicure service toggle ON successful")
            
            # Verify the service was created/updated correctly
            if result.get('services'):
                service = result['services'][0]
                print(f"   📋 Service created: {service['sub_service_name']}")
                print(f"   💰 Price: ₦{service['price']}")
                print(f"   ⏱️ Duration: {service['duration_minutes']} minutes")
                print(f"   🏪 In-store: {service['in_store']}")
                print(f"   🏠 Home service: {service['home_service']}")
                print(f"   ✈️ Travel service: {service['travel_service']}")
                
                # Test toggle OFF (is_active: false)
                print("\n   Testing toggle OFF...")
                toggle_off_data = {
                    "services": [
                        {
                            "sub_service_id": "pedicure",
                            "sub_service_name": "Pedicure",
                            "service_id": "nail-technicians",
                            "category_id": "beauty-grooming",
                            "is_active": False,
                            "price": 4500,
                            "duration_minutes": 60,
                            "in_store": True,
                            "home_service": True,
                            "travel_service": False
                        }
                    ]
                }
                
                toggle_off_response = requests.post(
                    f"{BACKEND_URL}/provider-services/toggle/{provider_id}", 
                    json=toggle_off_data,
                    timeout=10
                )
                
                if toggle_off_response.status_code == 200:
                    print("   ✅ Pedicure service toggle OFF successful")
                    
                    # Verify service is NOT deleted, just marked inactive
                    services_response = requests.get(f"{BACKEND_URL}/provider-services/{provider_id}", timeout=10)
                    if services_response.status_code == 200:
                        all_services = services_response.json()
                        pedicure_services = [s for s in all_services if s['sub_service_id'] == 'pedicure']
                        
                        if pedicure_services:
                            pedicure_service = pedicure_services[0]
                            if not pedicure_service['is_active']:
                                print("   ✅ Service persisted but marked inactive (not deleted)")
                            else:
                                print("   ❌ Service should be inactive but is still active")
                        else:
                            print("   ❌ Service was deleted instead of being marked inactive")
                else:
                    print(f"   ❌ Toggle OFF failed: HTTP {toggle_off_response.status_code}")
        else:
            print(f"❌ Pedicure toggle failed: HTTP {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Pedicure toggle error: {str(e)}")

def test_providers_listing_api():
    """Test Provider Listing API (Phase 1.4) as specified"""
    print("\n👥 Testing Provider Listing API (Phase 1.4)")
    
    # Test GET /api/providers/with-services
    try:
        response = requests.get(f"{BACKEND_URL}/providers/with-services", timeout=10)
        if response.status_code == 200:
            providers = response.json()
            print(f"✅ GET /api/providers/with-services: {len(providers)} providers with active services")
            
            # Verify only providers with active services appear
            for provider in providers:
                if provider.get('active_service_count', 0) > 0:
                    print(f"   ✅ {provider['name']}: {provider['active_service_count']} active services, starting at ₦{provider['starting_price']}")
                    if provider.get('primary_service'):
                        print(f"      Primary service: {provider['primary_service']}")
                else:
                    print(f"   ❌ {provider['name']}: No active services but still listed")
        else:
            print(f"❌ Providers listing failed: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Providers listing error: {str(e)}")
    
    # Test category filtering
    try:
        response = requests.get(f"{BACKEND_URL}/providers/with-services?category_id=beauty-grooming", timeout=10)
        if response.status_code == 200:
            filtered_providers = response.json()
            print(f"✅ Category filter (beauty-grooming): {len(filtered_providers)} providers")
        else:
            print(f"❌ Category filter failed: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Category filter error: {str(e)}")

def test_provider_full_profile():
    """Test GET /api/providers/{provider_id}/full-profile for booking view"""
    print("\n👤 Testing Provider Full Profile (Booking View)")
    
    provider_id = 12  # Test with provider 12 as specified
    
    try:
        response = requests.get(f"{BACKEND_URL}/providers/{provider_id}/full-profile", timeout=10)
        if response.status_code == 200:
            profile = response.json()
            print(f"✅ Provider {provider_id} full profile retrieved")
            print(f"   👤 Name: {profile.get('name')}")
            print(f"   📊 Total services: {profile.get('total_services')}")
            
            # Verify services array has only active services
            services = profile.get('services', [])
            active_services = [s for s in services if s.get('is_active', False)]
            inactive_services = [s for s in services if not s.get('is_active', True)]
            
            if len(services) == len(active_services):
                print(f"   ✅ Services array contains only active services ({len(active_services)} services)")
            else:
                print(f"   ❌ Services array contains inactive services: {len(inactive_services)} inactive out of {len(services)} total")
            
            # Verify services_by_category grouping
            services_by_category = profile.get('services_by_category', {})
            if services_by_category:
                print(f"   ✅ Services grouped by category: {len(services_by_category)} categories")
                for category, category_services in services_by_category.items():
                    print(f"      {category}: {len(category_services)} services")
            else:
                print(f"   ❌ services_by_category grouping missing or empty")
        else:
            print(f"❌ Provider full profile failed: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Provider full profile error: {str(e)}")

def test_service_catalog():
    """Test Service Catalog API endpoints"""
    print("\n📚 Testing Service Catalog API")
    
    # Test categories - should return 6 categories
    try:
        response = requests.get(f"{BACKEND_URL}/catalog/categories", timeout=10)
        if response.status_code == 200:
            categories = response.json()
            if len(categories) == 6:
                print(f"✅ GET /api/catalog/categories: {len(categories)} categories (expected 6)")
            else:
                print(f"❌ Expected 6 categories, got {len(categories)}")
        else:
            print(f"❌ Categories failed: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Categories error: {str(e)}")
    
    # Test sub-services - should return 100+ sub-services
    try:
        response = requests.get(f"{BACKEND_URL}/catalog/sub-services", timeout=10)
        if response.status_code == 200:
            sub_services = response.json()
            if len(sub_services) >= 100:
                print(f"✅ GET /api/catalog/sub-services: {len(sub_services)} sub-services (expected 100+)")
            else:
                print(f"❌ Expected 100+ sub-services, got {len(sub_services)}")
        else:
            print(f"❌ Sub-services failed: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Sub-services error: {str(e)}")

if __name__ == "__main__":
    print("🚀 Running Specific Provider Services Tests (Review Request)")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 70)
    
    test_provider_services_with_specific_providers()
    test_pedicure_service_toggle()
    test_providers_listing_api()
    test_provider_full_profile()
    test_service_catalog()
    
    print("\n" + "=" * 70)
    print("✅ All specific provider services tests completed!")