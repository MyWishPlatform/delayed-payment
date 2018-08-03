pragma solidity ^0.4.23;

import "sc-library/contracts/Checkable.sol";
import "sc-library/contracts/SoftDestruct.sol";
import "sc-library/contracts/ERC223/ERC223Receiver.sol";


/**
 * @title DelayedPayment
 * @dev Contract for only one delayed payment.
 */
contract DelayedPayment is SoftDestruct, Checkable, ERC223Receiver {
  // Occurs when contract was killed.
  event Killed(bool byUser);
  // Occurs when funds has been sent to beneficiary.
  event FundsSent(address to, uint amount);

  // The time after which transaction will be sent.
  uint64 public actionTime;
  // Funds receiver address.
  address public beneficiary;
  // Max amount of funds will be sent.
  uint public amountLimit;

  /**
   * @param _targetUser   Who will be contract owner.
   * @param _beneficiary  Who will receive funds.
   * @param _amountLimit  Max amount beneficiary will receive.
   * @param _actionTime   Timestamp after which transaction will be sent.
   */
  constructor(
    address _targetUser,
    address _beneficiary,
    uint _amountLimit,
    uint _actionTime
  )
    public
    SoftDestruct(_targetUser)
  {
    beneficiary = _beneficiary;
    actionTime = uint64(_actionTime);
    amountLimit = _amountLimit;
  }

  /**
   * Extends super method to add event producing.
   */
  function kill() public {
    super.kill();
    emit Killed(true);
  }

  /**
   * @dev Rejects erc223 tokens.
   */
  function tokenFallback(address, uint, bytes) public {
    revert();
  }

  /**
   * @dev Do inner check.
   * @return bool true of accident triggered, false otherwise.
   */
  function internalCheck() internal returns (bool) {
    bool result = actionTime <= block.timestamp;
    emit Checked(result);
    // actionTime in the past
    return result;
  }

  /**
   * @dev Do inner action if check was success.
   */
  function internalAction() internal {
    uint amount = address(this).balance;
    uint change = 0;
    // check if balance more then limit; init change
    if (amount > amountLimit) {
      change = amount - amountLimit;
      amount = amountLimit;
    }

    // send contract funds
    if (amount != 0) {
      emit FundsSent(beneficiary, amount);
      beneficiary.transfer(amount);
    }

    // send change
    if (change != 0) {
      emit FundsSent(targetUser, change);
      targetUser.transfer(change);
    }
  }
}
