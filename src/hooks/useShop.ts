import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { IShopItem, IRedemption } from '@/types/quest';
import { PRESET_SHOP_ITEMS, INITIAL_REPUTATION } from '@/data/preset';
import { playSound } from '@/lib/sound';
import { store, subscribeStorageChange } from '@/lib/storage';
import { shopApi } from '@/api';
import { syncState } from '@/api/sync/state';

const REPUTATION_KEY = '__quest_guild_reputation';
const SHOP_ITEMS_KEY = '__quest_guild_shop_items';
const REDEMPTIONS_KEY = '__quest_guild_redemptions';

let reputationCache: number | null = null;
let shopItemsCache: IShopItem[] | null = null;
let redemptionsCache: IRedemption[] | null = null;
const reputationListeners = new Set<(v: number) => void>();
const shopItemsListeners = new Set<(v: IShopItem[]) => void>();
const redemptionsListeners = new Set<(v: IRedemption[]) => void>();
let initialized = false;

function loadReputation(): number {
  try {
    const raw = store.getItem(REPUTATION_KEY);
    if (raw === null) return INITIAL_REPUTATION;
    const v = parseInt(raw, 10);
    return Number.isFinite(v) ? v : INITIAL_REPUTATION;
  } catch {
    return INITIAL_REPUTATION;
  }
}

function loadShopItems(): IShopItem[] {
  try {
    const raw = store.getItem(SHOP_ITEMS_KEY);
    if (!raw) return PRESET_SHOP_ITEMS;
    const parsed = JSON.parse(raw) as IShopItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) return PRESET_SHOP_ITEMS;
    return parsed;
  } catch {
    return PRESET_SHOP_ITEMS;
  }
}

function loadRedemptions(): IRedemption[] {
  try {
    const raw = store.getItem(REDEMPTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IRedemption[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setReputationValue(v: number) {
  reputationCache = v;
  store.setItem(REPUTATION_KEY, String(v));
  reputationListeners.forEach((fn) => fn(v));
}

function setShopItemsValue(v: IShopItem[]) {
  shopItemsCache = v;
  store.setItem(SHOP_ITEMS_KEY, JSON.stringify(v));
  shopItemsListeners.forEach((fn) => fn(v));
}

function setRedemptionsValue(v: IRedemption[]) {
  redemptionsCache = v;
  store.setItem(REDEMPTIONS_KEY, JSON.stringify(v));
  redemptionsListeners.forEach((fn) => fn(v));
}

async function syncFromServer() {
  try {
    const [items, rep, redemptions] = await Promise.all([
      shopApi.getItems(),
      shopApi.getReputation(),
      shopApi.getRedemptions(),
    ]);

    if (items.length === 0) {
      // 服务端为空，初始化预设（需要逐个添加）
      for (const item of PRESET_SHOP_ITEMS) {
        try { await shopApi.addItem(item); } catch { /* ignore */ }
      }
      setShopItemsValue(PRESET_SHOP_ITEMS);
    } else {
      setShopItemsValue(items);
    }

    setReputationValue(rep);
    setRedemptionsValue(redemptions);
  } catch {
    // 使用本地缓存
  }
}

// ========== 跨窗口同步 ==========
subscribeStorageChange((event) => {
  if (event.key === REPUTATION_KEY) {
    reputationCache = loadReputation();
    reputationListeners.forEach((fn) => fn(reputationCache!));
  } else if (event.key === SHOP_ITEMS_KEY) {
    shopItemsCache = loadShopItems();
    shopItemsListeners.forEach((fn) => fn(shopItemsCache!));
  } else if (event.key === REDEMPTIONS_KEY) {
    redemptionsCache = loadRedemptions();
    redemptionsListeners.forEach((fn) => fn(redemptionsCache!));
  }
});

export function useShop() {
  const [reputation, setReputationState] = useState<number>(
    () => reputationCache ?? loadReputation()
  );
  const [shopItems, setShopItemsState] = useState<IShopItem[]>(
    () => shopItemsCache ?? loadShopItems()
  );
  const [redemptions, setRedemptionsState] = useState<IRedemption[]>(
    () => redemptionsCache ?? loadRedemptions()
  );

  useEffect(() => {
    if (reputationCache === null) reputationCache = reputation;
    if (shopItemsCache === null) shopItemsCache = shopItems;
    if (redemptionsCache === null) redemptionsCache = redemptions;

    const rFn = (v: number) => setReputationState(v);
    const sFn = (v: IShopItem[]) => setShopItemsState(v);
    const dFn = (v: IRedemption[]) => setRedemptionsState(v);
    reputationListeners.add(rFn);
    shopItemsListeners.add(sFn);
    redemptionsListeners.add(dFn);

    if (!initialized) {
      initialized = true;
      syncFromServer();
    }

    return () => {
      reputationListeners.delete(rFn);
      shopItemsListeners.delete(sFn);
      redemptionsListeners.delete(dFn);
    };
  }, [reputation, shopItems, redemptions]);

  const addReputation = useCallback((amount: number, reason?: string) => {
    const next = Math.max(0, (reputationCache ?? 0) + amount);
    setReputationValue(next);
    shopApi.addReputation(amount).catch(() => {});
    syncState.markMetaDirty();
    if (amount > 0) {
      toast.success(`获得 ${amount} 声望${reason ? ` · ${reason}` : ''}`, {
        description: '公会声望 +' + amount,
      });
    }
  }, []);

  const addShopItem = useCallback(
    (item: Omit<IShopItem, 'id' | 'createdAt' | 'source'>) => {
      const newItem: IShopItem = {
        ...item,
        id: `shop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        source: 'user',
      };
      const next = [...(shopItemsCache ?? []), newItem];
      setShopItemsValue(next);
      shopApi.addItem(item).catch(() => {});
      toast.success('商品已上架', { description: item.name });
      return newItem;
    },
    []
  );

  const deleteShopItem = useCallback((itemId: string) => {
    const list = shopItemsCache ?? [];
    const target = list.find((i) => i.id === itemId);
    if (!target) return;
    if (target.source === 'mock') {
      toast.error('预设商品不可删除');
      return;
    }
    const next = list.filter((i) => i.id !== itemId);
    setShopItemsValue(next);
    shopApi.deleteItem(itemId).catch(() => {});
    toast.success('商品已下架', { description: target.name });
  }, []);

  const redeemItem = useCallback(
    (itemId: string) => {
      const list = shopItemsCache ?? [];
      const item = list.find((i) => i.id === itemId);
      if (!item) {
        toast.error('商品不存在');
        return false;
      }
      const current = reputationCache ?? 0;
      if (current < item.cost) {
        toast.error('声望不足', {
          description: `还需 ${item.cost - current} 声望`,
        });
        return false;
      }
      setReputationValue(current - item.cost);
      syncState.markMetaDirty();
      const redemption: IRedemption = {
        id: `red_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        itemId: item.id,
        itemName: item.name,
        cost: item.cost,
        redeemedAt: Date.now(),
      };
      const nextRedemptions = [redemption, ...(redemptionsCache ?? [])];
      setRedemptionsValue(nextRedemptions);

      shopApi.redeem(itemId).catch(() => {});

      toast.success('兑换成功！', {
        description: `${item.icon} ${item.name} · 消耗 ${item.cost} 声望`,
      });
      playSound('redeem');
      return true;
    },
    []
  );

  const resetShop = useCallback(() => {
    setShopItemsValue(PRESET_SHOP_ITEMS);
    setRedemptionsValue([]);
    toast.info('商店已重置');
  }, []);

  const updateShopItem = useCallback(
    (itemId: string, patch: Partial<Pick<IShopItem, 'name' | 'cost' | 'icon' | 'color' | 'description'>>) => {
      const list = shopItemsCache ?? [];
      const index = list.findIndex((i) => i.id === itemId);
      if (index === -1) {
        toast.error('商品不存在');
        return false;
      }
      const updated = { ...list[index], ...patch };
      const next = [...list];
      next[index] = updated;
      setShopItemsValue(next);
      toast.success('商品已更新', { description: updated.name });
      return true;
    },
    []
  );

  const totalEarnedReputation = useMemo(() => {
    const spent = redemptions.reduce((sum, r) => sum + r.cost, 0);
    return reputation + spent;
  }, [reputation, redemptions]);

  return {
    reputation,
    shopItems,
    redemptions,
    totalEarnedReputation,
    addReputation,
    addShopItem,
    deleteShopItem,
    removeShopItem: deleteShopItem,
    redeemItem,
    resetShop,
    updateShopItem,
    setReputationValue,
  };
}
