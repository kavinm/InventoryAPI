import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const FactoryNFT = await ethers.getContractFactory("NFTFactory");
  const factoryNFT = await FactoryNFT.deploy();

  console.log("Contract deployed to address:", factoryNFT.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
