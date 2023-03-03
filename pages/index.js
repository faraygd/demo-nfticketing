import {
  useMetamask,
  useAddress,
  useContract,
  useNetwork,
  useNetworkMismatch,
  useContractMetadata,
  useTotalCirculatingSupply,
  useActiveClaimConditionForWallet,
  useClaimConditions,
  useClaimerProofs,
  useClaimIneligibilityReasons,
  Web3Button
} from "@thirdweb-dev/react";
import { ChainId } from "@thirdweb-dev/sdk";
import Head from "next/head";
import { toast, ToastContainer, lo } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BigNumber, utils } from "ethers";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import styles from "../styles/Theme.module.css";
const tokenId = 3;
export default function Home() {
  const address = useAddress();
  const metamaskWallet = useMetamask();
  // Contract & Data
  const { contract: editionDrop } = useContract(
    "0xe20b31df6137F2e559255A40d5f270d568896eB5",
    "edition-drop"
  );
  const { data: contractMetadata } = useContractMetadata(editionDrop);
  const [, switchNetwork] = useNetwork();
  const isWrongNetwork = useNetworkMismatch();
  useEffect(() => {
    // Checking Network is Goerli or Not every 5 Second if network wrong
    if (isWrongNetwork && switchNetwork) {
      setTimeout(() => {
        switchNetwork(ChainId.Goerli);
      }, 2000);
    }
  }, [address, isWrongNetwork, switchNetwork]);

  
  const claimedSupply = useTotalCirculatingSupply(editionDrop, tokenId);
  const claimConditions = useClaimConditions(editionDrop);
  const activeClaimCondition = useActiveClaimConditionForWallet(
    editionDrop,
    address,
    tokenId
  );
  const [quantity, setQuantity] = useState(1);
  const isLoading = useMemo(() => {
    return (
      activeClaimCondition.isLoading || claimedSupply.isLoading || !editionDrop
    );
  }, [activeClaimCondition.isLoading, editionDrop, claimedSupply.isLoading]);
  const totalAvailableSupply = useMemo(() => {
    try {
      return BigNumber.from(activeClaimCondition.data?.availableSupply || 0);
    } catch {
      return BigNumber.from(1_000_000);
    }
  }, [activeClaimCondition.data?.availableSupply]);
  const claimerProofs = useClaimerProofs(editionDrop, address || "", tokenId);
  const numberTotal = useMemo(() => {
    const n = totalAvailableSupply.add(BigNumber.from(claimedSupply.data || 0));
    if (n.gte(1_000_000)) {
      return "";
    }
    return n.toString();
  }, [totalAvailableSupply, claimedSupply]);
  const maxClaimable = useMemo(() => {
    let bnMaxClaimable;
    try {
      bnMaxClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimableSupply || 0
      );
    } catch (e) {
      bnMaxClaimable = BigNumber.from(1_000_000);
    }

    let perTransactionClaimable;
    try {
      perTransactionClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimablePerWallet || 0
      );
    } catch (e) {
      perTransactionClaimable = BigNumber.from(1_000_000);
    }

    if (perTransactionClaimable.lte(bnMaxClaimable)) {
      bnMaxClaimable = perTransactionClaimable;
    }

    const snapshotClaimable = claimerProofs.data?.maxClaimable;
    if (snapshotClaimable) {
      if (snapshotClaimable === "0") {
        // allowed unlimited for the snapshot
        bnMaxClaimable = BigNumber.from(1_000_000);
      } else {
        try {
          bnMaxClaimable = BigNumber.from(snapshotClaimable);
        } catch (e) {
          // fall back to default case
        }
      }
    }

    let max;
    if (totalAvailableSupply.lt(bnMaxClaimable)) {
      max = totalAvailableSupply;
    } else {
      max = bnMaxClaimable;
    }

    if (max.gte(1_000_000)) {
      return 1_000_000;
    }
    return max.toNumber();
  }, [
    claimerProofs.data?.maxClaimable,
    totalAvailableSupply,
    activeClaimCondition.data?.maxClaimableSupply,
    activeClaimCondition.data?.maxClaimablePerWallet,
  ]);
  const numberClaimed = useMemo(() => {
    return BigNumber.from(claimedSupply.data || 0).toString();
  }, [claimedSupply]);
  const isSoldOut = useMemo(() => {
    try {
      return (
        (activeClaimCondition.isSuccess &&
          BigNumber.from(activeClaimCondition.data?.availableSupply || 0).lte(
            0
          )) ||
        numberClaimed === numberTotal
      );
    } catch (e) {
      return false;
    }
  }, [
    activeClaimCondition.data?.availableSupply,
    activeClaimCondition.isSuccess,
    numberClaimed,
    numberTotal,
  ]);
  const claimIneligibilityReasons = useClaimIneligibilityReasons(
    editionDrop,
    {
      quantity,
      walletAddress: address || "",
    },
    tokenId
  );
  const canClaim = useMemo(() => {
    return (
      activeClaimCondition.isSuccess &&
      claimIneligibilityReasons.isSuccess &&
      claimIneligibilityReasons.data?.length === 0 &&
      !isSoldOut
    );
  }, [
    activeClaimCondition.isSuccess,
    claimIneligibilityReasons.data?.length,
    claimIneligibilityReasons.isSuccess,
    isSoldOut,
  ]);
  const buttonLoading = useMemo(
    () => isLoading || claimIneligibilityReasons.isLoading,
    [claimIneligibilityReasons.isLoading, isLoading]
  );
  const priceToMint = useMemo(() => {
    const bnPrice = BigNumber.from(
      activeClaimCondition.data?.currencyMetadata.value || 0
    );
    return `${utils.formatUnits(
      bnPrice.mul(quantity).toString(),
      activeClaimCondition.data?.currencyMetadata.decimals || 18
    )} ${activeClaimCondition.data?.currencyMetadata.symbol}`;
  }, [
    activeClaimCondition.data?.currencyMetadata.decimals,
    activeClaimCondition.data?.currencyMetadata.symbol,
    activeClaimCondition.data?.currencyMetadata.value,
    quantity,
  ]);
  const buttonText = useMemo(() => {
    if (isSoldOut) {
      return "Sold Out";
    }

    if (canClaim) {
      const pricePerToken = BigNumber.from(
        activeClaimCondition.data?.currencyMetadata.value || 0
      );
      if (pricePerToken.eq(0)) {
        return "Mint (Free)";
      }
      return `Mint (${priceToMint})`;
    }
    if (claimIneligibilityReasons.data?.length) {
      return parseIneligibility(claimIneligibilityReasons.data, quantity);
    }
    if (buttonLoading) {
      return "Checking eligibility...";
    }

    return "Claiming not available";
  }, [
    isSoldOut,
    canClaim,
    claimIneligibilityReasons.data,
    activeClaimCondition.data?.currencyMetadata.value,
    priceToMint,
    quantity,
  ]);
  return (
    <>
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        reverseOrder={false}
        theme="light"
      />
      <Head>
        <title>NFT Ticketing - Decentralized Ticketing System</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="min-h-screen bg-black">
        <header className="h-16 py-12 flex items-center justify-between pr-20 bg-pink-500">
          <div className="logo items-center flex ml-20">
            <div className="grid grid-cols-2">
              <div className="bg-white w-20 h-20 rounded-full"></div>
              <div className="grid grid-rows-2 ">
                <h2 className="text-white">TicketingNFT</h2>
                <h3 className="text-white">Powered by Cherry Labs</h3>
              </div>
            </div>
          </div>
          <nav className="mr-32">
            <ul className="text-white flex items-center space-x-6 font-bold text-md">
              <li>
                <a href="#">Home</a>
              </li>
              <li>
                <a href="#">Benefit</a>
              </li>
              <li>
                <a href="#about">About</a>
              </li>
            </ul>
          </nav>
        </header>
        {/* Hero */}
        <section className="section-hero my-10">
          <div className="grid max-w-screen-xl px-4 py-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12">
            <div className="mr-auto place-self-center lg:col-span-7">
              <h1 className="max-w-2xl mb-4 text-4xl font-extrabold tracking-tight leading-none md:text-5xl xl:text-6xl dark:text-white">
                Bring
                <br />
                Your Experience with Us
              </h1>
              <p className="max-w-2xl mb-6 font-light text-gray-500 lg:mb-8 md:text-lg lg:text-xl dark:text-gray-400">
                Buy music tickets easily and quickly for you
                <br /> using cryptocurrency.
              </p>
            </div>
            <div className="hidden lg:mt-0 lg:col-span-5 lg:flex">
              {isLoading ? (
                <p className="text-white ml-36 my-30 text-bold font-xl">
                  Loading...
                </p>
              ) : (
                <div className="w-96 h-auto pt-40">
                  <img
                    src="https://gateway.ipfscdn.io/ipfs/QmVDz9x8KvBBr7cesG34RrGsrorCZxv5nYJz4iEbXnPBh8/3.jpg"
                    alt={`${contractMetadata?.name} preview image`}
                  />
                  <div className="text-center bg-black text-white max-w-screen py-10">
                    {claimedSupply ? (
                      <p>
                        <b>{numberClaimed}</b>
                        {" / "}
                        {numberTotal || "∞"}
                      </p>
                    ) : (
                      // Show loading state if we're still loading the supply
                      <p>Loading...</p>
                    )}
                    {claimConditions.data?.length === 0 ||
                    claimConditions.data?.every(
                      (cc) => cc.maxClaimableSupply === "0"
                    ) ? (
                      <div>
                        <h2>
                          This drop is not ready to be minted yet. (No claim
                          condition set)
                        </h2>
                      </div>
                    ) : (
                      <>
                        <div className="flex tex-center justify-center flex-row gap-10 items-center py-4">
                          <button
                            className="text-white border rounded-lg w-14"
                            onClick={() => setQuantity(quantity - 1)}
                            disabled={quantity <= 1}
                          >
                            -
                          </button>

                          <h4>{quantity}</h4>

                          <button
                            className="text-white border rounded-lg w-14"
                            onClick={() => setQuantity(quantity + 1)}
                            disabled={quantity >= maxClaimable}
                          >
                            +
                          </button>
                        </div>

                        <div className={styles.mintContainer}>
                          {isSoldOut ? (
                            <button
                            className="bg-red-500 h-20 w-96 text-white z-100 hover:bg-red-600 font-bold"
                          >
                            Sold Out
                          </button>
                          ) : (
                            <Web3Button
                            contractAddress={editionDrop?.getAddress() || ""}
                            action={(cntr) => cntr.erc1155.claim(tokenId, quantity)}
                            isDisabled={!canClaim || buttonLoading}
                            className="bg-red-500"
                            onError={(err) => {
                              toast.error("Ticket Purchase Process Error");
                            }}
                            onSuccess={() => {
                              toast.success(
                                "Ticket Purchase Process Successful, Check your transaction"
                              );
                            }}
                          >
                            {buttonLoading ? "Loading..." : buttonText}
                          </Web3Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
        {/* Who Are We ( Ticketing ) */} */
        <section className="section-creator my-36">
          <div className="grid max-w-screen-xl px-4 py-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12">
            <div className="mr-auto place-self-center lg:col-span-7">
              <h1 className="max-w-2xl mb-4 text-4xl font-extrabold tracking-tight leading-none md:text-5xl xl:text-6xl dark:text-white">
                Who Are We
              </h1>
              <p className="max-w-2xl mb-6 font-light text-gray-500 lg:mb-8 md:text-lg lg:text-xl dark:text-gray-400">
                We are a story-driven humor-based fun-loving collection of
                wonderful and witty art meticulously hand-drawn by our artists.
                Our unique collection of dozens of story characters serves as
                the basis of our AI-generated art pieces that comprise the 7,777
                Genesis NFTs collection. Each Galaxy Peeps NFT will grant
                holders full intellectual property (IP) rights over their NFTs,
                exclusive club membership, IRL events, the creator NFT
                marketplace, airdrops, upcoming projects, a token into our
                ecosystem, and more. The collection is designed with a long-term
                growth-oriented vision for the Metaverse world. We are
              </p>
            </div>
          </div>
        </section>
        {/* Benefit */}
        {/* <section className="section-benefit my-36">
          <div className="grid max-w-screen-xl px-4 py-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12">
          <h1 className="font-extrabold max-w-2xl text-4xl tracking-tight leading-none xl:text-6xl md:text-5xl dark:text-white">Benefit</h1>
            <div className="grid grid-cols-3">
              <div>
                <img src="https://www.seedling.cm/assets/icon-chain-agnostic.png"></img>
              </div>
            </div>
          </div>
          
              
        </section> */}
        {/* Partner
        <section className="section-partner my-36">
          <div className="grid max-w-screen-xl px-4 py-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12">
            <div className="mr-auto place-self-center lg:col-span-7">
              <h1 className="max-w-2xl mb-4 text-4xl font-extrabold tracking-tight leading-none md:text-5xl xl:text-6xl dark:text-white">
                
              </h1>
            </div>
          </div>
        </section> */}
        {/* FAQ */}
        {/* <section className="section-partner my-36">
          <div className="grid max-w-screen-xl px-4 py-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12">
            <div className="mr-auto place-self-center lg:col-span-7">
              <h1 className="max-w-2xl mb-4 text-4xl font-extrabold tracking-tight leading-none md:text-5xl xl:text-6xl dark:text-white">
                FAQ
              </h1>
            </div>
          </div>
        </section>
        <footer className="section-partner bg-red-500 max-w-screen h-auto"></footer> */}
      </main>
    </>
  );
}
