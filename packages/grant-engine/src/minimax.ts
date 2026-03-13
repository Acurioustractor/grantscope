const DEFAULT_MINIMAX_BASE_URL = 'https://api.minimax.io/v1';

export const MINIMAX_BASE_URL = (process.env.MINIMAX_BASE_URL || DEFAULT_MINIMAX_BASE_URL).replace(/\/$/, '');
export const MINIMAX_CHAT_COMPLETIONS_URL = `${MINIMAX_BASE_URL}/chat/completions`;
