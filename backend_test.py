#!/usr/bin/env python3
"""
Backend API Testing for iStylist Phase 1.1-1.4 Implementation
Tests Service Catalog and Provider Services APIs
"""

import requests
import json
import sys
from typing import Dict, Any, Optional
import uuid

# Get backend URL from frontend .env
BACKEND_URL = "https://salon-on-demand.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = {
            "connection": False,
            "users_api": {"get_all": False, "create": False, "get_by_auth": False},
            "stylists_api": {"get_all": False},
            "service_catalog_api": {
                "get_categories": False,
                "get_category_by_id": False,
                "get_services": False,
                "get_service_by_id": False,
                "get_sub_services": False,
                "get_sub_services_by_service": False
            },
            "provider_services_toggle_api": {
                "toggle_services": False,
                "get_provider_services": False,
                "update_service": False
            },
            "providers_with_services_api": {
                "get_providers_with_services": False,
                "get_provider_full_profile": False,
                "filter_by_category": False
            },
            "errors": []
        }
        
        # Test data - using realistic data as instructed
        self.test_auth_id = str(uuid.uuid4())
        unique_suffix = str(uuid.uuid4())[:8]
        self.test_user_data = {
            "auth_id": self.test_auth_id,
            "name": f"Amaka Beauty Pro {unique_suffix}",
            "email": f"amaka.beauty.{unique_suffix}@gmail.com",
            "phone": "+2348012345678",
            "role": "customer",
            "phone_verified": False
        }
        
        # Provider ID for testing (as specified in review request)
        self.test_provider_id = 13  # Amaka Beauty Pro
        self.created_service_id = None
        
    def log_error(self, test_name: str, error: str):
        """Log an error for a specific test"""
        error_msg = f"{test_name}: {error}"
        self.test_results["errors"].append(error_msg)
        print(f"❌ {error_msg}")
        
    def log_success(self, test_name: str, message: str = ""):
        """Log a successful test"""
        print(f"✅ {test_name}" + (f": {message}" if message else ""))
        
    def test_connection(self) -> bool:
        """Test basic API connection"""
        try:
            print(f"\n🔗 Testing connection to {self.base_url}")
            response = self.session.get(f"{self.base_url}/test-connection", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.log_success("Connection Test", f"Connected to {data.get('database', 'Unknown DB')}")
                self.test_results["connection"] = True
                return True
            else:
                self.log_error("Connection Test", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_error("Connection Test", f"Request failed: {str(e)}")
            return False
            
    def test_users_api(self) -> Dict[str, bool]:
        """Test Users CRUD API endpoints (regression test)"""
        print(f"\n👥 Testing Users API (Regression)")
        results = {"get_all": False, "create": False, "get_by_auth": False}
        
        # Test GET /api/users
        try:
            response = self.session.get(f"{self.base_url}/users", timeout=10)
            if response.status_code == 200:
                users = response.json()
                self.log_success("GET /api/users", f"Retrieved {len(users)} users")
                results["get_all"] = True
            else:
                self.log_error("GET /api/users", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/users", str(e))
            
        # Test POST /api/users
        try:
            response = self.session.post(
                f"{self.base_url}/users", 
                json=self.test_user_data,
                timeout=10
            )
            if response.status_code == 201:
                user = response.json()
                self.log_success("POST /api/users", f"Created user: {user.get('name')}")
                results["create"] = True
                self.created_user_id = user.get('id')
            else:
                self.log_error("POST /api/users", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("POST /api/users", str(e))
            
        # Test GET /api/users/by-auth/{auth_id}
        try:
            response = self.session.get(f"{self.base_url}/users/by-auth/{self.test_auth_id}", timeout=10)
            if response.status_code == 200:
                user = response.json()
                self.log_success("GET /api/users/by-auth/{auth_id}", f"Found user: {user.get('name')}")
                results["get_by_auth"] = True
            else:
                self.log_error("GET /api/users/by-auth/{auth_id}", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/users/by-auth/{auth_id}", str(e))
            
        self.test_results["users_api"] = results
        return results
        
    def test_stylists_api(self) -> Dict[str, bool]:
        """Test Stylists API endpoints (regression test)"""
        print(f"\n💄 Testing Stylists API (Regression)")
        results = {"get_all": False}
        
        # Test GET /api/stylists
        try:
            response = self.session.get(f"{self.base_url}/stylists", timeout=10)
            if response.status_code == 200:
                stylists = response.json()
                self.log_success("GET /api/stylists", f"Retrieved {len(stylists)} stylists")
                results["get_all"] = True
            else:
                self.log_error("GET /api/stylists", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/stylists", str(e))
            
        self.test_results["stylists_api"] = results
        return results
        
    def test_service_catalog_api(self) -> Dict[str, bool]:
        """Test Service Catalog API endpoints (Phase 1.2)"""
        print(f"\n📋 Testing Service Catalog API (Phase 1.2)")
        results = {
            "get_categories": False,
            "get_category_by_id": False,
            "get_services": False,
            "get_service_by_id": False,
            "get_sub_services": False,
            "get_sub_services_by_service": False
        }
        
        # Test GET /api/catalog/categories - Should return 6 categories
        try:
            response = self.session.get(f"{self.base_url}/catalog/categories", timeout=10)
            if response.status_code == 200:
                categories = response.json()
                if len(categories) == 6:
                    category_names = [cat.get('name', '') for cat in categories]
                    expected_categories = ['Beauty & Grooming', 'Body & Aesthetics', 'Wellness & Care', 'Fashion & Bridal', 'Events & Entertainment', 'Classes & Learning']
                    if all(name in str(category_names) for name in expected_categories):
                        self.log_success("GET /api/catalog/categories", f"Retrieved {len(categories)} categories: {', '.join(category_names)}")
                        results["get_categories"] = True
                    else:
                        self.log_error("GET /api/catalog/categories", f"Missing expected categories. Got: {category_names}")
                else:
                    self.log_error("GET /api/catalog/categories", f"Expected 6 categories, got {len(categories)}")
            else:
                self.log_error("GET /api/catalog/categories", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/catalog/categories", str(e))
            
        # Test GET /api/catalog/categories/beauty-grooming - Should return category with services
        try:
            response = self.session.get(f"{self.base_url}/catalog/categories/beauty-grooming", timeout=10)
            if response.status_code == 200:
                category = response.json()
                if category.get('name') == 'Beauty & Grooming' and 'services' in category:
                    services_count = len(category['services'])
                    self.log_success("GET /api/catalog/categories/beauty-grooming", f"Retrieved Beauty & Grooming category with {services_count} services")
                    results["get_category_by_id"] = True
                else:
                    self.log_error("GET /api/catalog/categories/beauty-grooming", "Invalid category structure or missing services")
            else:
                self.log_error("GET /api/catalog/categories/beauty-grooming", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/catalog/categories/beauty-grooming", str(e))
            
        # Test GET /api/catalog/services - Should return all parent services
        try:
            response = self.session.get(f"{self.base_url}/catalog/services", timeout=10)
            if response.status_code == 200:
                services = response.json()
                if len(services) >= 25:  # Should have 25+ services
                    self.log_success("GET /api/catalog/services", f"Retrieved {len(services)} parent services")
                    results["get_services"] = True
                else:
                    self.log_error("GET /api/catalog/services", f"Expected 25+ services, got {len(services)}")
            else:
                self.log_error("GET /api/catalog/services", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/catalog/services", str(e))
            
        # Test GET /api/catalog/services/barbers - Should return barbers service with 6 sub-services
        try:
            response = self.session.get(f"{self.base_url}/catalog/services/barbers", timeout=10)
            if response.status_code == 200:
                service = response.json()
                if service.get('name') == 'Barbers' and 'sub_services' in service:
                    sub_services_count = len(service['sub_services'])
                    if sub_services_count == 6:
                        self.log_success("GET /api/catalog/services/barbers", f"Retrieved Barbers service with {sub_services_count} sub-services")
                        results["get_service_by_id"] = True
                    else:
                        self.log_error("GET /api/catalog/services/barbers", f"Expected 6 sub-services, got {sub_services_count}")
                else:
                    self.log_error("GET /api/catalog/services/barbers", "Invalid service structure or missing sub-services")
            else:
                self.log_error("GET /api/catalog/services/barbers", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/catalog/services/barbers", str(e))
            
        # Test GET /api/catalog/sub-services - Should return all sub-services (100+)
        try:
            response = self.session.get(f"{self.base_url}/catalog/sub-services", timeout=10)
            if response.status_code == 200:
                sub_services = response.json()
                if len(sub_services) >= 100:
                    self.log_success("GET /api/catalog/sub-services", f"Retrieved {len(sub_services)} sub-services")
                    results["get_sub_services"] = True
                else:
                    self.log_error("GET /api/catalog/sub-services", f"Expected 100+ sub-services, got {len(sub_services)}")
            else:
                self.log_error("GET /api/catalog/sub-services", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/catalog/sub-services", str(e))
            
        # Test GET /api/catalog/sub-services/barbers - Should return 6 sub-services for barbers
        try:
            response = self.session.get(f"{self.base_url}/catalog/sub-services/barbers", timeout=10)
            if response.status_code == 200:
                sub_services = response.json()
                if len(sub_services) == 6:
                    sub_service_names = [sub.get('name', '') for sub in sub_services]
                    self.log_success("GET /api/catalog/sub-services/barbers", f"Retrieved {len(sub_services)} barber sub-services: {', '.join(sub_service_names[:3])}...")
                    results["get_sub_services_by_service"] = True
                else:
                    self.log_error("GET /api/catalog/sub-services/barbers", f"Expected 6 sub-services, got {len(sub_services)}")
            else:
                self.log_error("GET /api/catalog/sub-services/barbers", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/catalog/sub-services/barbers", str(e))
            
        self.test_results["service_catalog_api"] = results
        return results
        
    def test_provider_services_toggle_api(self) -> Dict[str, bool]:
        """Test Enhanced Provider Services Toggle API (Phase 1.3)"""
        print(f"\n🔄 Testing Provider Services Toggle API (Phase 1.3)")
        results = {"toggle_services": False, "get_provider_services": False, "update_service": False}
        
        # Test POST /api/provider-services/toggle/{provider_id} - Bulk toggle services
        try:
            toggle_data = {
                "services": [
                    {
                        "sub_service_id": "box-braids",
                        "sub_service_name": "Box Braids",
                        "service_id": "hair-braiders",
                        "category_id": "beauty-grooming",
                        "is_active": True,
                        "price": 15000,
                        "duration_minutes": 240,
                        "in_store": True,
                        "home_service": True,
                        "travel_service": False
                    }
                ]
            }
            response = self.session.post(
                f"{self.base_url}/provider-services/toggle/{self.test_provider_id}", 
                json=toggle_data,
                timeout=10
            )
            if response.status_code == 200:
                result = response.json()
                services_count = len(result.get('services', []))
                self.log_success("POST /api/provider-services/toggle/{provider_id}", f"Successfully toggled {services_count} services for provider {self.test_provider_id}")
                results["toggle_services"] = True
                
                # Store service ID for update test
                if result.get('services') and len(result['services']) > 0:
                    self.created_service_id = result['services'][0].get('id')
            else:
                self.log_error("POST /api/provider-services/toggle/{provider_id}", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("POST /api/provider-services/toggle/{provider_id}", str(e))
            
        # Test GET /api/provider-services/{provider_id} - Should return toggled services
        try:
            response = self.session.get(f"{self.base_url}/provider-services/{self.test_provider_id}", timeout=10)
            if response.status_code == 200:
                services = response.json()
                active_services = [s for s in services if s.get('is_active', False)]
                self.log_success("GET /api/provider-services/{provider_id}", f"Retrieved {len(services)} services ({len(active_services)} active) for provider {self.test_provider_id}")
                results["get_provider_services"] = True
            else:
                self.log_error("GET /api/provider-services/{provider_id}", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/provider-services/{provider_id}", str(e))
            
        # Test PUT /api/provider-services/{service_id} - Update individual service
        if self.created_service_id:
            try:
                update_data = {
                    "price": 18000,
                    "duration_minutes": 300,
                    "is_active": True,
                    "home_service": False,
                    "travel_service": True
                }
                response = self.session.put(
                    f"{self.base_url}/provider-services/{self.created_service_id}", 
                    json=update_data,
                    timeout=10
                )
                if response.status_code == 200:
                    service = response.json()
                    self.log_success("PUT /api/provider-services/{service_id}", f"Updated service: ₦{service.get('price')}, {service.get('duration_minutes')} mins, travel: {service.get('travel_service')}")
                    results["update_service"] = True
                else:
                    self.log_error("PUT /api/provider-services/{service_id}", f"HTTP {response.status_code}: {response.text}")
            except Exception as e:
                self.log_error("PUT /api/provider-services/{service_id}", str(e))
        else:
            self.log_error("PUT /api/provider-services/{service_id}", "No service created to test update")
            
        self.test_results["provider_services_toggle_api"] = results
        return results
    def test_providers_with_services_api(self) -> Dict[str, bool]:
        """Test Providers with Services Listing API (Phase 1.4)"""
        print(f"\n👥 Testing Providers with Services API (Phase 1.4)")
        results = {"get_providers_with_services": False, "get_provider_full_profile": False, "filter_by_category": False}
        
        # Test GET /api/providers/with-services - Should return only providers with active services
        try:
            response = self.session.get(f"{self.base_url}/providers/with-services", timeout=10)
            if response.status_code == 200:
                providers = response.json()
                if len(providers) > 0:
                    # Check structure of first provider
                    first_provider = providers[0]
                    required_fields = ['provider_id', 'name', 'starting_price', 'primary_service', 'active_service_count', 'services']
                    if all(field in first_provider for field in required_fields):
                        self.log_success("GET /api/providers/with-services", f"Retrieved {len(providers)} providers with services. First provider: {first_provider.get('name')} ({first_provider.get('active_service_count')} services, starting at ₦{first_provider.get('starting_price')})")
                        results["get_providers_with_services"] = True
                    else:
                        missing_fields = [field for field in required_fields if field not in first_provider]
                        self.log_error("GET /api/providers/with-services", f"Missing required fields: {missing_fields}")
                else:
                    self.log_error("GET /api/providers/with-services", "No providers with services found")
            else:
                self.log_error("GET /api/providers/with-services", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/providers/with-services", str(e))
            
        # Test GET /api/providers/with-services?category_id=beauty-grooming - Filter by category
        try:
            response = self.session.get(f"{self.base_url}/providers/with-services?category_id=beauty-grooming", timeout=10)
            if response.status_code == 200:
                providers = response.json()
                # Check that all providers have beauty-grooming services
                valid_filter = True
                for provider in providers:
                    services = provider.get('services', [])
                    if not any(service.get('category_id') == 'beauty-grooming' for service in services):
                        valid_filter = False
                        break
                
                if valid_filter:
                    self.log_success("GET /api/providers/with-services?category_id=beauty-grooming", f"Retrieved {len(providers)} providers with beauty-grooming services")
                    results["filter_by_category"] = True
                else:
                    self.log_error("GET /api/providers/with-services?category_id=beauty-grooming", "Filter not working correctly - found providers without beauty-grooming services")
            else:
                self.log_error("GET /api/providers/with-services?category_id=beauty-grooming", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/providers/with-services?category_id=beauty-grooming", str(e))
            
        # Test GET /api/providers/{provider_id}/full-profile - Get full provider profile with all services
        try:
            response = self.session.get(f"{self.base_url}/providers/{self.test_provider_id}/full-profile", timeout=10)
            if response.status_code == 200:
                profile = response.json()
                required_fields = ['provider_id', 'name', 'total_services', 'services', 'services_by_category']
                if all(field in profile for field in required_fields):
                    services_count = profile.get('total_services', 0)
                    categories_count = len(profile.get('services_by_category', {}))
                    self.log_success("GET /api/providers/{provider_id}/full-profile", f"Retrieved full profile for provider {self.test_provider_id}: {profile.get('name')} ({services_count} services across {categories_count} categories)")
                    results["get_provider_full_profile"] = True
                else:
                    missing_fields = [field for field in required_fields if field not in profile]
                    self.log_error("GET /api/providers/{provider_id}/full-profile", f"Missing required fields: {missing_fields}")
            else:
                self.log_error("GET /api/providers/{provider_id}/full-profile", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/providers/{provider_id}/full-profile", str(e))
            
        self.test_results["providers_with_services_api"] = results
        return results
        """Clean up test data created during testing"""
        print(f"\n🧹 Cleaning up test data...")
        
        # Delete test user (this should cascade to stylist and wallet)
        if hasattr(self, 'created_user_id') and self.created_user_id:
            try:
                response = self.session.delete(f"{self.base_url}/users/{self.created_user_id}", timeout=10)
                if response.status_code == 204:
                    self.log_success("Cleanup", "Test user deleted successfully")
                elif response.status_code == 500:
                    print(f"⚠️ Could not delete test user due to database constraints (this is expected with foreign key relationships)")
                else:
                    print(f"⚠️ Could not delete test user: HTTP {response.status_code}")
            except Exception as e:
                print(f"⚠️ Error during cleanup: {str(e)}")
                
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all backend API tests"""
        print("🚀 Starting Backend API Tests for Beauty Stylist Marketplace")
        print(f"Testing against: {self.base_url}")
        
        # Test connection first
        if not self.test_connection():
            print("\n❌ Connection failed - aborting tests")
            return self.test_results
            
        # Run API tests
        self.test_users_api()
        self.test_stylists_api()
        self.test_wallets_api()
        self.test_provider_services_api()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Print summary
        self.print_summary()
        
        return self.test_results
        
    def print_summary(self):
        """Print test results summary"""
        print(f"\n📊 TEST SUMMARY")
        print("=" * 50)
        
        total_tests = 0
        passed_tests = 0
        
        # Connection
        total_tests += 1
        if self.test_results["connection"]:
            passed_tests += 1
            print("✅ Database Connection: PASSED")
        else:
            print("❌ Database Connection: FAILED")
            
        # Users API
        for test, result in self.test_results["users_api"].items():
            total_tests += 1
            if result:
                passed_tests += 1
                print(f"✅ Users API - {test}: PASSED")
            else:
                print(f"❌ Users API - {test}: FAILED")
                
        # Stylists API
        for test, result in self.test_results["stylists_api"].items():
            total_tests += 1
            if result:
                passed_tests += 1
                print(f"✅ Stylists API - {test}: PASSED")
            else:
                print(f"❌ Stylists API - {test}: FAILED")
                
        # Wallets API
        for test, result in self.test_results["wallets_api"].items():
            total_tests += 1
            if result:
                passed_tests += 1
                print(f"✅ Wallets API - {test}: PASSED")
            else:
                print(f"❌ Wallets API - {test}: FAILED")
                
        # Provider Services API
        for test, result in self.test_results["provider_services_api"].items():
            total_tests += 1
            if result:
                passed_tests += 1
                print(f"✅ Provider Services API - {test}: PASSED")
            else:
                print(f"❌ Provider Services API - {test}: FAILED")
                
        print("=" * 50)
        print(f"TOTAL: {passed_tests}/{total_tests} tests passed")
        
        if self.test_results["errors"]:
            print(f"\n🚨 ERRORS ENCOUNTERED:")
            for error in self.test_results["errors"]:
                print(f"  • {error}")
                
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = BackendTester()
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    all_passed = all([
        results["connection"],
        all(results["users_api"].values()),
        all(results["stylists_api"].values()),
        all(results["wallets_api"].values()),
        all(results["provider_services_api"].values())
    ])
    
    sys.exit(0 if all_passed else 1)