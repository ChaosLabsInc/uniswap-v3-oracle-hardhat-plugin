![Chaos Labs - Uniswap Collaboration](https://github.com/ChaosLabsInc/uniswap-v3-oracle-cli/blob/main/img/ChaosLabsUniswap.jpg)

This repository hosts a hardhat plugin for configuring Uniswap V3 Oracle prices in a local hardhat mainnet fork testing environment.

For a full deep dive to the project architecture please review the following posts:

- [Uniswap v3 TWAP Deep Dive Pt. 2](https://chaoslabs.xyz/posts/chaos-labs-uniswap-v3-twap-deep-dive-pt-2)
- [Uniswap v3 TWAP Deep Dive Pt. 1](https://chaoslabs.xyz/posts/chaos-labs-uniswap-v3-twap-deep-dive-pt-1)

This project was proudly developed with grants from the [Uniswap Grants Program (UGP)](https://unigrants.org).

## Why is Mocking Oracle values useful in testing?

Oracle return values trigger internal state changes in web3 applications. When forking mainnent, TWAP oracles are static by default since no trades are executed in an isolated forked environment. If your application consumes price data and initiates control flows based on these values, being able to test a range of prices is critical. However, manipulating prices to bring an application to a specific state requires an unreasoable amount of trades in pools. This is because TWAP oracle prices are determined by the pair ratio of liquidity in the pools at the time of the observations recorded. When we have a myriad of liquidity pools configuring prices can become a tedious process that involves a lot of custom scripting and hacks. Chaos Labs aims to streamline developer productivity while also making it easier to test applications. This tool gives developers the ability to mock return values easily. Now we can test how our contracts / applications react to different types of external data 🤗. Below, we provide some specific use cases for mocking oracle return values.

## Use Cases

DeFi protocols and applications are at high risk due to volatile market conditions and a myriad of security vectors. Mocking Uniswap V3 Oracle return values in a controlled, siloed testing environment allows us to address 2 common vectors.

**Volatile Market Conditions**

Volatility is a DeFi constant and is something that all protocols and applications should test for thoroughly. Internal application and protocol state is often a direct result of Oracle returns values. Because of this, controlling oracle return values in development is extremely powerful. To further illustrate this let's use an example.

Imagine a lending protocol (Maker, AAVE, Benqi, Spectral.finance, etc..) that accepts Ethereum as collateral against stablecoin loans. What happens on a day like Black Thursday, when Ethereum prices cascade negatively to the tune of ~70% in a 48 hour time frame? Well, a lot of things happen 🤦.

![Black Thursday Img](https://github.com/ChaosLabsInc/uniswap-v3-oracle-cli/blob/main/img/Cascading-ETH.png)

One critical aspect of responding to market volatiltiy is protocol keepers triggering liquidations and thus ensuring protocol solvency.

With the ability to control Oracle return values, simulating such scenarios in your local development environment is possible.

**Oracle Manipulation**

Oracle manipulation is an additional attack vector. With this method, malicious actors research data sources that various oracle consume as sources of truth. When actors possess the ability to manipulate the underlying data source they trigger downstream effects, manifesting in altered Oracle return values. As a result of manipulated data, actors and contracts can trigger various unwanted behaviours such as modified permissions, transaction execution, emergency pausing / shutdown and more.

With the ability to manipulate Uniswap V3 Oracle return values, simulating such scenarios in your local development environment is possible.

## Prerequisites

- In order to use the plugin correctly we'll want to run a mainnet fork. We need the fork so we can have a snapshot of all deployed Uniswap Pools and access to their Oracle interfaces. Uniswap v3 Oracles interface can be challenging to fork at first. That's why recommend reading the offical docs as well as checking out the [Chaos Labs blog](https://chaoslabs.xyz/blog).
  `Hardhat` has an Alchemy integration. In order to fork mainnet you need an API key, so navigate to the alchemy site and sign up for one. Alchemy API key for mainnet fork access: [Get one here](https://www.alchemy.com/).
- We assume you have npm installed, if not go to https://nodejs.org/en/download/ and follow the instructions.

## Installation

**Step 1**

```bash
npm install @chaos-labs/uniswap-v3-oracle-hardhat-plugin
```

**Step 2**

Import the plugin in your `hardhat.config.js`:

```js
require("@chaos-labs/uniswap-v3-oracle-hardhat-plugin");
```

Or if you are using TypeScript, in your `hardhat.config.ts`:

```ts
import "@chaos-labs/uniswap-v3-oracle-hardhat-plugin";
```

## Interfaces

this plugin extend the [HardhatRuntimeEnvironment](https://hardhat.org/advanced/hardhat-runtime-environment.html) by adding `UniswapV3OracleConfig` object to the runtime envionment.
`UniswapV3OracleConfig` expose the following methods:

**CreatePool(token0Adress: string, token1Adress: string): Promise\<string\>:**
CreatePool receives two ERC-20 token's addresses and return the address of the newly deployed pool.
In the following cases the method will throw `HardhatPluginError` exception:

- token0Adress === token1Adress
- At least one of the tokens addresses is invalid
- Pool with the same pair already exist.

  **OverrideCurrentObservationTimestamp(poolAddress: string, timestamp: number): Promise\<void\>:**
  OverrideCurrentObservationTimestamp receives a pool address and a timestamp, and override the current observation (the observation with index eqaul to slot0.observationIndex) blockTimestamp property.
  Please note that we need to invoke this method on pools we deployed with the `CreatePool` method prior to the invokation of `ShowPrices` and `MockPoolPrice` methods with TWAP interval larger then 0.
  In the following case the method will throw `HardhatPluginError` exception:

- poolAddress is an invalid address.

  **MockPoolPrice(poolAddress: string, twapInterval: number, price: number): Promise\<void\>:**
  MockPoolPrice receives a pool address, twap interval and the mocked price of the oracle. the method mock the return value of the oracle for the given interval.
  In the following case the method will throw `HardhatPluginError` exception:

- poolAddress is an invalid address.

  **ShowPrices(poolAddress: string, twapInterval: number): Promise\<number[]\>:**
  ShowPrices receives a pool address and the twap interval, and return the pool's pair prices as calculated with the given interval.
  In the following case the method will throw `HardhatPluginError` exception:

- poolAddress is an invalid address.

## Usage

at hardhat.config.js:

```js
const { task } = require("hardhat/config");

require("@chaos-labs/uniswap-v3-oracle-hardhat-plugin");

task("demo1", async () => {
  // Create new pool USDT\LUNA
  const usdtTokenAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  const lunaTokenAddress = "0xd2877702675e6cEb975b4A1dFf9fb7BAF4C91ea9";
  const newPoolAdress = await uniswapV3OracleConfig.CreatePool(usdtTokenAddress, lunaTokenAddress);

  const currentObservationTimestamp = 100;
  await uniswapV3OracleConfig.OverrideCurrentObservationTimestamp(newPoolAdress, currentObservationTimestamp);

  const twapInterval = 5;
  const mockedPrice = 20;

  // Show price
  const originalPrices = await uniswapV3OracleConfig.ShowPrices(newPoolAdress, twapInterval);
  console.log("original prices - " + originalPrices);

  // Mock price
  await uniswapV3OracleConfig.MockPoolPrice(newPoolAdress, twapInterval, mockedPrice);

  // Show price after mock
  const updatedPrices = await uniswapV3OracleConfig.ShowPrices(newPoolAdress, twapInterval);
  console.log("updated prices - " + updatedPrices);
});

task("demo2", async () => {
  const poolAdress = "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36";
  const twapInterval = 5;
  const mockedPrice = 20;

  // Show price
  const originalPrices = await uniswapV3OracleConfig.ShowPrices(poolAdress, twapInterval);
  console.log("original prices - " + originalPrices);
  // Mock price
  await uniswapV3OracleConfig.MockPoolPrice(poolAdress, twapInterval, mockedPrice);

  // Show price after mock
  const updatedPrices = await uniswapV3OracleConfig.ShowPrices(poolAdress, twapInterval);
  console.log("updated prices - " + updatedPrices);
});
```

## Run Tests

1. Restart the mainnet fork for a fresh state.

2. Run tests with the following command:

```bash
npm run build && npm run test
```
