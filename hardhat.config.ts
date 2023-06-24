import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import dotenv from "dotenv";
dotenv.config();

const etherscanKey = process.env.POLYGONSCAN_API_KEY;
const privatekey = process.env.PRIVATE_KEY;

if (!privatekey) {
  throw new Error("Environment variable MY_VARIABLE is not defined");
}

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  networks: {
    hardhat: {
      accounts: [
        {
          privateKey: privatekey, // replace with your private key
          balance: "100000000000000000000000", // Optional: balance in wei that this account should have
        },
      ],
    },
    mumbai: {
      url: process.env.MUMBAI_URL,
      accounts: [privatekey],
    },
    sepolia: {
      url: process.env.SEPOLIA_URL,
      accounts: [privatekey],
    },
    polygon: {
      url: process.env.POLYGON_URL,
      accounts: [privatekey],
    },
  },
  etherscan: { apiKey: etherscanKey },
};

export default config;
