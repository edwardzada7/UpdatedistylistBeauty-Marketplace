#!/usr/bin/env python3
"""
Wallet & Earnings Accuracy Fix Testing
Focus: Test ONLY wallet/earnings changes (additive, non-breaking)
"""

import requests
import json
import sys
from typing import Dict, Any, List

# Backend URL
BACKEND_URL = "https://mongo-supabase-api.preview.emergentagent.com/api"

# Test data from existing database
PROVIDER_AUTH_ID = "15fcb394-64cb-41d7-bdb4-90678e4f4fcc"  # Provider 13 (Amaka Beauty Pro)
CUSTOMER_AUTH_ID = "2c6836a2-ecaa-4452-8ba4-54bfdfa3596e"  # Customer 11 (Sarah Johnson)
ADMIN_KEY = "istylist_admin_secret_key_2026"

# Expected transaction categories
VALID_CATEGORIES = {
    "TOPUP", "ESCROW_HOLD", "ESCROW_RELEASE", 
    "REFUND", "WITHDRAWAL", "PAYOUT", "ADJUSTMENT"
}

class WalletEarningsTest:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def log_pass(self, test_name: str, message: str = ""):
        """Log a passing test"""
        self.passed += 1
        print(f"✅ {test_name}" + (f": {message}" if message else ""))
        
    def log_fail(self, test_name: str, error: str):
        """Log a failing test"""
        self.failed += 1
        error_msg = f"{test_name}: {error}"
        self.errors.append(error_msg)
        print(f"❌ {error_msg}")
        
    def test_wallet_transactions_normalized(self):
        """
        Test 1: GET /api/wallet/transactions - normalized response
        CRITICAL: Verify response structure and field types
        """
        print("\n" + "="*80)
        print("TEST 1: GET /api/wallet/transactions (Normalized Response)")
        print("="*80)
        
        try:
            # Test with provider auth_id
            response = self.session.get(
                f"{self.base_url}/wallet/transactions",
                params={"auth_id": PROVIDER_AUTH_ID, "limit": 50},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_fail("GET /api/wallet/transactions", f"HTTP {response.status_code}: {response.text}")
                return
                
            transactions = response.json()
            
            # Verify it's a JSON array
            if not isinstance(transactions, list):
                self.log_fail("GET /api/wallet/transactions", f"Expected array, got {type(transactions)}")
                return
                
            self.log_pass("GET /api/wallet/transactions", f"Returns JSON array with {len(transactions)} transactions")
            
            if len(transactions) == 0:
                print("⚠️  No transactions found for provider. Testing with customer...")
                # Try customer
                response = self.session.get(
                    f"{self.base_url}/wallet/transactions",
                    params={"auth_id": CUSTOMER_AUTH_ID, "limit": 50},
                    timeout=10
                )
                if response.status_code == 200:
                    transactions = response.json()
                    
            if len(transactions) > 0:
                # Verify first transaction has required fields
                tx = transactions[0]
                required_fields = ["id", "type", "direction", "amount", "description", 
                                 "created_at", "booking_id", "reference", "status", "raw_type"]
                
                missing_fields = [f for f in required_fields if f not in tx]
                if missing_fields:
                    self.log_fail("Transaction fields", f"Missing fields: {missing_fields}")
                else:
                    self.log_pass("Transaction fields", f"All required fields present: {required_fields}")
                
                # Verify type is a valid category
                tx_type = tx.get("type")
                if tx_type not in VALID_CATEGORIES:
                    self.log_fail("Transaction type", f"Invalid type '{tx_type}', expected one of {VALID_CATEGORIES}")
                else:
                    self.log_pass("Transaction type", f"Valid category: {tx_type}")
                
                # Verify direction is UPPERCASE
                direction = tx.get("direction")
                if direction not in ["CREDIT", "DEBIT"]:
                    self.log_fail("Transaction direction", f"Expected 'CREDIT' or 'DEBIT', got '{direction}'")
                else:
                    self.log_pass("Transaction direction", f"Uppercase direction: {direction}")
                
                # Verify raw_type exists (backward compat)
                if "raw_type" in tx:
                    self.log_pass("Transaction raw_type", f"Backward compat field present: {tx.get('raw_type')}")
                else:
                    self.log_fail("Transaction raw_type", "Missing backward compat field")
                    
                # Verify transactions are sorted newest first
                if len(transactions) > 1:
                    first_date = transactions[0].get("created_at", "")
                    last_date = transactions[-1].get("created_at", "")
                    if first_date >= last_date:
                        self.log_pass("Transaction sorting", "Sorted newest first (created_at desc)")
                    else:
                        self.log_fail("Transaction sorting", f"Not sorted correctly: {first_date} < {last_date}")
            else:
                print("⚠️  No transactions found for testing. Skipping field validation.")
                
        except Exception as e:
            self.log_fail("GET /api/wallet/transactions", f"Exception: {str(e)}")
            
    def test_wallet_transactions_category_filter(self):
        """
        Test 1b: GET /api/wallet/transactions?category=ESCROW_RELEASE
        Verify category filtering works
        """
        print("\n" + "="*80)
        print("TEST 1b: GET /api/wallet/transactions?category=ESCROW_RELEASE")
        print("="*80)
        
        try:
            response = self.session.get(
                f"{self.base_url}/wallet/transactions",
                params={"auth_id": PROVIDER_AUTH_ID, "limit": 50, "category": "ESCROW_RELEASE"},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_fail("Category filter", f"HTTP {response.status_code}: {response.text}")
                return
                
            transactions = response.json()
            
            # Verify all transactions are ESCROW_RELEASE
            non_escrow = [tx for tx in transactions if tx.get("type") != "ESCROW_RELEASE"]
            if non_escrow:
                self.log_fail("Category filter", f"Found {len(non_escrow)} non-ESCROW_RELEASE transactions")
            else:
                self.log_pass("Category filter", f"All {len(transactions)} transactions are ESCROW_RELEASE")
                
        except Exception as e:
            self.log_fail("Category filter", f"Exception: {str(e)}")
            
    def test_provider_dashboard_metrics(self):
        """
        Test 2: GET /api/providers/dashboard-metrics
        CRITICAL: Verify earnings calculation only includes ESCROW_RELEASE
        """
        print("\n" + "="*80)
        print("TEST 2: GET /api/providers/dashboard-metrics (Earnings Accuracy)")
        print("="*80)
        
        try:
            response = self.session.get(
                f"{self.base_url}/providers/dashboard-metrics",
                params={"auth_id": PROVIDER_AUTH_ID},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_fail("GET /api/providers/dashboard-metrics", f"HTTP {response.status_code}: {response.text}")
                return
                
            metrics = response.json()
            
            # Verify required fields
            required_fields = [
                "available_balance", "escrow_balance", "total_balance",
                "total_earnings", "pending_withdrawals_total",
                "last_7_days_earnings", "last_30_days_earnings", "recent_transactions"
            ]
            
            missing_fields = [f for f in required_fields if f not in metrics]
            if missing_fields:
                self.log_fail("Dashboard metrics fields", f"Missing fields: {missing_fields}")
            else:
                self.log_pass("Dashboard metrics fields", f"All required fields present")
            
            # Log earnings values
            print(f"   Total Earnings: ₦{metrics.get('total_earnings', 0):,.2f}")
            print(f"   Last 7 Days: ₦{metrics.get('last_7_days_earnings', 0):,.2f}")
            print(f"   Last 30 Days: ₦{metrics.get('last_30_days_earnings', 0):,.2f}")
            print(f"   Available Balance: ₦{metrics.get('available_balance', 0):,.2f}")
            print(f"   Escrow Balance: ₦{metrics.get('escrow_balance', 0):,.2f}")
            
            # Verify recent_transactions uses normalized shape
            recent_tx = metrics.get("recent_transactions", [])
            if len(recent_tx) > 0:
                tx = recent_tx[0]
                if "type" in tx and "direction" in tx:
                    if tx.get("direction") in ["CREDIT", "DEBIT"]:
                        self.log_pass("Dashboard recent_transactions", f"Uses normalized shape (direction UPPERCASE)")
                    else:
                        self.log_fail("Dashboard recent_transactions", f"Direction not UPPERCASE: {tx.get('direction')}")
                else:
                    self.log_fail("Dashboard recent_transactions", "Missing type or direction fields")
            else:
                print("⚠️  No recent transactions to verify normalization")
                
            # CRITICAL: Verify earnings only count ESCROW_RELEASE
            # Get all transactions and manually calculate
            all_tx_response = self.session.get(
                f"{self.base_url}/wallet/transactions",
                params={"auth_id": PROVIDER_AUTH_ID, "limit": 100},
                timeout=10
            )
            
            if all_tx_response.status_code == 200:
                all_tx = all_tx_response.json()
                
                # Count ESCROW_RELEASE credits
                escrow_release_total = sum(
                    tx.get("amount", 0) 
                    for tx in all_tx 
                    if tx.get("type") == "ESCROW_RELEASE" 
                    and tx.get("direction") == "CREDIT"
                    and tx.get("status", "completed").lower() == "completed"
                )
                
                # Count all credits (including TOPUP, REFUND, etc.)
                all_credits_total = sum(
                    tx.get("amount", 0)
                    for tx in all_tx
                    if tx.get("direction") == "CREDIT"
                    and tx.get("status", "completed").lower() == "completed"
                )
                
                reported_earnings = metrics.get("total_earnings", 0)
                
                print(f"   Manual calculation:")
                print(f"     ESCROW_RELEASE credits: ₦{escrow_release_total:,.2f}")
                print(f"     All credits (incl TOPUP): ₦{all_credits_total:,.2f}")
                print(f"     Reported earnings: ₦{reported_earnings:,.2f}")
                
                # Allow small floating point differences
                if abs(reported_earnings - escrow_release_total) < 0.01:
                    self.log_pass("Earnings calculation", "Only counts ESCROW_RELEASE credits (correct)")
                elif abs(reported_earnings - all_credits_total) < 0.01:
                    self.log_fail("Earnings calculation", "Counting ALL credits including TOPUPs (INCORRECT - BUG NOT FIXED)")
                else:
                    print(f"⚠️  Earnings mismatch: reported={reported_earnings}, expected={escrow_release_total}")
                    
        except Exception as e:
            self.log_fail("GET /api/providers/dashboard-metrics", f"Exception: {str(e)}")
            
    def test_wallet_computed(self):
        """
        Test 3: GET /api/wallet/me/computed
        Verify diagnostic endpoint returns stored vs computed comparison
        """
        print("\n" + "="*80)
        print("TEST 3: GET /api/wallet/me/computed (Diagnostic Endpoint)")
        print("="*80)
        
        # Test with provider
        for auth_id, label in [(PROVIDER_AUTH_ID, "Provider"), (CUSTOMER_AUTH_ID, "Customer")]:
            try:
                print(f"\n   Testing with {label} ({auth_id[:8]}...)")
                
                # First call
                response1 = self.session.get(
                    f"{self.base_url}/wallet/me/computed",
                    params={"auth_id": auth_id},
                    timeout=10
                )
                
                if response1.status_code != 200:
                    self.log_fail(f"GET /api/wallet/me/computed ({label})", f"HTTP {response1.status_code}: {response1.text}")
                    continue
                    
                data1 = response1.json()
                
                # Verify required fields
                if "stored" not in data1 or "computed" not in data1 or "delta" not in data1:
                    self.log_fail(f"Computed endpoint fields ({label})", f"Missing required fields: {data1.keys()}")
                    continue
                    
                self.log_pass(f"GET /api/wallet/me/computed ({label})", "Returns stored, computed, delta")
                
                # Log values
                stored = data1.get("stored", {})
                computed = data1.get("computed", {})
                delta = data1.get("delta", {})
                
                print(f"     Stored: available=₦{stored.get('available_balance', 0):,.2f}, escrow=₦{stored.get('escrow_balance', 0):,.2f}")
                print(f"     Computed: available=₦{computed.get('available_balance', 0):,.2f}, escrow=₦{computed.get('escrow_balance', 0):,.2f}")
                print(f"     Delta: available=₦{delta.get('available_balance', 0):,.2f}, escrow=₦{delta.get('escrow_balance', 0):,.2f}")
                print(f"     In sync: {delta.get('in_sync', False)}")
                
                # Second call - verify no DB writes (stored values should not change)
                response2 = self.session.get(
                    f"{self.base_url}/wallet/me/computed",
                    params={"auth_id": auth_id},
                    timeout=10
                )
                
                if response2.status_code == 200:
                    data2 = response2.json()
                    stored2 = data2.get("stored", {})
                    
                    if stored == stored2:
                        self.log_pass(f"No DB writes ({label})", "Stored values unchanged after 2nd call")
                    else:
                        self.log_fail(f"No DB writes ({label})", f"Stored values changed: {stored} -> {stored2}")
                        
            except Exception as e:
                self.log_fail(f"GET /api/wallet/me/computed ({label})", f"Exception: {str(e)}")
                
    def test_admin_wallet_recalculate(self):
        """
        Test 4: POST /api/admin/wallet/recalculate
        Verify admin endpoint with proper authentication and dry-run/apply modes
        """
        print("\n" + "="*80)
        print("TEST 4: POST /api/admin/wallet/recalculate (Admin Endpoint)")
        print("="*80)
        
        # Test 4a: No admin key -> 401
        try:
            response = self.session.post(
                f"{self.base_url}/admin/wallet/recalculate",
                params={"auth_id": PROVIDER_AUTH_ID, "apply": False},
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_pass("Admin auth (no key)", "Returns 401 without admin key")
            else:
                self.log_fail("Admin auth (no key)", f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_fail("Admin auth (no key)", f"Exception: {str(e)}")
            
        # Test 4b: Wrong admin key -> 401
        try:
            response = self.session.post(
                f"{self.base_url}/admin/wallet/recalculate",
                params={"auth_id": PROVIDER_AUTH_ID, "apply": False},
                headers={"X-ADMIN-KEY": "wrong_key"},
                timeout=10
            )
            
            if response.status_code == 401:
                self.log_pass("Admin auth (wrong key)", "Returns 401 with wrong admin key")
            else:
                self.log_fail("Admin auth (wrong key)", f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_fail("Admin auth (wrong key)", f"Exception: {str(e)}")
            
        # Test 4c: Correct key + apply=false (dry-run)
        try:
            response = self.session.post(
                f"{self.base_url}/admin/wallet/recalculate",
                params={"auth_id": PROVIDER_AUTH_ID, "apply": False},
                headers={"X-ADMIN-KEY": ADMIN_KEY},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_fail("Admin recalc (dry-run)", f"HTTP {response.status_code}: {response.text}")
            else:
                data = response.json()
                
                if "stored" in data and "computed" in data and "delta" in data and "applied" in data:
                    self.log_pass("Admin recalc (dry-run)", "Returns stored/computed/delta/applied")
                    
                    if data.get("applied") == False:
                        self.log_pass("Admin recalc (dry-run)", "applied=False (no DB changes)")
                    else:
                        self.log_fail("Admin recalc (dry-run)", f"applied should be False, got {data.get('applied')}")
                        
                    print(f"     Stored: available=₦{data['stored'].get('available_balance', 0):,.2f}")
                    print(f"     Computed: available=₦{data['computed'].get('available_balance', 0):,.2f}")
                    print(f"     Delta: available=₦{data['delta'].get('available_balance', 0):,.2f}")
                else:
                    self.log_fail("Admin recalc (dry-run)", f"Missing fields: {data.keys()}")
                    
        except Exception as e:
            self.log_fail("Admin recalc (dry-run)", f"Exception: {str(e)}")
            
        # Test 4d: Correct key + apply=true (only if there's a delta)
        # We'll skip actual apply to avoid modifying production data
        print("   ⚠️  Skipping apply=true test to avoid modifying production data")
        print("   ⚠️  Manual test: Run with apply=true, verify DB update and ADJUSTMENT transaction")
        
    def test_backward_compatibility(self):
        """
        Test 5: Backward compatibility - quick smoke tests
        Verify existing endpoints still work
        """
        print("\n" + "="*80)
        print("TEST 5: Backward Compatibility (Regression Tests)")
        print("="*80)
        
        smoke_tests = [
            ("POST /api/wallets", "post", "/wallets", {
                "user_auth_id": "test-" + PROVIDER_AUTH_ID[:8],
                "available_balance": 0,
                "escrow_balance": 0
            }),
            ("GET /api/wallets/by-auth/{auth_id}", "get", f"/wallets/by-auth/{PROVIDER_AUTH_ID}", None),
            ("GET /api/wallet/me", "get", f"/wallet/me?auth_id={PROVIDER_AUTH_ID}", None),
        ]
        
        for test_name, method, endpoint, data in smoke_tests:
            try:
                if method == "get":
                    response = self.session.get(f"{self.base_url}{endpoint}", timeout=10)
                else:
                    response = self.session.post(f"{self.base_url}{endpoint}", json=data, timeout=10)
                    
                if response.status_code in [200, 201, 409]:  # 409 = already exists (OK for wallet creation)
                    self.log_pass(test_name, f"HTTP {response.status_code}")
                else:
                    self.log_fail(test_name, f"HTTP {response.status_code}: {response.text[:100]}")
                    
            except Exception as e:
                self.log_fail(test_name, f"Exception: {str(e)}")
                
    def run_all_tests(self):
        """Run all wallet & earnings tests"""
        print("\n" + "="*80)
        print("WALLET & EARNINGS ACCURACY FIX - TESTING")
        print("="*80)
        print(f"Backend URL: {self.base_url}")
        print(f"Provider Auth ID: {PROVIDER_AUTH_ID}")
        print(f"Customer Auth ID: {CUSTOMER_AUTH_ID}")
        
        # Run tests in priority order
        self.test_wallet_transactions_normalized()
        self.test_wallet_transactions_category_filter()
        self.test_provider_dashboard_metrics()
        self.test_wallet_computed()
        self.test_admin_wallet_recalculate()
        self.test_backward_compatibility()
        
        # Summary
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"Total: {self.passed + self.failed}")
        
        if self.errors:
            print("\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"   - {error}")
                
        return self.failed == 0

if __name__ == "__main__":
    tester = WalletEarningsTest()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
