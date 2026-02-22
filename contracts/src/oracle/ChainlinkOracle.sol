// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceOracle} from "./PriceOracle.sol";

/// @notice Minimal Chainlink AggregatorV3Interface — only the functions we need.
interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

    function decimals() external view returns (uint8);
}

/// @title ChainlinkOracle
/// @notice IPriceOracle implementation that reads live prices from Chainlink
///         price feeds on Avalanche Fuji (or any EVM chain with Chainlink).
///         Falls back to a manually-set price when no feed is registered for
///         the requested asset.
contract ChainlinkOracle is IPriceOracle {
    // ── State ────────────────────────────────────────────────────────────

    address public owner;

    /// @dev asset string (e.g. "ETH") => Chainlink aggregator address
    mapping(string => address) public feeds;

    /// @dev Fallback manual prices (8 decimals) used when no feed is registered
    mapping(string => uint256) private fallbackPrices;
    mapping(string => uint256) private fallbackTimestamps;

    // ── Events ───────────────────────────────────────────────────────────

    event FeedRegistered(string indexed asset, address feed);
    event FallbackPriceSet(string indexed asset, uint256 price, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Modifiers ────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "ChainlinkOracle: not owner");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ── Admin — Feed Management ──────────────────────────────────────────

    /// @notice Register (or update) the Chainlink price feed for an asset.
    /// @param asset  Human-readable ticker, e.g. "ETH", "BTC", "AVAX".
    /// @param feed   Address of the Chainlink AggregatorV3 proxy on the
    ///               target network.
    function registerFeed(string calldata asset, address feed) external onlyOwner {
        require(feed != address(0), "ChainlinkOracle: zero address");
        feeds[asset] = feed;
        emit FeedRegistered(asset, feed);
    }

    /// @notice Batch-register multiple feeds in a single transaction.
    function registerFeeds(string[] calldata assets, address[] calldata _feeds) external onlyOwner {
        require(assets.length == _feeds.length, "ChainlinkOracle: length mismatch");
        for (uint256 i = 0; i < assets.length; i++) {
            require(_feeds[i] != address(0), "ChainlinkOracle: zero address");
            feeds[assets[i]] = _feeds[i];
            emit FeedRegistered(assets[i], _feeds[i]);
        }
    }

    // ── Admin — Fallback Prices ──────────────────────────────────────────

    /// @notice Set a manual fallback price (used only when no Chainlink feed
    ///         is registered for the asset).
    /// @param asset  Ticker string.
    /// @param price  Price in 8 decimals.
    function setFallbackPrice(string calldata asset, uint256 price) external onlyOwner {
        require(price > 0, "ChainlinkOracle: price must be > 0");
        fallbackPrices[asset] = price;
        fallbackTimestamps[asset] = block.timestamp;
        emit FallbackPriceSet(asset, price, block.timestamp);
    }

    // ── Admin — Ownership ────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ChainlinkOracle: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ── IPriceOracle ─────────────────────────────────────────────────────

    /// @notice Returns the latest price for `asset`.
    ///         If a Chainlink feed is registered the on-chain price is
    ///         returned (normalised to 8 decimals).  Otherwise the manual
    ///         fallback price is returned.
    /// @return price     Price in 8 decimals.
    /// @return timestamp Block timestamp of the price update.
    function getPrice(string calldata asset) external view override returns (uint256 price, uint256 timestamp) {
        address feed = feeds[asset];

        if (feed != address(0)) {
            // ── Chainlink path ───────────────────────────────────────
            AggregatorV3Interface aggregator = AggregatorV3Interface(feed);

            (, int256 answer,, uint256 updatedAt,) = aggregator.latestRoundData();
            require(answer > 0, "ChainlinkOracle: invalid price from feed");

            uint8 feedDecimals = aggregator.decimals();

            // Normalise to 8 decimals
            if (feedDecimals < 8) {
                price = uint256(answer) * (10 ** (8 - feedDecimals));
            } else if (feedDecimals > 8) {
                price = uint256(answer) / (10 ** (feedDecimals - 8));
            } else {
                price = uint256(answer);
            }

            timestamp = updatedAt;
        } else {
            // ── Fallback path ────────────────────────────────────────
            price = fallbackPrices[asset];
            require(price > 0, "ChainlinkOracle: price not available");
            timestamp = fallbackTimestamps[asset];
        }
    }

    /// @notice No-op — prices come from Chainlink, not manual updates.
    ///         Reverts to prevent accidental misuse.  Use `setFallbackPrice`
    ///         for assets without a registered feed.
    function setPrice(string calldata, uint256) external pure override {
        revert("ChainlinkOracle: use setFallbackPrice or registerFeed");
    }
}
