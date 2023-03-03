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
  Web3Button,
} from "@thirdweb-dev/react";
import { ChainId } from "@thirdweb-dev/sdk";
import Head from "next/head";
import { toast, ToastContainer, lo } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BigNumber, utils } from "ethers";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import styles from "../styles/Theme.module.css";
import About from "./components/About";
import Benefit from "./components/Benefit";
import { Navbar } from "./components/Navbar";
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
        return "Beli Tiket Gratis";
      }
      return `Beli Tiket`;
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
        <Navbar />
        <section className="section-hero my-10">
          <div className="grid max-w-screen-xl px-4 py-8 mx-auto sm:grid-cols-10 lg:gap-8 xl:gap-0 lg:grid-cols-12">
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
            <div className="lg:mt-2 lg:col-span-5 lg:flex">
              {isLoading ? (
                <p className="text-white ml-36 my-30 text-bold font-xl">
                  Loading...
                </p>
              ) : (
                <div className="w-96 h-auto pt-20">
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
                        <p>Harga Tiket : ${priceToMint}</p>
                        <div className={styles.mintContainer}>
                          {isSoldOut ? (
                            <button className="bg-red-500 h-20 w-96 text-white z-100 hover:bg-red-600 font-bold">
                              Sold Out
                            </button>
                          ) : (
                            <Web3Button
                              contractAddress={editionDrop?.getAddress() || ""}
                              action={(contract) =>
                                contract.erc1155.claim(tokenId, quantity)
                                
                              }
                              isDisabled={!canClaim || buttonLoading}
                              className="border-white"
                              onError={(err) => {
                                toast.error("Ticket Purchase Process Error");
                                toast.dismiss(toast.loading);
                              }}
                              onSuccess={() => {
                                setQuantity(1);
                                toast.success(
                                  "Ticket Purchase Process Successful, Check your transaction"
                                );
                                toast.dismiss(toast.loading);
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
        <About />
        {/* Benefit */}
        <Benefit />
      </main>
    </>
  );
}
