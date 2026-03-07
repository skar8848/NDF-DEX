import os

# Avalanche Fuji Testnet
RPC_URL = os.environ.get("TENOR_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc")
CHAIN_ID = 43113

# Contract addresses
CONTRACTS = {
    "OrderBook": "0xd92Ff3f1FF6AAC7E298BcF9634eB907B9B7e7Bf9",
    "ForwardMarket": "0x7De1970F024cB1c2953dCBc850E895c4637f57E9",
    "PositionManager": "0x7a867BC74482724C2B0b6F36DFb15f6691088a88",
    "MockUSDC": "0xDa9103E3121784fba3e60f5a95304833a5A904f1",
    "MockUSDT": "0x0000000000000000000000000000000000000000",  # TODO: update after redeploy
    "MockAUSD": "0x0000000000000000000000000000000000000000",  # TODO: update after redeploy
    "MockOracle": "0x6e1bebEf40dA65B2B5B39EFa1591a985C0EE884E",
    "TenorVault": "0x62Ef155a07EA3bF04e6930d40Ad1549F973fB37D",
    "InsuranceFund": "0x3BC01a6710CF2f8DBa2E4bfD8b6F4C7F553E3BFC",
    "CollateralManager": "0xE5586FF57d8602F980bf36eE9a9B99144cd15b66",
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
