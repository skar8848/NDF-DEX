import os

# Avalanche Fuji Testnet
RPC_URL = os.environ.get("TENOR_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc")
CHAIN_ID = 43113

# Contract addresses — v8 Multi-Collateral (Avalanche Fuji)
CONTRACTS = {
    "OrderBook": "0x463e3d633FC591ed02900Afd041Bcf7EdfE9DCB1",
    "ForwardMarket": "0x0d51Bb1c3eEE7C0573B6b2D905a287372d6301E1",
    "PositionManager": "0x3fd14cb5dc574986004973254186aDbB2CE4A900",
    "MockUSDC": "0x4a9Cc53548eBbEfb31bC2189FA5f2aBb48A3335a",
    "MockUSDT": "0x2867e9A5a9db4115E9e7AE9747ea50bd12DeD9Ed",
    "MockAUSD": "0x5052262e7AfFF6befD734551114d90bd56218C54",
    "MockOracle": "0xf5EfBaf278268B4A82A46DC51C0132Ab5861b4ae",
    "TenorVault": "0xEac92864c8D56e02d076981EaaD6aeCc6b7D93B0",
    "InsuranceFund": "0x85fCaB9Cb3FCE04ED277190c9c09cDC5178B9Ca0",
    "CollateralManager": "0xc42e2d1e47eA74d5B9CF0eb70806D7a4169D66e0",
}

COLLATERAL_TOKENS = {
    "USDC": "MockUSDC",
    "USDT": "MockUSDT",
    "AUSD": "MockAUSD",
}

# Precision constants
PRICE_DECIMALS = 8
COLLATERAL_DECIMALS = 6
PRICE_PRECISION = 10 ** PRICE_DECIMALS
COLLATERAL_PRECISION = 10 ** COLLATERAL_DECIMALS

# Private key for signing transactions (optional, only for write operations)
PRIVATE_KEY = os.environ.get("TENOR_PRIVATE_KEY", "")
