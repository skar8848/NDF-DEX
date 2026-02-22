# Insurance Fund

The Insurance Fund backstops the PositionManager against solvency risk.

## Problem

When a position's PnL exceeds the counterparty's collateral, the PositionManager may not have enough USDC to pay out. Previously, payouts were silently capped at the available balance.

## Solution

`InsuranceFund.sol` automatically covers shortfalls during settlement and early close.

## How It Works

### Funding Sources
1. **Fee Revenue**: 10% of all trading fees flow to the insurance fund (configurable)
2. **Direct Deposits**: Anyone can deposit USDC via `deposit(amount)`
3. **Seed Funding**: Initial deployment seeds the fund

### Shortfall Coverage
When `PositionManager._settleCash()` or `closePosition()` detects `payout > balance`:

1. Calculates shortfall: `shortfall = payout - balance`
2. Calls `insuranceFund.coverShortfall(positionId, shortfall)`
3. Insurance fund transfers up to its full balance
4. Emits `InsuranceCover` event on PositionManager

### Partial Coverage
If the insurance fund has less than the shortfall, it covers what it can:
- Transfers its entire balance
- Emits `PartialCover` event
- Trader receives `balance + covered` instead of full `payout`

## Contract API

```solidity
// Anyone can deposit
deposit(uint256 amount)

// Only PositionManager can call
coverShortfall(uint256 positionId, uint256 amount) → uint256 covered

// View functions
getBalance() → uint256
getFundHealth() → (balance, totalCovered, totalDeposited)
```

## CLI

```bash
npx tsx src/cli.ts insurance
```

## Security

- `coverShortfall` is restricted to the PositionManager via `onlyPositionManager` modifier
- ReentrancyGuard on all state-changing functions
- SafeERC20 for all token transfers
