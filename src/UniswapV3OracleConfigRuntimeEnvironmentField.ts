import { HardhatRuntimeEnvironment } from "hardhat/types";
import { UniSwapPoolResolver } from "./resolver/poolResolver";
import { Pool } from "./resolver/types";
import { UniSwapPoolMocker } from "@chaos-labs/uniswap-v3-pool-mocker"
  
export class UniswapV3OracleConfig {
    hre: HardhatRuntimeEnvironment;

    constructor(hre: HardhatRuntimeEnvironment){
        this.hre = hre;
    }

    public async CreatePool(token0Adress: string, token1Adress: string): Promise<string> {
        return await new UniSwapPoolResolver(this.hre.config.networks.localhost.url)
            .CreatePool(token0Adress, token1Adress);
    }

    public async MockPoolPrice(poolAddress: string, twapInterval: number, price: number): Promise<void> {
        const pool: Pool = await new UniSwapPoolResolver(this.hre.config.networks.localhost.url)
            .GetPoolMetadata(poolAddress);

        await new UniSwapPoolMocker(this.hre.config.networks.localhost.url, pool.address)
            .MockPrice(price, twapInterval, pool.decimals.token0, pool.decimals.token1);
    }

    public async OverrideCurrentObservationTimestamp(poolAddress: string, timestamp: number): Promise<void> {
        return await new UniSwapPoolResolver(this.hre.config.networks.localhost.url)
            .OverrideCurrentObservationTimestamp(poolAddress, timestamp);
    }

    public async ShowPrices(poolAddress: string, twapInterval: number): Promise<number[]> {
        const pool: Pool = await new UniSwapPoolResolver(this.hre.config.networks.localhost.url)
            .GetPoolMetadata(poolAddress);

        return await new UniSwapPoolMocker(this.hre.config.networks.localhost.url, pool.address)
            .Prices(twapInterval, pool.decimals.token0, pool.decimals.token1);
    }
}