import React from 'react';
import logo from '../logo.jpeg';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  className = '' 
}) => {
  return (
    <img 
      src={logo} 
      alt="Zotrust Logo" 
      className={`mx-auto w-32 h-32 object-contain ${className}`}
    />
  );
};

export default Logo;

