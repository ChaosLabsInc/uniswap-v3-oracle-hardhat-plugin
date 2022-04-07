import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import { ethers } from 'ethers';
import { HardhatPluginError } from "hardhat/plugins";
import { assert } from 'chai';
import { UniSwapPoolResolver, Pool } from '../src/resolver'
import { Observation } from "@chaos-labs/uniswap-v3-pool-mocker";

import 'mocha';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
const expect = chai.expect;

const rpcUrl: string = "http://localhost:8545";
const PoolDoesNotExistAddress: string = "0x0000000000000000000000000000000000000000";
const UninitializedBigNumberHex = "0x00";
const PluginName: string = "uniswap-v3-oracle-plugin"

describe('PoolResolverTests', () => {
    const resolver: UniSwapPoolResolver = new UniSwapPoolResolver(rpcUrl);
    const provider: ethers.providers.JsonRpcProvider = new ethers.providers.JsonRpcProvider(rpcUrl);

    describe('CreatePool', () => {
        it('Success', async () => {
            const tokenA: string = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
            const tokenB: string = "0xd2877702675e6cEb975b4A1dFf9fb7BAF4C91ea9";

            const newPoolAddress: string = await resolver.CreatePool(tokenA, tokenB);
            expect(newPoolAddress).to.not.equal(PoolDoesNotExistAddress);

            const poolContract: ethers.Contract = new ethers.Contract(newPoolAddress, IUniswapV3PoolABI, provider);
            const [slot0, tokenAResult, tokenBResult] = await Promise.all(
                [poolContract.slot0(), poolContract.token0(), poolContract.token1()]);

            expect(tokenAResult).to.equal(tokenB);
            expect(tokenBResult).to.equal(tokenA);
            expect(slot0.sqrtPriceX96._hex).to.not.equal(UninitializedBigNumberHex);
        });

        it('TokenA and TokenB are equal', async () => {
            await expect(resolver.CreatePool("token", "token"))
                .to.eventually.be.rejected
                .and.be.an.instanceOf(HardhatPluginError)
                .and.have.property("message", "The provided tokens addresses are the same, cannot create pool");
        });

        it('Invalid token address', async () => {
            const badToken: string = "0xdAC17F958D2ee523a2206206994597C13D831ec6";
            const goodToken: string = "0xd2877702675e6cEb975b4A1dFf9fb7BAF4C91ea9";

            await expect(resolver.CreatePool(badToken, goodToken))
                .to.eventually.be.rejected
                .and.be.an.instanceOf(HardhatPluginError)
                .and.have.property("message", `Invalid token adress - ${badToken}`);
        });

        it('Pool already exist', async () => {
            const tokenA: string = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
            const tokenB: string = "0xdac17f958d2ee523a2206206994597c13d831ec7";

            await expect(resolver.CreatePool(tokenA, tokenB))
                .to.eventually.be.rejected
                .and.be.an.instanceOf(HardhatPluginError)
                .and.have.property("message", "Pool with the same parameters already exist at address 0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36");
        });
    });

    describe('GetPoolMetadata', () => {
        it('Success', async () => {
            const poolAddress: string = "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36";
            const pool: Pool = await resolver.GetPoolMetadata(poolAddress);

            expect(pool.name).to.equal("WETH/USDT");
            expect(pool.address).to.equal(poolAddress);
            expect(pool.decimals.token0).to.equal(18);
            expect(pool.decimals.token1).to.equal(6);
        });

        it('Invalid pool address', async () => {
            const poolAddress: string = "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa37";
            await expect(resolver.GetPoolMetadata(poolAddress))
                .to.eventually.be.rejected
                .and.be.an.instanceOf(HardhatPluginError)
                .and.have.property("message", `Invalid pool adress - ${poolAddress}`);
        });
    });

    describe('OverrideCurrentObservationTimestamp', () => {
        it('Success', async () => {
            const tokenA: string = "0xc944E90C64B2c07662A292be6244BDf05Cda44a7";
            const tokenB: string = "0xd2877702675e6cEb975b4A1dFf9fb7BAF4C91ea9";

            const newPoolAddress: string = await resolver.CreatePool(tokenA, tokenB);

            const poolContract: ethers.Contract = new ethers.Contract(newPoolAddress, IUniswapV3PoolABI, provider);
            await resolver.OverrideCurrentObservationTimestamp(newPoolAddress, 10);
            const observation0: Observation = await poolContract.observations([0]);
            expect(observation0.blockTimestamp).to.equal(10);
        });

        it('Invalid pool address', async () => {
            const poolAddress: string = "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa37";
            await expect(resolver.OverrideCurrentObservationTimestamp(poolAddress, 10))
                .to.eventually.be.rejected
                .and.be.an.instanceOf(HardhatPluginError)
                .and.have.property("message", `Invalid pool adress - ${poolAddress}`);
        });
    });
});