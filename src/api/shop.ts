import type { IShopItem, IRedemption } from '@/types/quest';
import { INITIAL_REPUTATION } from '@/data/preset';
import { genLocalId, readLocalList, readLocalScalar } from './local';

const REPUTATION_KEY = '__quest_guild_reputation';
const SHOP_ITEMS_KEY = '__quest_guild_shop_items';
const REDEMPTIONS_KEY = '__quest_guild_redemptions';

/**
 * 方案A：shopApi 本地持久化适配器。
 * 读方法返回本地真实数据（syncFromServer 依赖），写方法立即成功
 * （useShop 本身已先写本地缓存，此处无需再落盘，避免双重写入）。
 */
export const shopApi = {
  getItems: async (): Promise<IShopItem[]> => readLocalList<IShopItem>(SHOP_ITEMS_KEY),

  addItem: async (item: Omit<IShopItem, 'id' | 'createdAt' | 'source'>): Promise<IShopItem> => ({
    ...item,
    id: genLocalId('shop'),
    createdAt: Date.now(),
    source: 'user',
  }),

  deleteItem: async (_id: string): Promise<{ success: boolean }> => ({ success: true }),

  getReputation: async (): Promise<number> => {
    const raw = readLocalScalar(REPUTATION_KEY);
    if (raw === null) return INITIAL_REPUTATION;
    const v = parseInt(raw, 10);
    return Number.isFinite(v) ? v : INITIAL_REPUTATION;
  },

  addReputation: async (amount: number): Promise<number> => amount,

  getRedemptions: async (): Promise<IRedemption[]> => readLocalList<IRedemption>(REDEMPTIONS_KEY),

  redeem: async (itemId: string): Promise<IRedemption> => ({
    id: genLocalId('red'),
    itemId,
    itemName: '',
    cost: 0,
    redeemedAt: Date.now(),
  }),
};

export default shopApi;
