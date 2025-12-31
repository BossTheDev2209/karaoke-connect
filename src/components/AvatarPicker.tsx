import React, { useState, useEffect } from 'react';
import { AvatarConfig } from '@/types/karaoke';
import { 
  BODY_COLORS, 
  HAIR_STYLES, 
  HAIR_COLORS, 
  ACCESSORIES,
  avatarConfigToId,
  avatarIdToConfig,
  generateRandomAvatar,
  isAvatarUnique
} from '@/data/avatars';
import { HumanAvatar } from './HumanAvatar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Shuffle } from 'lucide-react';

interface AvatarPickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
  existingAvatarIds?: string[];
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ 
  selectedId, 
  onSelect,
  existingAvatarIds = []
}) => {
  const [config, setConfig] = useState<AvatarConfig>(() => avatarIdToConfig(selectedId));
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  useEffect(() => {
    const newId = avatarConfigToId(config);
    const isUnique = isAvatarUnique(newId, existingAvatarIds);
    setShowDuplicateWarning(!isUnique);
    onSelect(newId);
  }, [config, onSelect, existingAvatarIds]);

  const updateConfig = (key: keyof AvatarConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const randomize = () => {
    let newConfig = generateRandomAvatar();
    let attempts = 0;
    // Try to generate a unique avatar
    while (!isAvatarUnique(avatarConfigToId(newConfig), existingAvatarIds) && attempts < 10) {
      newConfig = generateRandomAvatar();
      attempts++;
    }
    setConfig(newConfig);
  };

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="flex flex-col items-center gap-3">
        <HumanAvatar avatarId={avatarConfigToId(config)} size="lg" />
        <Button variant="ghost" size="sm" onClick={randomize} className="text-muted-foreground">
          <Shuffle className="w-4 h-4 mr-2" /> Randomize
        </Button>
        {showDuplicateWarning && (
          <p className="text-xs text-neon-orange">Someone already has this look!</p>
        )}
      </div>

      {/* Body Color */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Body Color</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {BODY_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => updateConfig('bodyColor', color.id)}
              className={cn(
                'w-8 h-8 rounded-full transition-all',
                config.bodyColor === color.id 
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' 
                  : 'hover:scale-105 opacity-70 hover:opacity-100'
              )}
              style={{ backgroundColor: color.color }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Hair Style */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Hair Style</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {HAIR_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => updateConfig('hairStyle', style.id)}
              className={cn(
                'px-3 py-1 rounded-full text-xs transition-all',
                config.hairStyle === style.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              {style.name}
            </button>
          ))}
        </div>
      </div>

      {/* Hair Color (hidden if bald) */}
      {config.hairStyle !== 'bald' && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Hair Color</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {HAIR_COLORS.map((color) => (
              <button
                key={color.id}
                onClick={() => updateConfig('hairColor', color.id)}
                className={cn(
                  'w-6 h-6 rounded-full transition-all',
                  config.hairColor === color.id 
                    ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110' 
                    : 'hover:scale-105 opacity-70 hover:opacity-100'
                )}
                style={{ backgroundColor: color.color }}
                title={color.name}
              />
            ))}
          </div>
        </div>
      )}

      {/* Accessory */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Accessory</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {ACCESSORIES.map((acc) => (
            <button
              key={acc.id}
              onClick={() => updateConfig('accessory', acc.id)}
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all',
                config.accessory === acc.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted hover:bg-muted/80'
              )}
              title={acc.name}
            >
              {acc.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
