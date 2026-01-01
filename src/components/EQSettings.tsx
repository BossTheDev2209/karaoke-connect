import React, { useState, useEffect } from 'react';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Share2, Save, Undo2, Sliders } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS: Record<string, number[]> = {
  "Flat": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Pop": [2, 4, 3, -2, -1, -2, 2, 4, 5, 2],
  "Rock": [5, 4, 3, 0, -2, -2, 0, 3, 4, 5],
  "Vocal Boost": [-5, -4, -2, 2, 5, 6, 5, 2, -2, -4],
  "Electronic": [6, 5, 0, -2, -3, 0, 2, 4, 5, 6],
  "Karaoke": [3, 2, 0, -1, 4, 5, 4, 3, 2, 1]
};

interface EQSettingsProps {
  initialSettings?: number[];
  onChange?: (settings: number[]) => void;
}

export const EQSettings: React.FC<EQSettingsProps> = ({ 
  initialSettings,
  onChange 
}) => {
  const [settings, setSettings] = useState<number[]>(
    initialSettings || EQ_PRESETS["Flat"]
  );
  const [activePreset, setActivePreset] = useState<string>("Custom");

  const handleBandChange = (index: number, value: number) => {
    const newSettings = [...settings];
    newSettings[index] = value;
    setSettings(newSettings);
    setActivePreset("Custom");
    onChange?.(newSettings);
  };

  const applyPreset = (name: string) => {
    const preset = EQ_PRESETS[name];
    if (preset) {
      setSettings([...preset]);
      setActivePreset(name);
      onChange?.([...preset]);
    }
  };

  const handleSave = () => {
    localStorage.setItem('karaoke_eq_custom', JSON.stringify(settings));
    toast({ title: "EQ Settings Saved", description: "Your custom preset has been stored locally." });
  };

  const handleShare = () => {
    const code = btoa(JSON.stringify(settings));
    navigator.clipboard.writeText(code);
    toast({ 
      title: "EQ Settings Copied!", 
      description: "Send this code to a friend to share your sound signature." 
    });
  };

  return (
    <div className="space-y-8 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-primary" />
          <h3 className="font-bold">Voice Equalizer</h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={activePreset} onValueChange={applyPreset}>
            <SelectTrigger className="w-32 h-8 text-xs bg-background/40">
              <SelectValue placeholder="Preset" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(EQ_PRESETS).map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
              <SelectItem value="Custom" disabled>Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-between items-end h-48 gap-1 px-2">
        {EQ_BANDS.map((freq, i) => (
          <div key={freq} className="flex-1 flex flex-col items-center gap-4 h-full">
            <div className="flex-1 w-full bg-muted/20 rounded-full relative overflow-hidden group">
              <Slider
                value={[settings[i]]}
                min={-12}
                max={12}
                step={0.5}
                orientation="vertical"
                onValueChange={([val]) => handleBandChange(i, val)}
                className="h-full"
              />
              <div 
                className="absolute bottom-1/2 left-0 right-0 border-t border-primary/20 pointer-events-none"
                style={{ height: '1px' }}
              />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-mono text-primary font-bold">
                {settings[i] > 0 ? `+${settings[i]}` : settings[i]}dB
              </span>
              <span className="text-[8px] uppercase text-muted-foreground font-black tracking-tighter">
                {freq >= 1000 ? `${freq/1000}k` : freq}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 gap-2 border-primary/20 hover:bg-primary/5"
          onClick={handleSave}
        >
          <Save className="w-3.5 h-3.5" /> Save
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 gap-2 border-primary/20 hover:bg-primary/5"
          onClick={handleShare}
        >
          <Share2 className="w-3.5 h-3.5" /> Share
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed italic opacity-70">
        Adjust these to fine-tune your microphone's tone. Higher dB values boost the frequency, while lower values cut it.
      </p>
    </div>
  );
};
