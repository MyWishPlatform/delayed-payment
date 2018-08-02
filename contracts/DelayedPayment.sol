pragma solidity ^0.4.23;

import "sc-library/contracts/Checkable.sol";
import "sc-library/contracts/SoftDestruct.sol";
import "sc-library/contracts/ERC223/ERC223Receiver.sol";


contract DelayedPayment is SoftDestruct, Checkable, ERC223Receiver {
  // Occurs when contract was killed.
  event Killed(bool byUser);

  uint64 public actionTime;
  address public beneficiary;
  uint public amountLimit;

  event FundsSent(address to, uint amount);

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

  function tokenFallback(address, uint, bytes) public {
    // reject erc223 tokens
    revert();
  }

  function internalCheck() internal returns (bool) {
    bool result = actionTime <= block.timestamp;
    emit Checked(result);
    // actionTime in the past
    return result;
  }

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
