import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { InventoryNFT__factory } from "../typechain-types";
import { NFTFactory__factory } from "../typechain-types";
import { TokenboundClient } from "@tokenbound/sdk";
import { createAccount } from "@tokenbound/sdk-ethers";
import mongoose from "mongoose";
import { MongoClient, ServerApiVersion } from "mongodb";

import axios from "axios";

dotenv.config();
const FACTORY_CONTRACT_ADDRESS = "0xB5212B4b6676D4A5978Ec0230976A1303fE25621";

const app = express();
app.use(express.json());
app.use(cors());
const mongoPass = process.env.MONGO_PASS;
const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_URL);

const uri = `mongodb+srv://kavin1810:${mongoPass}@cluster0.fvj4tpc.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function connectMongoDB() {
  try {
    await mongoose.connect(uri);
    console.log("You successfully connected to MongoDB!");
  } catch (error) {
    console.error("Could not connect to MongoDB:", error);
  }
}
async function getGasPrice() {
  try {
    const response = await axios.get(
      "https://gasstation.polygon.technology/v2"
    );
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

connectMongoDB();

const NFTCollectionSchema = new mongoose.Schema({
  name: String,
  contractAddress: String,
  color: String,
});

export const NFTCollection = mongoose.model(
  "NFTCollection",
  NFTCollectionSchema
);
// Define getLatestTokenId method
async function getLatestTokenId(contractAddress: string) {
  const abi = ["function totalSupply() view returns (uint256)"];
  const contract = new ethers.Contract(contractAddress, abi, provider);
  const totalSupply = await contract.totalSupply();
  const latestTokenId = totalSupply.sub(1);
  console.log("Latest Token ID:", latestTokenId.toString());
  return latestTokenId;
}

async function mintNFT(req: Request, res: Response) {
  let receipt: any;
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Environment variable MY_VARIABLE is not defined");
  }
  const wallet = new ethers.Wallet(privateKey, provider);
  const contractAddress = req.body.contractAddress;

  if (!ethers.utils.isAddress(contractAddress)) {
    res.status(400).json({ success: false, error: "Invalid contract address" });
    return;
  }

  const nftContract = InventoryNFT__factory.connect(contractAddress, wallet);
  const recipientAddress = req.body.address;
  if (!ethers.utils.isAddress(recipientAddress)) {
    res
      .status(400)
      .json({ success: false, error: "Invalid recipient address" });
    return;
  }

  try {
    const gasPrices = await getGasPrice();

    const maxPriorityFeePerGas = ethers.utils.parseUnits(
      Math.round(gasPrices.standard.maxPriorityFee + 10).toString(),
      "gwei"
    );

    const maxFeePerGas = ethers.utils.parseUnits(
      Math.round(gasPrices.standard.maxFee + 10).toString(),
      "gwei"
    );

    const txn = await nftContract.safeMint(recipientAddress, {
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      maxFeePerGas: maxFeePerGas,
    });

    receipt = await txn.wait();
  } catch (error: any) {
    console.error("Error minting token:", error);
    if (
      error &&
      typeof error === "object" &&
      error.code === "SERVER_ERROR" &&
      error.error &&
      error.error.code === -32000 &&
      error.error.message === "transaction underpriced"
    ) {
      console.log(
        "Transaction underpriced, but continuing to create account..."
      );
    } else {
      // If it's a different error, rethrow it
      throw error;
    }
  }
  // Get the latest token ID regardless of whether an error occurred
  const latestTokenId = await getLatestTokenId(contractAddress);
  console.log("this is the latestTokenId:" + latestTokenId);

  // Assuming signer is defined in your environment
  const signer = wallet.connect(provider);

  const tokenboundClient = new TokenboundClient({ signer, chainId: 137 });

  const hash = await tokenboundClient.createAccount({
    tokenContract: contractAddress,
    tokenId: latestTokenId.toString(),
  });

  console.log(hash);

  res.status(200).json({
    success: true,
    txHash: receipt ? receipt.transactionHash : "N/A",
    tokenId: latestTokenId.toString(),
    hash,
  });
}

app.post("/mint", mintNFT);

app.post("/create-collection", async (req: Request, res: Response) => {
  const collectionName = req.body.name;
  const collectionColor = req.body.color;
  // const provider = new ethers.providers.JsonRpcProvider(process.env.MUMBAI_URL);
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Environment variable MY_VARIABLE is not defined");
  }
  const wallet = new ethers.Wallet(privateKey, provider);

  const factoryContract = NFTFactory__factory.connect(
    FACTORY_CONTRACT_ADDRESS,
    wallet
  );

  try {
    // const gasPrices = await getGasPrice();
    const tx = await factoryContract.createCollection(
      collectionName,
      collectionColor
    );
    const receipt = await tx.wait();

    // Print the transaction receipt to the console
    console.log(receipt);

    // Extract the newNFTAddress from the 'CollectionCreated' event
    let collectionAddress;
    for (const event of receipt.events) {
      if (event.event === "CollectionCreated") {
        collectionAddress = event.args[0];
        break;
      }
    }
    // Store the new collection in the database
    const newCollection = new NFTCollection({
      name: collectionName,
      contractAddress: collectionAddress,
      color: collectionColor,
    });
    await newCollection.save();

    res.json({ collectionAddress });
  } catch (error) {
    console.error("Error creating collection:", error);
    res.json({ success: false });
  }
});

app.get("/collections", async (req: Request, res: Response) => {
  try {
    const collections = await NFTCollection.find();
    res.json(collections);
  } catch (error) {
    console.error("Error fetching collections:", error);
    res.json({ success: false });
  }
});

app.post("/verify-and-mint", async (req: Request, res: Response) => {
  // Extract necessary fields from the request body
  const {
    nullifier_hash,
    merkle_root,
    proof,
    credential_type,
    action,
    signal,
    address,
    contractAddress,
  } = req.body;

  // Make the fetch request to the Worldcoin API
  const worldcoinResponse = await axios.post(
    "https://developer.worldcoin.org//api/v1/verify/app_staging_204d7dd2d44ec1f37d0f6ecd4004789c",
    {
      nullifier_hash,
      merkle_root,
      proof,
      credential_type,
      action,
      signal,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  // Parse the response from the Worldcoin API
  const worldcoinData = worldcoinResponse.data;

  // If the response was successful, call the mint function
  // If the response was successful, call the mint function
  if (worldcoinData.success) {
    // Construct the request body for the mint function
    const mintReq = {
      body: {
        contractAddress, // Replace with the correct contract address
        address,
      },
    };

    // Call the mint function
    await mintNFT(mintReq as any, res);
  } else {
    // If the response was not successful, return an error
    res.status(400).json({ success: false, error: "Verification failed" });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
