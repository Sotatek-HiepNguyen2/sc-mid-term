// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Swap {
    struct SwapRequest {
        uint256 id;
        address sender;
        address receiver;
        address sourceToken;
        address destToken;
        uint256 sourceAmount;
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
    uint8 public taxFee = 5;
    uint256 private _requestId;

    mapping(uint256 => SwapRequest) public requests;

    event SwapRequestCreated(uint256 requestId);
    event SwapRequestApproved(uint256 requestId);
    event SwapRequestRejected(uint256 requestId);
    event SwapRequestCancelled(uint256 requestId);

    constructor(address _owner, address _treasury) {
        owner = _owner;
        treasury = _treasury;
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
        address _sourceToken,
        address _destToken,
        uint256 _sourceAmount,
        uint256 _destAmount
    ) external {
        require(_receiver != address(0));
        require(_sourceToken != address(0));
        require(_destToken != address(0));

        address sender = msg.sender;
        IERC20 sourceToken = IERC20(_sourceToken);
        sourceToken.transferFrom(sender, address(this), _sourceAmount);

        SwapRequest memory request = SwapRequest({
            id: _requestId,
            sender: sender,
            receiver: _receiver,
            sourceToken: _sourceToken,
            destToken: _destToken,
            sourceAmount: _sourceAmount,
            destAmount: _destAmount,
            status: RequestStatus.Pending
        });
        requests[_requestId] = request;
        _requestId++;

        emit SwapRequestCreated(request.id);
    }

    function approveSwap(uint256 _requestId_) external {
        SwapRequest memory request = requests[_requestId_];

        require(msg.sender == request.receiver, "Not the receiver");
        require(request.status == RequestStatus.Pending);

        IERC20 destToken = IERC20(request.destToken);
        IERC20 srcToken = IERC20(request.sourceToken);

        uint256 tokenAmountSenderWillReceive = ((100 - taxFee) *
            request.destAmount) / 100;
        uint256 tokenAmountReceiverWillReceive = ((100 - taxFee) *
            request.sourceAmount) / 100;

        destToken.transferFrom(msg.sender, address(this), request.destAmount);
        destToken.transfer(request.sender, tokenAmountSenderWillReceive);
        srcToken.transfer(msg.sender, tokenAmountReceiverWillReceive);

        srcToken.transfer(treasury, (taxFee * request.sourceAmount) / 100);
        destToken.transfer(treasury, (taxFee * request.destAmount) / 100);

        requests[_requestId_].status = RequestStatus.Approved;
        emit SwapRequestApproved(_requestId_);
    }

    function rejectSwap(uint256 _requestId_) external {
        SwapRequest memory request = requests[_requestId_];

        require(msg.sender == request.receiver);
        require(request.status == RequestStatus.Pending);
        IERC20(request.sourceToken).transferFrom(
            address(this),
            request.sender,
            request.sourceAmount
        );

        requests[_requestId_].status = RequestStatus.Rejected;
        emit SwapRequestRejected(_requestId_);
    }

    function cancelSwapRequest(uint256 _requestId_) external {
        SwapRequest memory request = requests[_requestId_];

        require(msg.sender == request.sender, "Not the sender");
        require(request.status == RequestStatus.Pending);
        IERC20(request.sourceToken).transfer(msg.sender, request.sourceAmount);

        requests[_requestId_].status = RequestStatus.Cancelled;
        emit SwapRequestCancelled(_requestId_);
    }
}
