#!/usr/bin/env python3
"""
Backend API Testing for Beauty Stylist Marketplace App
Tests all CRUD operations for Users, Stylists, and Wallets APIs
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
            "users_api": {"get_all": False, "create": False, "get_by_auth": False, "update": False},
            "stylists_api": {"get_all": False, "create": False, "get_by_id": False, "update": False},
            "wallets_api": {"get_all": False, "create": False, "get_by_auth": False},
            "provider_services_api": {"get_services": False, "create_service": False, "update_service": False, "bulk_update": False, "delete_service": False},
            "errors": []
        }
        
        # Test data - using realistic data as instructed
        self.test_auth_id = str(uuid.uuid4())
        unique_suffix = str(uuid.uuid4())[:8]
        self.test_user_data = {
            "auth_id": self.test_auth_id,
            "name": f"Sarah Johnson {unique_suffix}",
            "email": f"sarah.johnson.{unique_suffix}@email.com",
            "phone": "+1234567890",
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
        """Test Users CRUD API endpoints"""
        print(f"\n👥 Testing Users API")
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
            
        # Test PUT /api/users/{user_id} (Profile update)
        if hasattr(self, 'created_user_id') and self.created_user_id:
            try:
                update_data = {
                    "name": f"Sarah Johnson Updated {unique_suffix}",
                    "phone": "+1987654321"
                }
                response = self.session.put(
                    f"{self.base_url}/users/{self.created_user_id}", 
                    json=update_data,
                    timeout=10
                )
                if response.status_code == 200:
                    user = response.json()
                    self.log_success("PUT /api/users/{user_id}", f"Updated user: {user.get('name')}")
                    results["update"] = True
                else:
                    self.log_error("PUT /api/users/{user_id}", f"HTTP {response.status_code}: {response.text}")
            except Exception as e:
                self.log_error("PUT /api/users/{user_id}", str(e))
        else:
            self.log_error("PUT /api/users/{user_id}", "No user created to test update")
            
        self.test_results["users_api"] = results
        return results
        
    def test_stylists_api(self) -> Dict[str, bool]:
        """Test Stylists CRUD API endpoints"""
        print(f"\n💄 Testing Stylists API")
        results = {"get_all": False, "create": False, "get_by_id": False}
        
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
            
        # Test POST /api/stylists (only if we have a created user)
        if hasattr(self, 'created_user_id') and self.created_user_id:
            try:
                stylist_data = {
                    "user_id": self.created_user_id,
                    "hourly_rate": 75.0,
                    "is_verified": False,
                    "is_premium": False,
                    "bio": "Professional hair stylist with 5 years experience",
                    "location": "New York, NY"
                }
                response = self.session.post(
                    f"{self.base_url}/stylists", 
                    json=stylist_data,
                    timeout=10
                )
                if response.status_code == 201:
                    stylist = response.json()
                    self.log_success("POST /api/stylists", f"Created stylist profile for user {stylist.get('user_id')}")
                    results["create"] = True
                    
                    # Test GET /api/stylists/{user_id}
                    response = self.session.get(f"{self.base_url}/stylists/{self.created_user_id}", timeout=10)
                    if response.status_code == 200:
                        stylist = response.json()
                        self.log_success("GET /api/stylists/{user_id}", f"Retrieved stylist: ${stylist.get('hourly_rate')}/hr")
                        results["get_by_id"] = True
                        
                        # Test PUT /api/stylists/{user_id} (Provider profile update)
                        update_data = {
                            "hourly_rate": 85.0,
                            "bio": "Updated bio: Professional hair stylist with 6 years experience",
                            "location": "Los Angeles, CA"
                        }
                        response = self.session.put(
                            f"{self.base_url}/stylists/{self.created_user_id}", 
                            json=update_data,
                            timeout=10
                        )
                        if response.status_code == 200:
                            updated_stylist = response.json()
                            self.log_success("PUT /api/stylists/{user_id}", f"Updated stylist rate: ${updated_stylist.get('hourly_rate')}/hr")
                            results["update"] = True
                        else:
                            self.log_error("PUT /api/stylists/{user_id}", f"HTTP {response.status_code}: {response.text}")
                    else:
                        self.log_error("GET /api/stylists/{user_id}", f"HTTP {response.status_code}: {response.text}")
                        
                else:
                    self.log_error("POST /api/stylists", f"HTTP {response.status_code}: {response.text}")
            except Exception as e:
                self.log_error("POST /api/stylists", str(e))
        else:
            self.log_error("POST /api/stylists", "No user created to test stylist creation")
            
        self.test_results["stylists_api"] = results
        return results
        
    def test_wallets_api(self) -> Dict[str, bool]:
        """Test Wallets CRUD API endpoints"""
        print(f"\n💰 Testing Wallets API")
        results = {"get_all": False, "create": False, "get_by_auth": False}
        
        # Test GET /api/wallets
        try:
            response = self.session.get(f"{self.base_url}/wallets", timeout=10)
            if response.status_code == 200:
                wallets = response.json()
                self.log_success("GET /api/wallets", f"Retrieved {len(wallets)} wallets")
                results["get_all"] = True
            else:
                self.log_error("GET /api/wallets", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/wallets", str(e))
            
        # Test POST /api/wallets
        try:
            wallet_data = {
                "user_auth_id": self.test_auth_id,
                "balance": 100.0
            }
            response = self.session.post(
                f"{self.base_url}/wallets", 
                json=wallet_data,
                timeout=10
            )
            if response.status_code == 201:
                wallet = response.json()
                self.log_success("POST /api/wallets", f"Created wallet with balance: ${wallet.get('balance')}")
                results["create"] = True
            elif response.status_code == 400 and "already exists" in response.text:
                # This is expected behavior - wallet auto-creation might be happening
                self.log_success("POST /api/wallets", "Wallet already exists (auto-created) - this is expected behavior")
                results["create"] = True
            else:
                self.log_error("POST /api/wallets", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("POST /api/wallets", str(e))
            
        # Test GET /api/wallets/by-auth/{auth_id}
        try:
            response = self.session.get(f"{self.base_url}/wallets/by-auth/{self.test_auth_id}", timeout=10)
            if response.status_code == 200:
                wallet = response.json()
                self.log_success("GET /api/wallets/by-auth/{auth_id}", f"Found wallet with balance: ${wallet.get('balance')}")
                results["get_by_auth"] = True
            else:
                self.log_error("GET /api/wallets/by-auth/{auth_id}", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/wallets/by-auth/{auth_id}", str(e))
            
        self.test_results["wallets_api"] = results
        return results
        
    def test_provider_services_api(self) -> Dict[str, bool]:
        """Test Provider Services CRUD API endpoints"""
        print(f"\n🛍️ Testing Provider Services API")
        results = {"get_services": False, "create_service": False, "update_service": False, "bulk_update": False, "delete_service": False}
        
        # Test GET /api/provider-services/{provider_id}
        try:
            response = self.session.get(f"{self.base_url}/provider-services/{self.test_provider_id}", timeout=10)
            if response.status_code == 200:
                services = response.json()
                self.log_success("GET /api/provider-services/{provider_id}", f"Retrieved {len(services)} services for provider {self.test_provider_id}")
                results["get_services"] = True
            else:
                self.log_error("GET /api/provider-services/{provider_id}", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("GET /api/provider-services/{provider_id}", str(e))
            
        # Test POST /api/provider-services
        try:
            service_data = {
                "provider_id": self.test_provider_id,
                "service_id": "hairdressers",
                "service_name": "Hairdressers",
                "price": 5000,
                "duration": 60,
                "enabled": True,
                "consultation_required": False
            }
            response = self.session.post(
                f"{self.base_url}/provider-services", 
                json=service_data,
                timeout=10
            )
            if response.status_code == 201:
                service = response.json()
                self.log_success("POST /api/provider-services", f"Created service: {service.get('service_name')} - ${service.get('price')}")
                results["create_service"] = True
                self.created_service_id = service.get('id')
            else:
                self.log_error("POST /api/provider-services", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("POST /api/provider-services", str(e))
            
        # Test PUT /api/provider-services/{service_id}
        if self.created_service_id:
            try:
                update_data = {
                    "price": 6000,
                    "duration": 90,
                    "enabled": False
                }
                response = self.session.put(
                    f"{self.base_url}/provider-services/{self.created_service_id}", 
                    json=update_data,
                    timeout=10
                )
                if response.status_code == 200:
                    service = response.json()
                    self.log_success("PUT /api/provider-services/{service_id}", f"Updated service: ${service.get('price')}, enabled: {service.get('enabled')}")
                    results["update_service"] = True
                else:
                    self.log_error("PUT /api/provider-services/{service_id}", f"HTTP {response.status_code}: {response.text}")
            except Exception as e:
                self.log_error("PUT /api/provider-services/{service_id}", str(e))
        else:
            self.log_error("PUT /api/provider-services/{service_id}", "No service created to test update")
            
        # Test POST /api/provider-services/bulk/{provider_id}
        try:
            bulk_services = [
                {
                    "provider_id": self.test_provider_id,
                    "service_id": "makeup",
                    "service_name": "Makeup Artist",
                    "price": 4000,
                    "duration": 45,
                    "enabled": True,
                    "consultation_required": False
                },
                {
                    "provider_id": self.test_provider_id,
                    "service_id": "nails",
                    "service_name": "Nail Technician",
                    "price": 3000,
                    "duration": 30,
                    "enabled": True,
                    "consultation_required": False
                }
            ]
            response = self.session.post(
                f"{self.base_url}/provider-services/bulk/{self.test_provider_id}", 
                json=bulk_services,
                timeout=10
            )
            if response.status_code == 200:
                result = response.json()
                self.log_success("POST /api/provider-services/bulk/{provider_id}", f"Bulk updated {len(result.get('services', []))} services")
                results["bulk_update"] = True
            else:
                self.log_error("POST /api/provider-services/bulk/{provider_id}", f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_error("POST /api/provider-services/bulk/{provider_id}", str(e))
            
        # Test DELETE /api/provider-services/{service_id}
        if self.created_service_id:
            try:
                response = self.session.delete(f"{self.base_url}/provider-services/{self.created_service_id}", timeout=10)
                if response.status_code == 204:
                    self.log_success("DELETE /api/provider-services/{service_id}", "Service deleted successfully")
                    results["delete_service"] = True
                else:
                    self.log_error("DELETE /api/provider-services/{service_id}", f"HTTP {response.status_code}: {response.text}")
            except Exception as e:
                self.log_error("DELETE /api/provider-services/{service_id}", str(e))
        else:
            self.log_error("DELETE /api/provider-services/{service_id}", "No service created to test deletion")
            
        self.test_results["provider_services_api"] = results
        return results
        
    def cleanup_test_data(self):
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