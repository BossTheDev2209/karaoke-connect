import React, { useState, useEffect, useRef } from 'react';
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
import { Shuffle, Upload, X, Camera } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface AvatarPickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
  existingAvatarIds?: string[];
  customAvatarNormal?: string;
  customAvatarSpeaking?: string;
  onCustomAvatarsChange?: (normal: string | undefined, speaking: string | undefined) => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ 
  selectedId, 
  onSelect,
  existingAvatarIds = [],
  customAvatarNormal,
  customAvatarSpeaking,
  onCustomAvatarsChange
}) => {
  const [config, setConfig] = useState<AvatarConfig>(() => avatarIdToConfig(selectedId));
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [useCustomAvatar, setUseCustomAvatar] = useState(!!customAvatarNormal);
  const [localNormal, setLocalNormal] = useState<string | undefined>(customAvatarNormal);
  const [localSpeaking, setLocalSpeaking] = useState<string | undefined>(customAvatarSpeaking);
  
  const normalInputRef = useRef<HTMLInputElement>(null);
  const speakingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const newId = avatarConfigToId(config);
    const isUnique = isAvatarUnique(newId, existingAvatarIds);
    setShowDuplicateWarning(!isUnique);
    onSelect(newId);
  }, [config, onSelect, existingAvatarIds]);

  useEffect(() => {
    if (onCustomAvatarsChange) {
      onCustomAvatarsChange(
        useCustomAvatar ? localNormal : undefined,
        useCustomAvatar ? localSpeaking : undefined
      );
    }
  }, [localNormal, localSpeaking, useCustomAvatar, onCustomAvatarsChange]);

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

  const handleImageUpload = (type: 'normal' | 'speaking') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (type === 'normal') {
        setLocalNormal(dataUrl);
      } else {
        setLocalSpeaking(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearImage = (type: 'normal' | 'speaking') => {
    if (type === 'normal') {
      setLocalNormal(undefined);
      if (normalInputRef.current) normalInputRef.current.value = '';
    } else {
      setLocalSpeaking(undefined);
      if (speakingInputRef.current) speakingInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Avatar Type Toggle */}
      <div className="flex justify-center gap-2">
        <Button
          variant={!useCustomAvatar ? 'default' : 'outline'}
          size="sm"
          onClick={() => setUseCustomAvatar(false)}
        >
          Generated Avatar
        </Button>
        <Button
          variant={useCustomAvatar ? 'default' : 'outline'}
          size="sm"
          onClick={() => setUseCustomAvatar(true)}
        >
          <Camera className="w-4 h-4 mr-1" />
          Custom Image
        </Button>
      </div>

      {useCustomAvatar ? (
        /* Custom Avatar Upload */
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground text-center">
            Upload images for your avatar (optional)
          </p>
          
          {/* Preview */}
          <div className="flex justify-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                {localNormal ? (
                  <img src={localNormal} alt="Normal" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">Normal</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">Not Speaking</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-neon-green">
                {localSpeaking ? (
                  <img src={localSpeaking} alt="Speaking" className="w-full h-full object-cover" />
                ) : localNormal ? (
                  <img src={localNormal} alt="Normal" className="w-full h-full object-cover opacity-80" />
                ) : (
                  <span className="text-xs text-muted-foreground">Speaking</span>
                )}
              </div>
              <span className="text-[10px] text-neon-green">Speaking</span>
            </div>
          </div>

          {/* Upload buttons */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Normal (closed mouth)</Label>
              <div className="relative">
                <input
                  ref={normalInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload('normal')}
                  className="hidden"
                  id="normal-avatar-upload"
                />
                <label
                  htmlFor="normal-avatar-upload"
                  className={cn(
                    "flex items-center justify-center gap-1 w-full py-2 px-3 rounded-lg border border-dashed cursor-pointer transition-colors text-xs",
                    localNormal ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <Upload className="w-3 h-3" />
                  {localNormal ? 'Change' : 'Upload'}
                </label>
                {localNormal && (
                  <button
                    onClick={() => clearImage('normal')}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Speaking (open mouth)</Label>
              <div className="relative">
                <input
                  ref={speakingInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload('speaking')}
                  className="hidden"
                  id="speaking-avatar-upload"
                />
                <label
                  htmlFor="speaking-avatar-upload"
                  className={cn(
                    "flex items-center justify-center gap-1 w-full py-2 px-3 rounded-lg border border-dashed cursor-pointer transition-colors text-xs",
                    localSpeaking ? "border-neon-green bg-neon-green/10" : "border-border hover:border-muted-foreground"
                  )}
                >
                  <Upload className="w-3 h-3" />
                  {localSpeaking ? 'Change' : 'Upload (optional)'}
                </label>
                {localSpeaking && (
                  <button
                    onClick={() => clearImage('speaking')}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <p className="text-[10px] text-muted-foreground text-center">
            If no speaking image is provided, the normal image will be used with a glow effect
          </p>
        </div>
      ) : (
        /* Generated Avatar Customization */
        <>
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
        </>
      )}
    </div>
  );
};
