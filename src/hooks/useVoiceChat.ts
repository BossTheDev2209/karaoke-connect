import { useState, useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PeerConnection {
  pc: RTCPeerConnection;
  audioStream?: MediaStream;
}

interface VoiceChatUser {
  odels: string;
  volume: number;
  isMuted: boolean;
}

interface UseVoiceChatReturn {
  isEnabled: boolean;
  isMicMuted: boolean;
  remoteUsers: Record<string, VoiceChatUser>;
  toggleVoiceChat: () => Promise<void>;
  toggleMicMute: () => void;
  setUserVolume: (userId: string, volume: number) => void;
  setUserMuted: (userId: string, muted: boolean) => void;
  error: string | null;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useVoiceChat = (
  channel: RealtimeChannel | null,
  currentUserId: string,
  roomUsers: { id: string }[]
): UseVoiceChatReturn => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<Record<string, VoiceChatUser>>({});
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Create peer connection for a remote user
  const createPeerConnection = useCallback((remoteUserId: string, isInitiator: boolean) => {
    console.log(`[VoiceChat] Creating peer connection for ${remoteUserId}, initiator: ${isInitiator}`);
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channel) {
        channel.send({
          type: 'broadcast',
          event: 'voice_signal',
          payload: {
            type: 'ice_candidate',
            from: currentUserId,
            to: remoteUserId,
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[VoiceChat] Connection state with ${remoteUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        // Cleanup failed connection
        closePeerConnection(remoteUserId);
      }
    };

    // Handle remote audio tracks
    pc.ontrack = (event) => {
      console.log(`[VoiceChat] Received remote track from ${remoteUserId}`);
      const [remoteStream] = event.streams;
      
      // Create or update audio element for this user
      let audioEl = audioElementsRef.current.get(remoteUserId);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        audioElementsRef.current.set(remoteUserId, audioEl);
      }
      audioEl.srcObject = remoteStream;

      setRemoteUsers(prev => ({
        ...prev,
        [remoteUserId]: {
          odels: remoteUserId,
          volume: prev[remoteUserId]?.volume ?? 100,
          isMuted: prev[remoteUserId]?.isMuted ?? false,
        },
      }));
    };

    peersRef.current.set(remoteUserId, { pc });

    return pc;
  }, [channel, currentUserId]);

  // Close peer connection
  const closePeerConnection = useCallback((remoteUserId: string) => {
    const peer = peersRef.current.get(remoteUserId);
    if (peer) {
      peer.pc.close();
      peersRef.current.delete(remoteUserId);
    }
    
    const audioEl = audioElementsRef.current.get(remoteUserId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioElementsRef.current.delete(remoteUserId);
    }

    pendingCandidatesRef.current.delete(remoteUserId);

    setRemoteUsers(prev => {
      const next = { ...prev };
      delete next[remoteUserId];
      return next;
    });
  }, []);

  // Handle incoming signaling messages
  useEffect(() => {
    if (!channel || !isEnabled) return;

    const handleSignal = async ({ payload }: { payload: any }) => {
      const { type, from, to, offer, answer, candidate } = payload;
      
      // Ignore messages not for us
      if (to !== currentUserId) return;

      console.log(`[VoiceChat] Received signal: ${type} from ${from}`);

      if (type === 'offer') {
        // Received an offer - create peer connection and answer
        let pc = peersRef.current.get(from)?.pc;
        if (!pc) {
          pc = createPeerConnection(from, false);
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Apply any pending ICE candidates
        const pending = pendingCandidatesRef.current.get(from) || [];
        for (const c of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidatesRef.current.delete(from);

        const answerDesc = await pc.createAnswer();
        await pc.setLocalDescription(answerDesc);

        channel.send({
          type: 'broadcast',
          event: 'voice_signal',
          payload: {
            type: 'answer',
            from: currentUserId,
            to: from,
            answer: answerDesc,
          },
        });
      } else if (type === 'answer') {
        // Received an answer to our offer
        const pc = peersRef.current.get(from)?.pc;
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          
          // Apply any pending ICE candidates
          const pending = pendingCandidatesRef.current.get(from) || [];
          for (const c of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingCandidatesRef.current.delete(from);
        }
      } else if (type === 'ice_candidate') {
        // Received ICE candidate
        const pc = peersRef.current.get(from)?.pc;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          // Queue candidate for later
          const pending = pendingCandidatesRef.current.get(from) || [];
          pending.push(candidate);
          pendingCandidatesRef.current.set(from, pending);
        }
      } else if (type === 'voice_join') {
        // Another user joined voice chat - initiate connection if we have lower ID (deterministic initiator)
        if (currentUserId < from) {
          const pc = createPeerConnection(from, true);
          const offerDesc = await pc.createOffer();
          await pc.setLocalDescription(offerDesc);

          channel.send({
            type: 'broadcast',
            event: 'voice_signal',
            payload: {
              type: 'offer',
              from: currentUserId,
              to: from,
              offer: offerDesc,
            },
          });
        }
      } else if (type === 'voice_leave') {
        // User left voice chat
        closePeerConnection(from);
      }
    };

    // Subscribe to voice signaling events
    channel.on('broadcast', { event: 'voice_signal' }, handleSignal);

    return () => {
      channel.unsubscribe();
    };
  }, [channel, isEnabled, currentUserId, createPeerConnection, closePeerConnection]);

  // Start voice chat
  const startVoiceChat = useCallback(async () => {
    try {
      setError(null);
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      localStreamRef.current = stream;
      setIsEnabled(true);

      // Announce voice chat join to establish connections with existing users
      if (channel) {
        // Small delay to ensure subscription is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Broadcast join to all users
        for (const user of roomUsers) {
          if (user.id !== currentUserId) {
            channel.send({
              type: 'broadcast',
              event: 'voice_signal',
              payload: {
                type: 'voice_join',
                from: currentUserId,
                to: user.id,
              },
            });
          }
        }
      }
    } catch (err) {
      console.error('[VoiceChat] Error starting:', err);
      setError('Could not access microphone');
    }
  }, [channel, roomUsers, currentUserId]);

  // Stop voice chat
  const stopVoiceChat = useCallback(() => {
    // Notify others we're leaving
    if (channel) {
      for (const user of roomUsers) {
        if (user.id !== currentUserId) {
          channel.send({
            type: 'broadcast',
            event: 'voice_signal',
            payload: {
              type: 'voice_leave',
              from: currentUserId,
              to: user.id,
            },
          });
        }
      }
    }

    // Close all peer connections
    peersRef.current.forEach((_, odels) => closePeerConnection(odels));
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    setIsEnabled(false);
    setRemoteUsers({});
  }, [channel, roomUsers, currentUserId, closePeerConnection]);

  const toggleVoiceChat = useCallback(async () => {
    if (isEnabled) {
      stopVoiceChat();
    } else {
      await startVoiceChat();
    }
  }, [isEnabled, startVoiceChat, stopVoiceChat]);

  const toggleMicMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMicMuted; // Toggle
        setIsMicMuted(!isMicMuted);
      }
    }
  }, [isMicMuted]);

  const setUserVolume = useCallback((userId: string, volume: number) => {
    const audioEl = audioElementsRef.current.get(userId);
    if (audioEl) {
      audioEl.volume = volume / 100;
    }
    setRemoteUsers(prev => ({
      ...prev,
      [userId]: { ...prev[userId], volume },
    }));
  }, []);

  const setUserMuted = useCallback((userId: string, muted: boolean) => {
    const audioEl = audioElementsRef.current.get(userId);
    if (audioEl) {
      audioEl.muted = muted;
    }
    setRemoteUsers(prev => ({
      ...prev,
      [userId]: { ...prev[userId], isMuted: muted },
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isEnabled) {
        stopVoiceChat();
      }
    };
  }, []);

  // Handle user leaving the room
  useEffect(() => {
    const currentPeerIds = Array.from(peersRef.current.keys());
    const roomUserIds = roomUsers.map(u => u.id);
    
    // Close connections for users who left
    for (const peerId of currentPeerIds) {
      if (!roomUserIds.includes(peerId)) {
        closePeerConnection(peerId);
      }
    }
  }, [roomUsers, closePeerConnection]);

  return {
    isEnabled,
    isMicMuted,
    remoteUsers,
    toggleVoiceChat,
    toggleMicMute,
    setUserVolume,
    setUserMuted,
    error,
  };
};
