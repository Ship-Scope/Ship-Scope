import { z } from 'zod';

export const trelloConfigSchema = z.object({
  trello_api_key: z.string().min(1, 'Trello API key is required').optional(),
  trello_token: z.string().min(1, 'Trello token is required').optional(),
  trello_board_id: z.string().min(1).optional(),
  trello_list_id: z.string().min(1).optional(),
  trello_done_list_names: z.string().max(500).optional(),
});

export const trelloImportSchema = z.object({
  listId: z.string().min(1).optional(),
  maxResults: z.number().int().min(1).max(100).optional(),
});
