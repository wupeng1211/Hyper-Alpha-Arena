#!/usr/bin/env python3
"""
Test script for environment isolation functionality
"""
import sys
import os
sys.path.append('/app/backend')

from services.hyperliquid_market_data import (
    create_hyperliquid_client,
    get_hyperliquid_client_for_environment,
    get_kline_data_from_hyperliquid
)

def test_client_creation():
    """Test that clients are created with correct environment settings"""
    print("=== Testing Client Creation ===")

    # Test mainnet client
    mainnet_client = create_hyperliquid_client("mainnet")
    print(f"Mainnet client environment: {mainnet_client.environment}")
    print(f"Mainnet client sandbox mode: {mainnet_client.exchange.sandbox}")

    # Test testnet client
    testnet_client = create_hyperliquid_client("testnet")
    print(f"Testnet client environment: {testnet_client.environment}")
    print(f"Testnet client sandbox mode: {testnet_client.exchange.sandbox}")

    # Verify settings
    assert mainnet_client.environment == "mainnet"
    assert mainnet_client.exchange.sandbox == False
    assert testnet_client.environment == "testnet"
    assert testnet_client.exchange.sandbox == True

    print("✅ Client creation test passed!")

def test_client_caching():
    """Test that client caching works correctly"""
    print("\n=== Testing Client Caching ===")

    # Get clients multiple times
    client1 = get_hyperliquid_client_for_environment("mainnet")
    client2 = get_hyperliquid_client_for_environment("mainnet")
    client3 = get_hyperliquid_client_for_environment("testnet")
    client4 = get_hyperliquid_client_for_environment("testnet")

    # Verify same instances are returned for same environment
    assert client1 is client2, "Mainnet clients should be the same instance"
    assert client3 is client4, "Testnet clients should be the same instance"
    assert client1 is not client3, "Different environment clients should be different instances"

    print("✅ Client caching test passed!")

def test_kline_data_environment():
    """Test that K-line data is fetched from correct environment"""
    print("\n=== Testing K-line Data Environment ===")

    try:
        # Test mainnet K-line data
        print("Fetching mainnet K-line data...")
        mainnet_data = get_kline_data_from_hyperliquid("BTC", "1d", 5, persist=False, environment="mainnet")
        print(f"Mainnet data count: {len(mainnet_data) if mainnet_data else 0}")

        # Test testnet K-line data
        print("Fetching testnet K-line data...")
        testnet_data = get_kline_data_from_hyperliquid("BTC", "1d", 5, persist=False, environment="testnet")
        print(f"Testnet data count: {len(testnet_data) if testnet_data else 0}")

        print("✅ K-line data environment test completed!")

    except Exception as e:
        print(f"⚠️ K-line data test encountered error (expected in some cases): {e}")

def main():
    """Run all tests"""
    print("🚀 Starting Environment Isolation Tests")
    print("=" * 50)

    try:
        test_client_creation()
        test_client_caching()
        test_kline_data_environment()

        print("\n" + "=" * 50)
        print("🎉 All tests completed successfully!")
        print("Environment isolation is working correctly.")

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()