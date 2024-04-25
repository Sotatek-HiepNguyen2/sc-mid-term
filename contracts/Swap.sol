// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract Swap is Initializable {
  struct SwapRequest {
    uint256 id;
    address sender;
    address receiver;
    address srcToken;
    uint256 srcAmount;
    address destToken;
    uint256 destAmount;
    RequestStatus status;
  }

  enum RequestStatus {
    Pending,
    Cancelled,
    Rejected,
    Approved
  }

  address public treasury;
  address public owner;
  uint8 public taxFee;
  uint256 private _requestId;

  mapping(uint256 => SwapRequest) public requests;

  event SwapRequestCreated(uint256 requestId);
  event SwapRequestApproved(uint256 requestId);
  event SwapRequestRejected(uint256 requestId);
  event SwapRequestCancelled(uint256 requestId);

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address _treasury) public initializer {
    owner = msg.sender;
    treasury = _treasury;
    taxFee = 5;
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "Not the owner");
    _;
  }

  function setTaxFee(uint8 _taxFee) external onlyOwner {
    require(_taxFee <= 100);
    taxFee = _taxFee;
  }

  function requestSwap(
    address _receiver,
    address _srcToken,
    uint256 _srcAmount,
    address _destToken,
    uint256 _destAmount
  ) external {
    require(_receiver != address(0), "Invalid receiver");
    require(_srcToken != address(0), "Invalid srcToken");
    require(_destToken != address(0), "Invalid destToken");

    address sender = msg.sender;
    IERC20 srcToken = IERC20(_srcToken);
    srcToken.transferFrom(sender, address(this), _srcAmount);

    SwapRequest memory request = SwapRequest({
      id: ++_requestId,
      sender: sender,
      receiver: _receiver,
      srcToken: _srcToken,
      destToken: _destToken,
      srcAmount: _srcAmount,
      destAmount: _destAmount,
      status: RequestStatus.Pending
    });
    requests[_requestId] = request;

    emit SwapRequestCreated(request.id);
  }

  function approveSwap(uint256 _requestId_) external {
    SwapRequest memory request = requests[_requestId_];

    require(request.id != 0, "Request not found");
    require(msg.sender == request.receiver, "Not the receiver");
    require(request.status == RequestStatus.Pending, "Request not pending");

    IERC20 destToken = IERC20(request.destToken);
    IERC20 srcToken = IERC20(request.srcToken);

    uint256 tokenAmountSenderWillReceive = ((100 - taxFee) *
      request.destAmount) / 100;
    uint256 tokenAmountReceiverWillReceive = ((100 - taxFee) *
      request.srcAmount) / 100;

    destToken.transferFrom(msg.sender, address(this), request.destAmount);
    destToken.transfer(request.sender, tokenAmountSenderWillReceive);
    srcToken.transfer(msg.sender, tokenAmountReceiverWillReceive);

    srcToken.transfer(treasury, (taxFee * request.srcAmount) / 100);
    destToken.transfer(treasury, (taxFee * request.destAmount) / 100);

    requests[_requestId_].status = RequestStatus.Approved;
    emit SwapRequestApproved(_requestId_);
  }

  function rejectSwap(uint256 _requestId_) external {
    SwapRequest memory request = requests[_requestId_];

    require(request.id != 0, "Request not found");
    require(msg.sender == request.receiver, "Not the receiver");
    require(request.status == RequestStatus.Pending, "Request not pending");
    IERC20(request.srcToken).transfer(request.sender, request.srcAmount);

    requests[_requestId_].status = RequestStatus.Rejected;
    emit SwapRequestRejected(_requestId_);
  }

  function cancelSwapRequest(uint256 _requestId_) external {
    SwapRequest memory request = requests[_requestId_];

    require(request.id != 0, "Request not found");
    require(msg.sender == request.sender, "Not the sender");
    require(request.status == RequestStatus.Pending, "Request not pending");
    IERC20(request.srcToken).transfer(msg.sender, request.srcAmount);

    requests[_requestId_].status = RequestStatus.Cancelled;
    emit SwapRequestCancelled(_requestId_);
  }
}
