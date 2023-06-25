import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { InventoryNFT__factory } from "../typechain-types";
import { NFTFactory__factory } from "../typechain-types";
import { createAccount } from "@tokenbound/sdk-ethers";
import mongoose from "mongoose";
import { MongoClient, ServerApiVersion } from "mongodb";

import axios from "axios";

dotenv.config();
const FACTORY_CONTRACT_ADDRESS = "0x3C202ed68e775B48F78220FF94E2A41A129ddd66";

const app = express();
app.use(express.json());
app.use(cors());
const mongoPass = process.env.MONGO_PASS;
const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_URL);

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

app.post("/mint", async (req: Request, res: Response) => {
  let receipt: any;
  //const provider = new ethers.providers.JsonRpcProvider(process.env.MUMBAI_URL);
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Environment variable MY_VARIABLE is not defined");
  }
  const wallet = new ethers.Wallet(privateKey, provider);

  // Get contract address from the request body
  const contractAddress = req.body.contractAddress;

  if (!ethers.utils.isAddress(contractAddress)) {
    res.status(400).json({ success: false, error: "Invalid contract address" });
    return;
  }

  const nftContract = InventoryNFT__factory.connect(contractAddress, wallet);

  // Ensure that an address is provided
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

    const tx = await nftContract.safeMint(recipientAddress, {
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      maxFeePerGas: maxFeePerGas,
    });
    receipt = await tx.wait();

    let tokenId: ethers.BigNumber;

    // Loop through the events and find the Transfer event to get the tokenId.
    for (const event of receipt.events!) {
      if (event.event === "Transfer") {
        tokenId = event.args![2];
        break;
      }
    }

    // If no Transfer event was found, send an error response
    if (!tokenId) {
      res.json({ success: false, error: "No Transfer event found" });
      return;
    }

    // Assuming signer is defined in your environment
    const signer = wallet.connect(provider);

    const { hash } = await createAccount(
      contractAddress,
      tokenId.toString(),
      signer
    );

    // If successful, include hash in the response
    res.json({ tokenId: tokenId.toString(), hash });
  } catch (error: any) {
    console.error("Error minting token or creating account:", error);
    if (
      error &&
      typeof error === "object" &&
      error.code === "SERVER_ERROR" &&
      error.error &&
      error.error.code === -32000 &&
      error.error.message === "transaction underpriced"
    ) {
      let tokenId: ethers.BigNumber;

      // Loop through the events and find the Transfer event to get the tokenId.
      for (const event of receipt.events!) {
        if (event.event === "Transfer") {
          tokenId = event.args![2];
          break;
        }
      }
      console.log("Caught underpriced transaction error, returning success");
      const signer = wallet.connect(provider);

      try {
        const { hash } = await createAccount(
          contractAddress,
          tokenId.toString(),
          signer
        );
        res.json({ tokenId: tokenId.toString(), hash });
        return;
      } catch (error: any) {
        console.error("Error creating account:", error);
        res.json({ success: false, error: "Error creating account" });
        return;
      }
    } else {
      // This is some other error, handle it as you were before
      res.json({ success: false });
    }
  }
});

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
    const gasPrices = await getGasPrice();
    const tx = await factoryContract.createCollection(
      collectionName,
      collectionColor,
      {
        maxPriorityFeePerGas: ethers.utils.parseUnits(
          gasPrices.standard.maxPriorityFee.toString(),
          "gwei"
        ),
        maxFeePerGas: ethers.utils.parseUnits(
          gasPrices.standard.maxFee.toString(),
          "gwei"
        ),
      }
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

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
