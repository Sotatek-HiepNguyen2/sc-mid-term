import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { config } from "dotenv";
config();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const swap = await deploy("Swap", {
    from: deployer,
    log: true,
    proxy: {
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        init: {
          methodName: "initialize",
          args: [process.env.TREASURY_ADDRESS],
        },
      },
    },
  });

  console.log(`Swap contract deployed: `, swap.address);
};
export default func;
func.id = "deploy_swap"; // id required to prevent reexecution
func.tags = ["swap"];
