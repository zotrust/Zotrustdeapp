import React from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Zap,
  Lock,
  Globe,
  TrendingUp,
  CheckCircle,
  Smartphone,
  DollarSign,
  Award,
  Wallet,
  Scale
} from 'lucide-react';

const Benefits: React.FC = () => {
  const benefits = [
    {
      icon: Shield,
      title: 'No Bank Freeze Risk',
      description: 'Operate outside traditional banking systems. Your trades don\'t depend on banks, reducing freeze risk.',
      color: 'from-green-500/20 to-emerald-500/20',
      borderColor: 'border-green-500/30',
      iconColor: 'text-green-400'
    },
    {
      icon: Zap,
      title: 'Daily Cash ↔ USDT Trading',
      description: 'Seamlessly convert cash to USDT or USDT to cash daily via automated, peer‑to‑peer flows.',
      color: 'from-yellow-500/20 to-orange-500/20',
      borderColor: 'border-yellow-500/30',
      iconColor: 'text-yellow-400'
    },
    {
      icon: Globe,
      title: 'Global Access',
      description: 'Borderless access to decentralized financial transactions from anywhere in the world.',
      color: 'from-indigo-500/20 to-blue-500/20',
      borderColor: 'border-indigo-500/30',
      iconColor: 'text-indigo-400'
    },
    {
      icon: DollarSign,
      title: 'Low Transaction Fees',
      description: 'No intermediaries or centralized exchanges means significantly lower costs per trade.',
      color: 'from-green-500/20 to-teal-500/20',
      borderColor: 'border-green-500/30',
      iconColor: 'text-green-400'
    },
    {
      icon: Lock,
      title: 'Privacy & Security',
      description: 'Advanced encryption and on‑chain verification keep your identity and data private and secure.',
      color: 'from-purple-500/20 to-pink-500/20',
      borderColor: 'border-purple-500/30',
      iconColor: 'text-purple-400'
    },
    {
      icon: Smartphone,
      title: 'No Need for Physical Visits',
      description: 'Handle cash/USDT adjustments over verified calls—no repeated in‑person visits required.',
      color: 'from-violet-500/20 to-fuchsia-500/20',
      borderColor: 'border-violet-500/30',
      iconColor: 'text-violet-400'
    },
    {
      icon: Wallet,
      title: 'No Centralized Exchange Required',
      description: 'Trade directly via decentralized wallets like MetaMask or Trust Wallet with full fund control.',
      color: 'from-blue-500/20 to-cyan-500/20',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400'
    },
    {
      icon: Shield,
      title: 'Smart Contract Protection',
      description: 'Secure smart contracts govern every trade—no admin, agent, or third party can interfere.',
      color: 'from-emerald-500/20 to-green-500/20',
      borderColor: 'border-emerald-500/30',
      iconColor: 'text-emerald-400'
    },
    {
      icon: TrendingUp,
      title: 'Daily Arbitrage Opportunities',
      description: 'Capitalize on market fluctuations by buying low and selling high for consistent profit.',
      color: 'from-teal-500/20 to-cyan-500/20',
      borderColor: 'border-teal-500/30',
      iconColor: 'text-teal-400'
    },
    {
      icon: Scale,
      title: 'Tax Flexibility',
      description: 'Decentralized structure may enable tax optimizations depending on jurisdiction and setup.',
      color: 'from-amber-500/20 to-yellow-500/20',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400'
    },
    {
      icon: Award,
      title: 'Full Financial Freedom',
      description: 'Manage, trade, and grow assets without reliance on centralized systems—freedom and control.',
      color: 'from-pink-500/20 to-rose-500/20',
      borderColor: 'border-pink-500/30',
      iconColor: 'text-pink-400'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-md mx-auto pb-20">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-2"
      >
        <h1 className="text-3xl font-bold text-white">Platform Benefits</h1>
        <p className="text-violet-300 text-sm">
          Why choose our decentralized P2P trading platform?
        </p>
      </motion.div>

      {/* Benefits Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {benefits.map((benefit, index) => {
          const IconComponent = benefit.icon;
          return (
            <motion.div
              key={index}
              variants={itemVariants}
              className={`bg-gradient-to-r ${benefit.color} backdrop-blur-lg rounded-xl p-4 border ${benefit.borderColor} hover:scale-[1.02] transition-transform duration-200`}
            >
              <div className="flex items-start space-x-3">
                <div className={`flex-shrink-0 p-2 rounded-lg bg-black/20 ${benefit.iconColor}`}>
                  <IconComponent size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-base mb-1">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Call to Action */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 backdrop-blur-lg rounded-xl p-6 border border-violet-500/30 text-center space-y-3"
      >
        <h3 className="text-xl font-bold text-white">Ready to Get Started?</h3>
        <p className="text-violet-200 text-sm">
          Join thousands of users trading securely on our decentralized platform
        </p>
        <div className="flex flex-col space-y-2 pt-2">
          <div className="flex items-center justify-center space-x-2 text-violet-300 text-sm">
            <CheckCircle size={16} className="text-violet-400" />
            <span>No signup required</span>
          </div>
          <div className="flex items-center justify-center space-x-2 text-violet-300 text-sm">
            <CheckCircle size={16} className="text-violet-400" />
            <span>Just connect your wallet</span>
          </div>
          <div className="flex items-center justify-center space-x-2 text-violet-300 text-sm">
            <CheckCircle size={16} className="text-violet-400" />
            <span>Start trading in seconds</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Benefits;

