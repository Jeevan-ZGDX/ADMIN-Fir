import React from "react";
import { useAuth } from "../context/AuthContext";

const Connect = ({ className }) => {
  const { account, connectWallet, isConnecting } = useAuth();

  return (
    <button 
      className={className} 
      onClick={connectWallet} 
      type="button"
      disabled={isConnecting || !!account}
    >
      {isConnecting ? "Connecting..." : account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
    </button>
  );
};

export default Connect;
