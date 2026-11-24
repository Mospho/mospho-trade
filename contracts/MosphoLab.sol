// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice One transferable MOSPHO pays for one prepared off-chain AI request.
contract MosphoLab is ERC20 {
    address payable public immutable treasury;
    uint256 public immutable unitPrice;
    bool public tokenLive;

    enum Currency { Unpaid, ETH, MOSPHO }
    mapping(address payer => mapping(bytes32 ticket => Currency)) public payments;

    error InvalidTerms();
    error InvalidTicket();
    error AlreadyPaid();
    error WrongAmount();
    error TransferFailed();
    error TokenClosed();
    error Unauthorized();

    event RequestPaid(address indexed payer, bytes32 indexed ticket, Currency currency, uint256 amount);
    event TokensPurchased(address indexed buyer, uint256 units, uint256 weiPaid);
    event RevenueClaimed(address indexed treasury, uint256 amount);
    event TokenOpened();

    constructor(address payable recipient, uint256 priceWei) ERC20("Mospho Lab", "MOSPHO") {
        if (recipient == address(0) || priceWei == 0) revert InvalidTerms();
        treasury = recipient;
        unitPrice = priceWei;
    }

    /// @notice Explicit launch by the treasury. Deployment alone issues zero tokens.
    function openToken() external {
        if (msg.sender != treasury || tokenLive) revert Unauthorized();
        tokenLive = true;
        emit TokenOpened();
    }

    function buyTokens(uint32 units) external payable {
        if (!tokenLive) revert TokenClosed();
        if (units == 0 || msg.value != unitPrice * units) revert WrongAmount();
        _mint(msg.sender, uint256(units) * 1 ether);
        emit TokensPurchased(msg.sender, units, msg.value);
    }

    function payETH(bytes32 ticket) external payable {
        if (msg.value != unitPrice) revert WrongAmount();
        _record(ticket, Currency.ETH);
        emit RequestPaid(msg.sender, ticket, Currency.ETH, msg.value);
    }

    function payMOSPHO(bytes32 ticket) external {
        if (!tokenLive) revert TokenClosed();
        _record(ticket, Currency.MOSPHO);
        _burn(msg.sender, 1 ether);
        emit RequestPaid(msg.sender, ticket, Currency.MOSPHO, 1 ether);
    }

    function _record(bytes32 ticket, Currency currency) private {
        if (ticket == bytes32(0)) revert InvalidTicket();
        if (payments[msg.sender][ticket] != Currency.Unpaid) revert AlreadyPaid();
        payments[msg.sender][ticket] = currency;
    }

    /// @notice Anyone may forward accrued revenue, always to the fixed treasury.
    function claimRevenue() external {
        uint256 amount = address(this).balance;
        if (amount == 0) revert WrongAmount();
        (bool sent,) = treasury.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit RevenueClaimed(treasury, amount);
    }
}
