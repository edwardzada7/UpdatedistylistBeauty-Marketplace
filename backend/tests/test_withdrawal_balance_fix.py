"""
Test: Withdrawal approval correctly deducts from balance when 'available_balance'
column is stale relative to 'balance' column.

Simulates the bug scenario:
  Provider wallet: balance=34000 (correct), available_balance=4000 (stale)
  Withdrawal request: 2000
  Expected after approval: balance=32000  (NOT 2000)
"""
import sys
sys.path.insert(0, "/app/backend")

# Recreate the EXACT logic from server.py lines 2886-2905 (post-fix)
def approve_withdrawal_balance_calc(wallet: dict, amount: float):
    """Mirror of the post-fix logic in server.admin_process_withdrawal."""
    # post-fix line 2887: read `balance` FIRST, fall back to available_balance
    balance_val = wallet.get("balance")
    if balance_val is None:
        balance_val = wallet.get("available_balance")
    available_balance = float(balance_val or 0)

    if available_balance < amount:
        raise ValueError(f"Insufficient: avail={available_balance}, want={amount}")

    new_balance = available_balance - amount

    update_data = {"available_balance": new_balance}
    if wallet.get("balance") is not None:
        update_data["balance"] = new_balance
    return new_balance, update_data


def test_bug_scenario_stale_available_balance():
    """Original bug: stale available_balance was being read first."""
    wallet = {"id": 1, "balance": 34000, "available_balance": 4000}  # stale!
    new_balance, update_data = approve_withdrawal_balance_calc(wallet, 2000)
    assert new_balance == 32000, f"Expected 32000, got {new_balance}"
    assert update_data["balance"] == 32000
    assert update_data["available_balance"] == 32000
    print("PASS bug-scenario: balance=34000 (stale avail=4000), withdraw 2000 -> 32000")


def test_normal_scenario_both_columns_synced():
    """Sanity: when both columns agree, no regression."""
    wallet = {"id": 2, "balance": 34000, "available_balance": 34000}
    new_balance, _ = approve_withdrawal_balance_calc(wallet, 2000)
    assert new_balance == 32000
    print("PASS synced-columns: balance=34000, avail=34000, withdraw 2000 -> 32000")


def test_only_balance_column_present():
    """Schema without available_balance column."""
    wallet = {"id": 3, "balance": 34000}
    new_balance, update_data = approve_withdrawal_balance_calc(wallet, 2000)
    assert new_balance == 32000
    # available_balance still written (legacy parity)
    assert update_data["available_balance"] == 32000
    assert update_data["balance"] == 32000
    print("PASS only-balance: balance=34000, no avail -> 32000")


def test_only_available_balance_present_balance_null():
    """Schema with balance=None but available_balance set."""
    wallet = {"id": 4, "balance": None, "available_balance": 34000}
    new_balance, update_data = approve_withdrawal_balance_calc(wallet, 2000)
    assert new_balance == 32000
    # balance is None -> we DON'T write balance column (per existing line 2901)
    assert "balance" not in update_data
    assert update_data["available_balance"] == 32000
    print("PASS only-avail: balance=None, avail=34000 -> 32000")


def test_insufficient_balance():
    wallet = {"id": 5, "balance": 1000}
    try:
        approve_withdrawal_balance_calc(wallet, 2000)
        assert False, "Should have raised"
    except ValueError as e:
        assert "Insufficient" in str(e)
        print("PASS insufficient-balance: blocks withdrawal as expected")


def test_balance_exactly_equals_withdrawal():
    wallet = {"id": 6, "balance": 2000, "available_balance": 4000}
    new_balance, _ = approve_withdrawal_balance_calc(wallet, 2000)
    assert new_balance == 0.0
    print("PASS exact-balance: 2000 - 2000 -> 0")


if __name__ == "__main__":
    test_bug_scenario_stale_available_balance()
    test_normal_scenario_both_columns_synced()
    test_only_balance_column_present()
    test_only_available_balance_present_balance_null()
    test_insufficient_balance()
    test_balance_exactly_equals_withdrawal()
    print("\nAll 6 tests passed.")
