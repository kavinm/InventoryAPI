pragma solidity ^0.8.0;

import "./InventoryNFT.sol";

contract NFTFactory {
    event CollectionCreated(address newNFTAddress); // The new event

    function createCollection(string memory _name, string memory _colour) public returns (address) {
        InventoryNFT newNFT = new InventoryNFT(_name, "INVT", _colour);
        address newNFTAddress = address(newNFT);
        
        emit CollectionCreated(newNFTAddress); // Emit the event

        return newNFTAddress;
    }
}
