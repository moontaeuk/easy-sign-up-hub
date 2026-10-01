import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LedgerItem = {
  id: string;
  name: string;
  category: string | null;
  currency: string;
  created_at: string;
};

export type LedgerEntry = {
  id: string;
  item_id: string;
  month: string;
  price: number;
};

export type LedgerData = {
  items: LedgerItem[];
  entries: LedgerEntry[];
};

/** Loads the signed-in user's tracked items and all their monthly price entries. */
export const getLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LedgerData> => {
    const [itemsRes, entriesRes] = await Promise.all([
      context.supabase
        .from("tracked_items")
        .select("id,name,category,currency,created_at")
        .order("created_at", { ascending: true }),
      context.supabase
        .from("price_entries")
        .select("id,item_id,month,price")
        .order("month", { ascending: false }),
    ]);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (entriesRes.error) throw new Error(entriesRes.error.message);
    return { items: itemsRes.data, entries: entriesRes.data };
  });

export const addItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().trim().min(1, "이름을 입력하세요").max(120),
        category: z.string().trim().max(60).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tracked_items").insert({
      user_id: context.userId,
      name: data.name,
      category: data.category || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Upserts one monthly price per item+month. */
export const recordPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        itemId: z.string().uuid(),
        month: z.string().regex(/^\d{4}-\d{2}$/, "올바른 월을 선택하세요"),
        price: z.number().min(0, "0 이상을 입력하세요"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("price_entries").upsert(
      {
        item_id: data.itemId,
        user_id: context.userId,
        month: data.month,
        price: data.price,
      },
      { onConflict: "item_id,month" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ itemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tracked_items")
      .delete()
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
