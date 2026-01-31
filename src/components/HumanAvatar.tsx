import React from 'react';
import { AvatarConfig } from '@/types/karaoke';
import { avatarIdToConfig, getBodyColorValue, getHairColorValue, ACCESSORIES } from '@/data/avatars';
import { cn } from '@/lib/utils';

interface HumanAvatarProps {
  avatarId: string;
  size?: 'sm' | 'md' | 'lg';
  isSpeaking?: boolean;
  className?: string;
}

export const HumanAvatar: React.FC<HumanAvatarProps> = ({
  avatarId,
  size = 'md',
  isSpeaking = false,
  className,
}) => {
  const config = avatarIdToConfig(avatarId);
  const bodyColor = getBodyColorValue(config.bodyColor);
  const hairColor = getHairColorValue(config.hairColor);
  
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  const accessory = ACCESSORIES.find(a => a.id === config.accessory);

  return (
    <div 
      className={cn(
        'relative rounded-full flex items-end justify-center overflow-hidden',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: `${bodyColor}30` }}
    >
      {/* Body/Torso */}
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Body silhouette */}
        <ellipse
          cx="50"
          cy="95"
          rx="35"
          ry="25"
          fill={bodyColor}
        />
        
        {/* Head */}
        <circle
          cx="50"
          cy="42"
          r="22"
          fill={bodyColor}
        />
        
        {/* Hair based on style */}
        {config.hairStyle === 'short' && (
          <path
            d="M28 35 Q30 20 50 18 Q70 20 72 35 Q70 25 50 23 Q30 25 28 35"
            fill={hairColor}
          />
        )}
        {config.hairStyle === 'long' && (
          <>
            <path
              d="M28 35 Q30 18 50 16 Q70 18 72 35 Q70 23 50 21 Q30 23 28 35"
              fill={hairColor}
            />
            <path
              d="M28 35 Q25 55 28 70 L32 70 Q30 55 32 40 Z"
              fill={hairColor}
            />
            <path
              d="M72 35 Q75 55 72 70 L68 70 Q70 55 68 40 Z"
              fill={hairColor}
            />
          </>
        )}
        {config.hairStyle === 'spiky' && (
          <>
            <path d="M35 30 L40 10 L45 28 Z" fill={hairColor} />
            <path d="M45 28 L50 8 L55 26 Z" fill={hairColor} />
            <path d="M55 26 L60 10 L65 30 Z" fill={hairColor} />
            <path d="M28 38 L30 22 L38 35 Z" fill={hairColor} />
            <path d="M62 35 L70 22 L72 38 Z" fill={hairColor} />
          </>
        )}
        {config.hairStyle === 'curly' && (
          <>
            <circle cx="35" cy="25" r="8" fill={hairColor} />
            <circle cx="50" cy="22" r="9" fill={hairColor} />
            <circle cx="65" cy="25" r="8" fill={hairColor} />
            <circle cx="28" cy="35" r="7" fill={hairColor} />
            <circle cx="72" cy="35" r="7" fill={hairColor} />
          </>
        )}
        {config.hairStyle === 'ponytail' && (
          <>
            <path
              d="M28 35 Q30 18 50 16 Q70 18 72 35 Q70 23 50 21 Q30 23 28 35"
              fill={hairColor}
            />
            <ellipse cx="75" cy="40" rx="10" ry="15" fill={hairColor} />
            <rect x="68" y="35" width="10" height="8" fill={hairColor} />
          </>
        )}
        
        {/* Eyes */}
        <circle cx="42" cy="42" r="3" fill="white" />
        <circle cx="58" cy="42" r="3" fill="white" />
        <circle cx="42" cy="42" r="1.5" fill="#1f2937" />
        <circle cx="58" cy="42" r="1.5" fill="#1f2937" />
        
        {/* Smile */}
        <path
          d="M42 52 Q50 58 58 52"
          stroke="white"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      
      {/* Accessory overlay */}
      {config.accessory !== 'none' && (
        <div className={cn(
          'absolute text-center',
          size === 'sm' && 'text-xs -top-0.5',
          size === 'md' && 'text-sm -top-1',
          size === 'lg' && 'text-lg -top-1'
        )}>
          {accessory?.emoji}
        </div>
      )}
    </div>
  );
};
