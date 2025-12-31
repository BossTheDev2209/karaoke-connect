// Generate a random 4-character room code
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0, O, I, 1

export const generateRoomCode = (): string => {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
};

export const isValidRoomCode = (code: string): boolean => {
  if (code.length !== 4) return false;
  return code.split('').every(char => CHARS.includes(char.toUpperCase()));
};
