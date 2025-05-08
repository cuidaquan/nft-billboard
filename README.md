# NFT Billboards - On-Chain Dynamic NFT Billboard System

English Version | [中文版本](README.zh.md)

## Project Pitch Document

[NFT Billboards - Redefining the Future of Blockchain Advertising](https://docs.google.com/presentation/d/1Z6Z76FO2ic5CaJslffXbwi5LyZhI2WMp-TBrOnKK-Sc/edit?usp=sharing)

## Project Overview

NFT Billboards is an innovative blockchain advertising platform that transforms virtual world advertising spaces into tradable NFT assets. We leverage Sui blockchain's object model, combined with the Walrus decentralized storage network, to achieve dynamic updates and secure storage of advertising content. This billboard system is adaptable to various virtual world scenarios including blockchain games, metaverse, and Web3 applications.

### Core Values

- **NFT-ization of Ad Spaces**: Transform advertising resources into unique assets on the blockchain
- **Dynamic Content Updates**: Update advertising content without redeployment
- **Transparent Leasing Mechanism**: Automated leasing and renewal processes based on smart contracts
- **Decentralized Storage**: Secure storage of advertising content using the Walrus network

## System Architecture

The project adopts a three-layer architecture design:

1. **Smart Contract Layer**: Move smart contracts based on Sui blockchain, handling core business logic
2. **Frontend Application Layer**: User interface built with React + TypeScript, providing intuitive interaction experience
3. **Storage Layer**: Walrus decentralized storage network, ensuring secure and reliable storage of advertising content

## Directory Structure

```
nft-billboard/
├── README.md                # Project documentation
├── nft_billboard/       # Move smart contract directory
│   ├── sources/             # Contract source code
│   │   ├── ad_space.move    # Ad space related functionality
│   │   ├── nft_billboard.move # Main contract module
│   │   ├── factory.move     # Factory contract
│   │   └── nft.move         # NFT related functionality
│   ├── tests/               # Contract tests
│   └── build/               # Compilation output
└── nft_billboard_web/   # Frontend project directory
    ├── src/                 # Frontend source code
    │   ├── components/      # Components
    │   ├── pages/           # Pages
    │   ├── hooks/           # Custom hooks
    │   ├── utils/           # Utility functions
    │   └── assets/          # Static resources
    └── public/              # Public resources
```

## Core Features

### 1. Ad Space Management

- Platform administrators can register game developers
- Game developers can create and manage ad spaces
- Ad spaces include attributes such as location, size, price, etc.

### 2. NFT Billboards

- Users can purchase ad spaces to obtain NFT ownership
- Support for flexible lease terms from 1 to 365 days
- Smart pricing algorithm ensures better value for long-term leasing

### 3. Content Management

- NFT holders can dynamically update advertising content
- Content is stored on the Walrus decentralized network
- All updates are traceable on the blockchain

### 4. Permission System

- Multi-level permission control ensures system security
- Access control based on address verification
- Comprehensive error handling mechanism

## Technology Stack

- **Blockchain**: Sui
- **Smart Contract**: Move
- **Frontend Framework**: React 18 + TypeScript
- **UI Components**: Ant Design
- **Wallet Integration**: @mysten/dapp-kit
- **Storage Solution**: Walrus

## Quick Start

### Smart Contract

```bash
# Enter contract directory
cd nft_billboard

# Compile contract
sui move build

# Run tests
sui move test

# Publish contract
sui client publish --gas-budget 100000000
```

### Frontend Application

```bash
# Install dependencies
cd nft_billboard_web
npm install

# Start development server
npm start

# Build production version
npm run build
```

## Core Data Structures

### Factory Contract

```move
public struct Factory has key {
    id: UID,
    admin: address,
    ad_spaces: vector<AdSpaceEntry>,  // Changed to vector<AdSpaceEntry>, easier to display in JSON
    game_devs: vector<address>, // List of game developer addresses
    platform_ratio: u8   // Platform commission ratio, percentage
}
```

### Ad Space

```move
public struct AdSpace has key, store {
    id: UID,
    game_id: String,          // Game ID
    location: String,         // Location information
    size: String,            // Ad size
    is_available: bool,        // Whether it's available for purchase
    creator: address,          // Creator address
    created_at: u64,           // Creation time
    fixed_price: u64,          // Base fixed price (in SUI, representing the daily rental price)
}
```

### Billboard NFT

```move
public struct AdBoardNFT has key, store {
    id: UID,
    ad_space_id: ID,           // Corresponding ad space ID
    owner: address,            // Current owner
    brand_name: String,        // Brand name
    content_url: String,       // Content URL or pointer
    project_url: String,       // Project URL
    lease_start: u64,          // Lease start time
    lease_end: u64,            // Lease end time
    is_active: bool,           // Whether it's active
    blob_id: Option<String>,   // Blob ID in Walrus
    storage_source: String,    // Storage source ("walrus" or "external")
}
```

## Smart Pricing Algorithm

The system uses an exponential decay model to calculate rental prices, ensuring better value for long-term leasing:

```move
// Core logic of price calculation
let daily_price = ad_space.fixed_price;
let ratio = 977000; // Decay factor (0.977)
let base = 1000000; // Base
let min_daily_factor = 500000; // Minimum daily factor (0.5)

// Calculate total price
let total_price = daily_price; // First day at full price
let mut factor = base;
let mut i = 1;

while (i < lease_days) {
    factor = factor * ratio / base;

    if (factor < min_daily_factor) {
        total_price = total_price + daily_price * min_daily_factor * (lease_days - i) / base;
        break
    };

    total_price = total_price + daily_price * factor / base;
    i = i + 1;
}
```

## Frontend Pages

- **Home**: System introduction and feature navigation
- **Ad Space List**: Browse and filter available ad spaces
- **Ad Space Details**: View detailed information and purchase ad spaces
- **My NFTs**: Manage purchased billboard NFTs
- **Management Page**: Features exclusive to developers and administrators

## Security Considerations

- Multi-level permission verification based on addresses
- Lease validity verification
- Payment amount verification and refund of excess funds
- Content hash verification to ensure content integrity

## Deployment Guide

### Contract Deployment

1. Ensure Sui CLI is installed and wallet is configured
2. Compile and publish the contract to testnet or mainnet
3. Record the contract package ID and factory object ID

### Frontend Deployment

1. Set contract-related parameters in the environment configuration file (.env.production)
2. Build the frontend application: `npm run build`
3. Deploy to static website hosting service

## Future Plans

1. Ad effectiveness analysis functionality
2. Support for more ad types
3. Multi-chain deployment support
4. Mobile optimization
5. Community governance mechanism
