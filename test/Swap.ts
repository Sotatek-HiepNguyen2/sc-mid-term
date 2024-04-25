import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { it } from "mocha";
import { expect } from "chai";
import { Swap } from "../typechain-types";
import { BaseContract } from "ethers";

const TOTAL_SUPPLY_TOKEN_A = BigInt(1e18);
const TOTAL_SUPPLY_TOKEN_B = BigInt(2e18);

const SRC_AMOUNT = TOTAL_SUPPLY_TOKEN_A;
const DEST_AMOUNT = TOTAL_SUPPLY_TOKEN_B;

const SRC_TOKEN_TREASURY_WILL_RECEIVE = (SRC_AMOUNT * BigInt(5)) / BigInt(100);
const DEST_TOKEN_TREASURY_WILL_RECEIVE =
  (DEST_AMOUNT * BigInt(5)) / BigInt(100);
const SENDER_WILL_RECEIVE = DEST_AMOUNT - DEST_TOKEN_TREASURY_WILL_RECEIVE;
const RECEIVER_WILL_RECEIVE = SRC_AMOUNT - SRC_TOKEN_TREASURY_WILL_RECEIVE;

describe("Swap", function () {
  async function deploySwapFixture() {
    const Swap = await ethers.getContractFactory("Swap");
    const [owner, treasury, sender, receiver] = await ethers.getSigners();

    const swap = (await upgrades.deployProxy(Swap, [
      treasury.address,
    ])) as BaseContract as Swap;
    await swap.waitForDeployment();

    const Token = await ethers.getContractFactory("ERC20Mock");
    const tokenA = await Token.deploy("Token A", "TKA", TOTAL_SUPPLY_TOKEN_A);
    const tokenB = await Token.deploy("Token B", "TKB", TOTAL_SUPPLY_TOKEN_B);

    await tokenA.transfer(sender, TOTAL_SUPPLY_TOKEN_A);
    await tokenB.transfer(receiver, TOTAL_SUPPLY_TOKEN_B);

    return { swap, owner, sender, receiver, treasury, tokenA, tokenB };
  }

  async function makeSwapRequest() {
    const { swap, sender, receiver, tokenA, tokenB, treasury } =
      await loadFixture(deploySwapFixture);

    await tokenA.connect(sender).approve(await swap.getAddress(), SRC_AMOUNT);
    await swap
      .connect(sender)
      .requestSwap(
        receiver,
        await tokenA.getAddress(),
        SRC_AMOUNT,
        await tokenB.getAddress(),
        DEST_AMOUNT
      );

    return { swap, sender, receiver, tokenA, tokenB, treasury };
  }

  async function approveSwapRequest(
    swapRequest: Awaited<ReturnType<typeof makeSwapRequest>>
  ) {
    const { receiver, tokenB, swap, sender, tokenA } = swapRequest;

    await tokenB
      .connect(receiver)
      .approve(await swap.getAddress(), DEST_AMOUNT);

    await swap.connect(receiver).approveSwap(1);
    return { swap, sender, receiver, tokenA, tokenB };
  }

  describe("Deployment", function () {
    it("Should deploy the right owner", async function () {
      const { swap, owner, treasury } = await loadFixture(deploySwapFixture);

      expect(await swap.owner()).to.equal(owner.address);
    });
    it("Should deploy the right treasury", async function () {
      const { swap, treasury } = await loadFixture(deploySwapFixture);

      expect(await swap.treasury()).to.equal(treasury.address);
    });
  });

  describe("Setup tax fee", function () {
    it("Should revert if not owner", async function () {
      const { swap, treasury } = await loadFixture(deploySwapFixture);

      await expect(swap.connect(treasury).setTaxFee(5)).to.be.revertedWith(
        "Not the owner"
      );
    });
    it("Should set the right tax fee", async function () {
      const TAX_FEE = 6;
      const { swap, owner, treasury } = await loadFixture(deploySwapFixture);

      await swap.setTaxFee(TAX_FEE);
      expect(await swap.taxFee()).to.equal(TAX_FEE);
    });
  });

  describe("Swap flow", function () {
    describe("Validation", function () {
      it("Should revert if source token is zero address", async function () {
        const { swap, sender, receiver, tokenA, tokenB } = await loadFixture(
          deploySwapFixture
        );

        await tokenA
          .connect(sender)
          .approve(await swap.getAddress(), SRC_AMOUNT);

        await expect(
          swap
            .connect(sender)
            .requestSwap(
              receiver,
              ethers.ZeroAddress,
              SRC_AMOUNT,
              await tokenB.getAddress(),
              DEST_AMOUNT
            )
        ).to.be.revertedWith("Invalid srcToken");
      });

      it("Should revert if destination token is zero address", async function () {
        const { swap, sender, receiver, tokenA, tokenB } = await loadFixture(
          deploySwapFixture
        );

        await tokenA
          .connect(sender)
          .approve(await swap.getAddress(), SRC_AMOUNT);

        await expect(
          swap
            .connect(sender)
            .requestSwap(
              receiver,
              await tokenA.getAddress(),
              SRC_AMOUNT,
              ethers.ZeroAddress,
              DEST_AMOUNT
            )
        ).to.be.revertedWith("Invalid destToken");
      });

      it("Should revert if approve not existed request", async function () {
        const { swap, receiver, tokenB } = await loadFixture(deploySwapFixture);

        await tokenB
          .connect(receiver)
          .approve(await swap.getAddress(), DEST_AMOUNT);

        await expect(swap.connect(receiver).approveSwap(0)).to.be.revertedWith(
          "Request not found"
        );
      });
    });

    describe("Swap", function () {
      type SwapRequest = Awaited<ReturnType<typeof makeSwapRequest>>;
      let swapRequest: SwapRequest;

      this.beforeEach(async function () {
        swapRequest = await makeSwapRequest();
      });

      describe("Make swap request", async function () {
        it("Should have correct source token amount in contract", async function () {
          const { tokenA, swap } = swapRequest;
          expect(await tokenA.balanceOf(await swap.getAddress())).to.equal(
            SRC_AMOUNT
          );
        });

        it("Should have correct request sender", async function () {
          const { sender, swap } = swapRequest;
          expect((await swap.requests(1)).sender).to.equal(sender.address);
        });

        it("Should have correct request receiver", async function () {
          const { receiver, swap } = swapRequest;
          expect((await swap.requests(1)).receiver).to.equal(receiver.address);
        });

        it("Should have correct source token", async function () {
          const { tokenA, swap } = swapRequest;
          expect((await swap.requests(1)).srcToken).to.equal(
            await tokenA.getAddress()
          );
        });

        it("Should have correct destination token", async function () {
          const { tokenB, swap } = swapRequest;
          expect((await swap.requests(1)).destToken).to.equal(
            await tokenB.getAddress()
          );
        });

        it("Should have correct source amount", async function () {
          const { swap } = swapRequest;
          expect((await swap.requests(1)).srcAmount).to.equal(SRC_AMOUNT);
        });

        it("Should have correct destination amount", async function () {
          const { swap } = swapRequest;
          expect((await swap.requests(1)).destAmount).to.equal(DEST_AMOUNT);
        });
      });

      describe("Approve swap request", async function () {
        let approveTx: Awaited<ReturnType<typeof approveSwapRequest>>;

        this.beforeEach(async function () {
          approveTx = await approveSwapRequest(swapRequest);
        });

        it("Should revert if msg.sender is not receiver", async function () {
          const { swap, sender } = swapRequest;
          await expect(swap.connect(sender).approveSwap(1)).to.be.revertedWith(
            "Not the receiver"
          );
        });

        it("Should be approved only one time", async function () {
          const { swap, receiver } = swapRequest;
          await expect(
            swap.connect(receiver).approveSwap(1)
          ).to.be.revertedWith("Request not pending");
        });

        it("Shoud have Approved status in request", async function () {
          const { swap } = approveTx;
          expect((await swap.requests(1)).status).to.equal(3);
        });

        it("Should have enough source token amount as tax fee in treasury", async function () {
          const { treasury, tokenA } = swapRequest;
          expect(await tokenA.balanceOf(treasury.address)).to.equal(
            BigInt((SRC_AMOUNT * BigInt(5)) / BigInt(100))
          );
        });

        it("Should have enough destination token amount as tax fee in treasury", async function () {
          const { treasury, tokenB } = swapRequest;
          expect(await tokenB.balanceOf(treasury.address)).to.equal(
            BigInt((DEST_AMOUNT * BigInt(5)) / BigInt(100))
          );
        });

        it("Should have enough source token amount in receiver wallet", async function () {
          const { tokenA, receiver } = approveTx;
          expect(await tokenA.balanceOf(receiver.address)).to.equal(
            RECEIVER_WILL_RECEIVE
          );
        });

        it("Should have enough destination token amount in sender wallet", async function () {
          const { tokenB, sender } = approveTx;
          expect(await tokenB.balanceOf(sender.address)).to.equal(
            SENDER_WILL_RECEIVE
          );
        });
      });

      describe("Cancel swap request", async function () {
        it("Should revert if msg.sender is not sender", async function () {
          const { swap, receiver } = swapRequest;
          await expect(
            swap.connect(receiver).cancelSwapRequest(1)
          ).to.be.revertedWith("Not the sender");
        });

        it("Should revert if request is not existed", async function () {
          const { swap, sender } = swapRequest;
          await expect(
            swap.connect(sender).cancelSwapRequest(0)
          ).to.be.revertedWith("Request not found");
        });

        it("Should revert if request is not pending", async function () {
          const { swap, sender } = swapRequest;
          await swap.connect(sender).cancelSwapRequest(1);
          await expect(
            swap.connect(sender).cancelSwapRequest(1)
          ).to.be.revertedWith("Request not pending");
        });

        it("Should have correct source token amount in sender wallet", async function () {
          const { tokenA, sender, swap } = swapRequest;
          await swap.connect(sender).cancelSwapRequest(1);
          expect(await tokenA.balanceOf(sender.address)).to.equal(SRC_AMOUNT);
        });

        it("Should have correct source token amount in contract", async function () {
          const { tokenA, swap, sender } = swapRequest;
          await swap.connect(sender).cancelSwapRequest(1);
          expect(await tokenA.balanceOf(await swap.getAddress())).to.equal(0);
        });

        it("Should have Cancelled request status", async function () {
          const { swap, sender } = swapRequest;
          await swap.connect(sender).cancelSwapRequest(1);
          expect((await swap.requests(1)).status).to.equal(1);
        });
      });

      describe("Reject swap request", async function () {
        it("Should revert if msg.sender is not receiver", async function () {
          const { swap, sender } = swapRequest;
          await expect(swap.connect(sender).rejectSwap(1)).to.be.revertedWith(
            "Not the receiver"
          );
        });

        it("Should revert if request is not existed", async function () {
          const { swap, receiver } = swapRequest;
          await expect(swap.connect(receiver).rejectSwap(0)).to.be.revertedWith(
            "Request not found"
          );
        });

        it("Should have correct source token amount in sender wallet", async function () {
          const { tokenA, sender, swap, receiver } = swapRequest;
          await swap.connect(receiver).rejectSwap(1);
          expect(await tokenA.balanceOf(sender.address)).to.equal(SRC_AMOUNT);
        });

        it("Should have correct source token amount in contract", async function () {
          const { tokenA, swap, receiver } = swapRequest;
          await swap.connect(receiver).rejectSwap(1);
          expect(await tokenA.balanceOf(await swap.getAddress())).to.equal(0);
        });

        it("Should have Rejected request status", async function () {
          const { swap, receiver } = swapRequest;
          await swap.connect(receiver).rejectSwap(1);
          expect((await swap.requests(1)).status).to.equal(2);
        });

        it("Should revert if request is not pending", async function () {
          const { swap, receiver } = swapRequest;
          await swap.connect(receiver).rejectSwap(1);
          await expect(swap.connect(receiver).rejectSwap(1)).to.be.revertedWith(
            "Request not pending"
          );
        });
      });
    });

    describe("Events", function () {
      it("Should emit SwapRequestCreated event", async function () {
        const { swap, sender, receiver, tokenA, tokenB } = await loadFixture(
          deploySwapFixture
        );

        await tokenA
          .connect(sender)
          .approve(await swap.getAddress(), SRC_AMOUNT);

        await expect(
          swap
            .connect(sender)
            .requestSwap(
              receiver,
              await tokenA.getAddress(),
              SRC_AMOUNT,
              await tokenB.getAddress(),
              DEST_AMOUNT
            )
        )
          .to.emit(swap, "SwapRequestCreated")
          .withArgs(1);
      });

      it("Should emit SwapRequestApproved event", async function () {
        const { swap, receiver, tokenB } = await makeSwapRequest();

        await tokenB
          .connect(receiver)
          .approve(await swap.getAddress(), DEST_AMOUNT);
        await expect(swap.connect(receiver).approveSwap(1))
          .to.emit(swap, "SwapRequestApproved")
          .withArgs(1);
      });

      it("Should emit SwapRequestCancelled event", async function () {
        const { swap, sender } = await makeSwapRequest();
        await expect(swap.connect(sender).cancelSwapRequest(1))
          .to.emit(swap, "SwapRequestCancelled")
          .withArgs(1);
      });

      it("Should emit SwapRequestRejected event", async function () {
        const { swap, receiver } = await makeSwapRequest();

        await expect(swap.connect(receiver).rejectSwap(1))
          .to.emit(swap, "SwapRequestRejected")
          .withArgs(1);
      });
    });
  });
});
