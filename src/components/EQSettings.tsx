import React, { useState, useEffect } from 'react';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Share2, Save, Undo2, Sliders, Mic, Headphones, Activity, AlertTriangle, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
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
  // New microphone settings
  threshold?: number;
  onThresholdChange?: (value: number) => void;
  isMonitorEnabled?: boolean;
  onMonitorEnabledChange?: (enabled: boolean) => void;
  monitorVolume?: number;
  onMonitorVolumeChange?: (value: number) => void;
  // Advanced Audio
  noiseSuppression?: boolean;
  onNoiseSuppressionChange?: (val: boolean) => void;
  echoCancellation?: boolean;
  onEchoCancellationChange?: (val: boolean) => void;
  autoGainControl?: boolean;
  onAutoGainControlChange?: (val: boolean) => void;
  micGain?: number;
  onMicGainChange?: (val: number) => void;
  compressorThreshold?: number;
  onCompressorThresholdChange?: (val: number) => void;
  compressorRatio?: number;
  onCompressorRatioChange?: (val: number) => void;
}

export const EQSettings: React.FC<EQSettingsProps> = ({ 
  initialSettings,
  onChange,
  threshold = 0.08,
  onThresholdChange,
  isMonitorEnabled = false,
  onMonitorEnabledChange,
  monitorVolume = 0.5,
  onMonitorVolumeChange,
  noiseSuppression = false,
  onNoiseSuppressionChange,
  echoCancellation = true,
  onEchoCancellationChange,
  autoGainControl = false,
  onAutoGainControlChange,
  micGain = 1.0,
  onMicGainChange,
  compressorThreshold = -24,
  onCompressorThresholdChange,
  compressorRatio = 12,
  onCompressorRatioChange,
}) => {
  const [settings, setSettings] = useState<number[]>(
    initialSettings || EQ_PRESETS["Flat"]
  );
  const [activePreset, setActivePreset] = useState<string>("Custom");
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // Convert threshold to a more user-friendly percentage (0-100)
  const sensitivityPercent = Math.round((1 - (threshold - 0.01) / 0.29) * 100);

  const setAudioMode = (mode: 'speaker' | 'headphone') => {
    if (mode === 'speaker') {
      onEchoCancellationChange?.(true);
      onNoiseSuppressionChange?.(true); 
      onAutoGainControlChange?.(true);
    } else {
      onEchoCancellationChange?.(false);
      // Optional: Ask user preferences, but for HQ defaults:
      onNoiseSuppressionChange?.(false); 
      onAutoGainControlChange?.(false);
      
      toast({
        title: "High Quality Mode Active",
        description: "Echo cancellation OFF. Headphones are REQUIRED to prevent feedback loops!",
      });
    }
  };

  const isHeadphoneMode = !echoCancellation && !noiseSuppression && !autoGainControl;

  return (
    <div className="space-y-6 p-1">
      {/* Input Processing Section */}
      <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-indigo-500/5 to-purple-500/10 border border-indigo-500/20">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold">Microphone Processing</h3>
        </div>
        
        <div className="space-y-4">
            {/* Audio Mode Selector */}
            <div className="grid grid-cols-2 gap-2 bg-background/40 p-1 rounded-lg border border-border/50">
              <Button
                variant={!isHeadphoneMode ? "default" : "ghost"}
                size="sm"
                onClick={() => setAudioMode('speaker')}
                className={!isHeadphoneMode ? "bg-indigo-500 text-white hover:bg-indigo-600" : "hover:bg-indigo-500/10"}
              >
                <div className="flex flex-col items-center gap-1 py-1">
                   <div className="flex items-center gap-1.5">
                     <Mic className="w-3.5 h-3.5" />
                     <span>Speaker Mode</span>
                   </div>
                   <span className="text-[9px] opacity-80 font-normal">Safe (AEC On)</span>
                </div>
              </Button>
              <Button
                variant={isHeadphoneMode ? "default" : "ghost"}
                size="sm"
                onClick={() => setAudioMode('headphone')}
                className={isHeadphoneMode ? "bg-pink-500 text-white hover:bg-pink-600" : "hover:bg-pink-500/10"}
              >
                <div className="flex flex-col items-center gap-1 py-1">
                   <div className="flex items-center gap-1.5">
                     <Headphones className="w-3.5 h-3.5" />
                     <span>Studio Mode</span>
                   </div>
                   <span className="text-[9px] opacity-80 font-normal">HQ (Headphones Only)</span>
                </div>
              </Button>
            </div>
            
            {isHeadphoneMode && (
              <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-[10px] leading-tight font-medium">
                  Studio Mode forces High Quality audio by disabling Echo Cancellation.
                  <span className="font-bold block mt-0.5">HEADPHONES REQUIRED to avoid feedback!</span>
                </p>
              </div>
            )}

            {/* Advanced Settings Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/50 mt-2"
            >
              <Settings2 className="w-3.5 h-3.5" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Controls
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>

            {/* Advanced Controls (Collapsible) */}
            {showAdvanced && (
              <div className="space-y-4 pt-3 mt-2 border-t border-indigo-500/10 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Gain */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-xs font-medium">Pre-Amp Gain</Label>
                        <span className="text-xs font-mono text-indigo-400 font-bold">
                            {micGain > 0 ? '+' : ''}{Math.round(micGain)}dB
                        </span>
                    </div>
                    <Slider
                        value={[micGain]}
                        min={-12}
                        max={24}
                        step={0.5}
                        onValueChange={([val]) => onMicGainChange?.(val)}
                        className="py-1"
                    />
                </div>

                {/* Toggles */}
                <div className="flex flex-col gap-3 pt-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs flex flex-col gap-0.5 pointer-events-none">
                            <span className="font-medium">Noise Suppression</span>
                            <span className="text-[9px] text-muted-foreground">Reduce background noise</span>
                        </Label>
                        <Switch checked={noiseSuppression} onCheckedChange={onNoiseSuppressionChange} />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label className="text-xs flex flex-col gap-0.5 pointer-events-none">
                            <span className="font-medium">Echo Cancellation</span>
                            <span className="text-[9px] text-muted-foreground">Prevent speaker feedback</span>
                        </Label>
                        <Switch checked={echoCancellation} onCheckedChange={onEchoCancellationChange} />
                    </div>
                     <div className="flex items-center justify-between">
                        <Label className="text-xs flex flex-col gap-0.5 pointer-events-none">
                            <span className="font-medium">Auto Gain Control</span>
                            <span className="text-[9px] text-muted-foreground">Auto-level volume</span>
                        </Label>
                        <Switch checked={autoGainControl} onCheckedChange={onAutoGainControlChange} />
                    </div>
                </div>

                 {/* Compressor/Limiter */}
                <div className="space-y-2 pt-3 border-t border-indigo-500/10">
                    <div className="flex justify-between items-center">
                        <Label className="text-xs font-medium">Limiter Threshold</Label>
                        <span className="text-xs font-mono text-indigo-400 font-bold">{compressorThreshold}dB</span>
                    </div>
                    <Slider
                        value={[compressorThreshold]}
                        min={-60}
                        max={0}
                        step={1}
                        onValueChange={([val]) => onCompressorThresholdChange?.(val)}
                        className="py-1"
                    />
                     <p className="text-[9px] text-muted-foreground leading-tight">
                        Prevents distortion when singing loud.
                    </p>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Microphone Sensitivity Section */}
      <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-bold">Mic Sensitivity</h3>
          <Badge variant="outline" className="ml-auto text-xs">
            {sensitivityPercent}%
          </Badge>
        </div>
        
        <div className="space-y-2">
          <Slider
            value={[threshold]}
            min={0.01}
            max={0.3}
            step={0.01}
            onValueChange={([val]) => onThresholdChange?.(val)}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>More Sensitive</span>
            <span>Less Sensitive</span>
          </div>
        </div>
        
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Adjust how easily the mic detects your voice. Lower sensitivity helps ignore background noise.
        </p>
      </div>

      {/* Monitor (Hear Yourself) Section */}
      <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Headphones className="w-5 h-5 text-accent-foreground" />
            <h3 className="font-bold">Monitor (Hear Yourself)</h3>
          </div>
          <Switch
            checked={isMonitorEnabled}
            onCheckedChange={onMonitorEnabledChange}
          />
        </div>
        
        {isMonitorEnabled && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Monitor Volume</Label>
              <span className="text-xs font-mono text-primary">
                {Math.round(monitorVolume * 100)}%
              </span>
            </div>
            <Slider
              value={[monitorVolume]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([val]) => onMonitorVolumeChange?.(val)}
              className="w-full"
            />
          </div>
        )}
        
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {isMonitorEnabled 
            ? "⚠️ Use headphones to avoid feedback! You'll hear your processed voice in real-time."
            : "Enable to hear your voice through your speakers/headphones while singing."
          }
        </p>
      </div>

      {/* Separator */}
      <div className="border-t border-border/50" />

      {/* EQ Section */}
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
