import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, Phone, Shield, ArrowLeftRight, FileText, DollarSign, Globe, Lock, Star } from 'lucide-react';

const UserGuide: React.FC = () => {
  const steps = [
    {
      icon: Wallet,
      title: 'Connect Your Wallet',
      description: 'Connect Trust Wallet, MetaMask, OKX Wallet, etc. No signup, no KYC, and no exchange deposits — you stay in full control.'
    },
    {
      icon: ArrowLeftRight,
      title: 'Choose What You Want to Do',
      description: 'Buy USDT (pay via cash/bank) or Sell USDT (receive cash/bank). See best offers from verified users/agents near you.'
    },
    {
      icon: Lock,
      title: 'Trade Escrow Begins (Smart Contract Lock)',
      description: 'When a trade starts, the seller’s USDT is locked in a smart contract escrow until both sides confirm.'
    },
    {
      icon: DollarSign,
      title: 'Buyer Makes the Payment',
      description: 'Buyer pays seller directly via cash, UPI, or bank transfer as selected, then clicks “Payment Done”.'
    },
    {
      icon: Shield,
      title: 'Smart Contract Auto‑Release',
      description: 'After the seller verifies payment, the smart contract automatically releases USDT to the buyer — instant and trustless.'
    },
    {
      icon: Phone,
      title: 'Agent Support (Optional)',
      description: 'Verified “Aagnya Agents” help convert cash ↔ USDT. Once balance is set, trade anytime without repeated physical visits.'
    },
    {
      icon: Shield,
      title: 'Smart Contract Escrow Explained',
      description: 'Think of it like a digital locker that opens only when both sides agree. No admin or middleman can touch funds.'
    },
    {
      icon: FileText,
      title: 'Zotrust Fee Structure',
      description: 'Platform fee is only 1.8% per transaction. No hidden fees or withdrawal fees. Charges shown before confirming.'
    },
    {
      icon: Star,
      title: 'Reputation & Trust System',
      description: 'Users and agents have trust scores from trading history. Higher score = more visibility; fraud is auto‑detected and flagged.'
    },
    {
      icon: Globe,
      title: 'Once Setup, Always Easy',
      description: 'After setting an amount with an agent (e.g., ₹1 lakh USDT), keep trading daily over calls/online without visiting again.'
    }
  ];

  return (
    <div className="p-4 space-y-6 max-w-md mx-auto pb-20">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-2"
      >
        <h1 className="text-3xl font-bold text-white">🪙 How Zotrust Works — Simple Explanation for Users</h1>
        <p className="text-violet-300 text-sm">Zotrust is a decentralized P2P USDT trading platform. No banks, no middlemen — trades are secured by blockchain smart contracts.</p>
      </motion.div>

      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={index}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className="bg-violet-500/10 backdrop-blur-lg rounded-xl p-4 border border-violet-500/20"
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 p-2 rounded-lg bg-black/20 text-violet-400">
                  <Icon size={22} />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-base mb-1">{step.title}</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default UserGuide;


