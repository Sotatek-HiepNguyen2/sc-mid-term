import { HardhatUserConfig } from "hardhat/config";
import "hardhat-deploy";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";

import { config } from "dotenv";
config();

const hardhatConfig: HardhatUserConfig = {
  solidity: "0.8.24",
  namedAccounts: {
    deployer: 0,
  },
  networks: {
    bscTestnet: {
      url: process.env.BSC_RPC_URL as string,
      accounts: [process.env.BSC_DEPLOYER as string],
    },
  },
};

export default hardhatConfig;
