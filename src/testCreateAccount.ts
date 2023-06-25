import { ethers } from "ethers";
import { createAccount } from "@tokenbound/sdk-ethers";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.SEPOLIA_URL
  );
  const privateKey = process.env.PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey, provider);
  const signer = wallet.connect(provider);
  const { hash } = await createAccount(
    "0x2dd2916f63ec4ab8e515c03424a55b4cdb18f3a4",
    "5",
    signer
  );

  console.log(hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
