import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { it } from "mocha";
import { expect } from "chai";

describe("Swap", function () {
  async function deploySwapFixture() {
    const Swap = await ethers.getContractFactory("Swap");
    const [owner, treasury] = await ethers.getSigners();
    const swap = await Swap.deploy(owner, treasury);

    const Token = await ethers.getContractFactory("ERC20Mock");
    const tokenA = await Token.deploy("Token A", "TKA", 1000);
    const tokenB = await Token.deploy("Token B", "TKB", 1000);

    return { swap, owner, treasury, tokenA, tokenB };
  }

  describe("Deployment", function () {
    it("Should deploy the right owner", async function () {
      const { swap, owner } = await loadFixture(deploySwapFixture);

      expect(await swap.owner()).to.equal(owner.address);
    });
    it("Should deploy the right treasury", async function () {
      const { swap, treasury } = await loadFixture(deploySwapFixture);

      expect(await swap.treasury()).to.equal(treasury.address);
    });
  });

  describe("Setup swap", function () {
    it("Should set the right tax fee", async function () {
      const TAX_FEE = 6;
      const { swap, owner, treasury } = await loadFixture(deploySwapFixture);

      await swap.setTaxFee(TAX_FEE);
      expect(await swap.taxFee()).to.equal(TAX_FEE);
    });
  });

  describe("Swap", function () {
    it("Should swap tokens", async function () {
      const { swap, owner, treasury } = await loadFixture(deploySwapFixture);

      // await tokenA.transfer(swap.address, 100);
      // await swap.addToken(tokenA.address, 100);
      // await swap.addToken(tokenB.address, 100);

      // await swap.swap(tokenA.address, tokenB.address, 50);

      // expect(await tokenA.balanceOf(swap.address)).to.equal(50);
      // expect(await tokenB.balanceOf(swap.address)).to.equal(50);
    });
  });
});
