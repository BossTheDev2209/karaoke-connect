import { useState, useCallback } from 'react';
import { avatarConfigToId, generateRandomAvatar } from '@/data/avatars';
import { toast } from '@/hooks/use-toast';

/**
 * Shared hook for user profile setup (avatar + nickname + session persistence).
 * Used by both Index.tsx and JoinRoom.tsx.
 */
export function useUserSetup() {
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState(() => avatarConfigToId(generateRandomAvatar()));
  const [customAvatarNormal, setCustomAvatarNormal] = useState<string | undefined>();
  const [customAvatarSpeaking, setCustomAvatarSpeaking] = useState<string | undefined>();

  const handleCustomAvatarsChange = useCallback(
    (normal: string | undefined, speaking: string | undefined) => {
      setCustomAvatarNormal(normal);
      setCustomAvatarSpeaking(speaking);
    },
    [],
  );

  /** Validate nickname, persist to sessionStorage, return the user object (or null on failure). */
  const saveUser = useCallback(() => {
    if (!nickname.trim()) {
      toast({ title: 'Enter a nickname', variant: 'destructive' });
      return null;
    }
    const userData = {
      id: crypto.randomUUID(),
      nickname: nickname.trim(),
      avatarId,
      customAvatarNormal,
      customAvatarSpeaking,
      isSpeaking: false,
    };
    sessionStorage.setItem('karaoke_user', JSON.stringify(userData));
    return userData;
  }, [nickname, avatarId, customAvatarNormal, customAvatarSpeaking]);

  return {
    nickname,
    setNickname,
    avatarId,
    setAvatarId,
    customAvatarNormal,
    customAvatarSpeaking,
    handleCustomAvatarsChange,
    saveUser,
  };
}
