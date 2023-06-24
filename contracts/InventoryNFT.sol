// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./libraries/Base64.sol";
import "hardhat/console.sol";

contract InventoryNFT is ERC721, ERC721URIStorage, Ownable,  ERC721Enumerable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    string public colour;
    string baseSvg = "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' style='fill:#";
    string finalPartSvg = ";stroke-width:0;stroke:rgb(0,0,0)' /></svg>";

    constructor(string memory name, string memory symbol, string memory _colour) ERC721(name, symbol) {
        transferOwnership(0xA260747C2C5aC0f8741e6C5d2F0976615bfE6b84);
        colour = _colour;
    }



    function safeMint(address to) public onlyOwner {
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        


        string memory finalSvg = string(
            abi.encodePacked(
                baseSvg,
                colour,
                finalPartSvg
            )
        );

        console.log("\n--------------------");
        console.log(finalSvg);
        console.log("--------------------\n");

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name":  "',
                        // We set the title of our NFT as the generated word.
                        "Inventory NFT  ",
             
                        '","description": "Inventory NFT ", "image": "data:image/svg+xml;base64,',
                        // We add data:image/svg+xml;base64 and then append our base64 encode our svg.
                        Base64.encode(bytes(finalSvg)),
                        '"}'
                    )
                )
            )
        );

        // Just like before, we prepend data:application/json;base64, to our data.
        string memory finalTokenUri = string(
            abi.encodePacked("data:application/json;base64,", json)
        );

        console.log("\n--------------------");
        console.log(finalTokenUri);
        console.log("--------------------\n");

        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, finalTokenUri);

        console.log(
            "An NFT w/ ID %s has been minted to %s",
            tokenId,
            msg.sender
        );
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
