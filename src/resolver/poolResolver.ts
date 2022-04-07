import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import { abi as IUniswapV3FactoryABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json";
import { BigNumber, ethers } from "ethers";
import { Pool } from "./types";
import { HardhatPluginError } from "hardhat/plugins";
import { UniSwapPoolMocker } from "@chaos-labs/uniswap-v3-pool-mocker";

const ERC20ABI = require("./ERC20.json");
const UniswapV3FactoryAdress: string = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const PluginName: string = "uniswap-v3-oracle-plugin"
const BadAddressErrorMessage: string = "bad address checksum"
const PoolDoesNotExistAddress: string = "0x0000000000000000000000000000000000000000";
const DefaultFee: number = 3000;
const DefaultSqrtPrice: number = 4295128739;

export class UniSwapPoolResolver{
    private rpcUrl: string;
    private provider: ethers.providers.JsonRpcProvider;

    constructor(rpcUrl: string){
        this.rpcUrl = rpcUrl;
        this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    }

    public async CreatePool(token0Adress: string, token1Adress: string): Promise<string> {
        await this.ValidateCreatePoolParams(token0Adress, token1Adress);

        const factoryContract: ethers.Contract = new ethers.Contract(
            UniswapV3FactoryAdress, IUniswapV3FactoryABI, this.provider.getSigner());

        await factoryContract.createPool(token0Adress, token1Adress, DefaultFee);
        const newPoolAddress: string = await factoryContract.getPool(token0Adress, token1Adress, DefaultFee);

        const poolContract: ethers.Contract = new ethers.Contract(newPoolAddress, IUniswapV3PoolABI, this.provider.getSigner());
        await poolContract.initialize(DefaultSqrtPrice);

        return newPoolAddress;
    }

    public async GetPoolMetadata(poolAddress: string): Promise<Pool> {
        const [token0Adress, token1Adress] = await this.GetPoolsTokenAddresses(poolAddress);
        const [[token0Symbol, token0Decimals], [token1Symbol, token1Decimals]] = await Promise.all(
            [this.GetTokenMetadata(token0Adress), this.GetTokenMetadata(token1Adress)]);

        return {
            name: `${token0Symbol}/${token1Symbol}`,
            address: poolAddress,
            decimals: {
                token0: token0Decimals,
                token1: token1Decimals
            }
        };
    }

    public async OverrideCurrentObservationTimestamp(poolAddress: string, timestamp: number): Promise<void> {
        // GetPoolsTokenAddresses being called for pool address validation
        await this.GetPoolsTokenAddresses(poolAddress);

        const poolContract: ethers.Contract = new ethers.Contract(poolAddress, IUniswapV3PoolABI, this.provider);
        const ob0Index: number = (await poolContract.slot0()).observationIndex as number;
        await new UniSwapPoolMocker(this.rpcUrl, poolAddress).OverrideObservationTimestamp(timestamp, ob0Index);
    }

    private async ValidateCreatePoolParams(token0Adress: string, token1Adress: string): Promise<void> {
        if (token0Adress === token1Adress) {
            throw new HardhatPluginError(PluginName, "The provided tokens addresses are the same, cannot create pool");
        }

        await Promise.all(
            [
                this.ValidateTokenAdress(token0Adress),
                this.ValidateTokenAdress(token1Adress),
                this.ValidatePoolDoesNotExist(token0Adress, token1Adress, DefaultFee)
            ]);
    }

    private async ValidateTokenAdress(tokenAdress: string): Promise<void> {
        try {
            await this.GetTokenMetadata(tokenAdress);
        }
        catch (ex: any) {
            if (ex.reason === BadAddressErrorMessage) {
                throw new HardhatPluginError(PluginName, `Invalid token adress - ${tokenAdress}`)
            }
            throw ex;
        }
    }

    private async ValidatePoolDoesNotExist(token0Adress: string, token1Adress: string, fee: number): Promise<void> {
        const factoryContract: ethers.Contract = new ethers.Contract(
            UniswapV3FactoryAdress, IUniswapV3FactoryABI, this.provider.getSigner());
        const poolAddress: string = await factoryContract.getPool(token0Adress, token1Adress, fee);
        if (poolAddress !== PoolDoesNotExistAddress) {
            throw new HardhatPluginError(
                PluginName, `Pool with the same parameters already exist at address ${poolAddress}`);
        }
    }

    private async GetPoolsTokenAddresses(poolAddress: string): Promise<[string, string]> {
        const poolContract: ethers.Contract = new ethers.Contract(poolAddress, IUniswapV3PoolABI, this.provider);
        try {
            return await Promise.all(
                [poolContract.token0(), poolContract.token1()]);
        }
        catch (ex: any){
            if (ex.reason === BadAddressErrorMessage) {
                throw new HardhatPluginError(PluginName, `Invalid pool adress - ${poolAddress}`)
            }
            throw ex;
        }
    }

    private async GetTokenMetadata(tokenAdress: string): Promise<[string, number]>{
        const tokenContract: ethers.Contract = new ethers.Contract(tokenAdress, ERC20ABI, this.provider);
        const [tokenName, tokenDecimals] = await Promise.all(
            [tokenContract.symbol(), tokenContract.decimals()]);

        return [tokenName, tokenDecimals];
    }
}