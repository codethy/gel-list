// components/admin/AdminProductsClient.tsx
//
// Product-catalog section shown below the checklist table on
// app/admin/sets/[id]/checklist/page.tsx — add/delete the products (Hobby
// Box, Jumbo Box, etc.) this set was actually released in. Empty by
// default; this is what populates the "Which Product" dropdown in the Log
// a Gel form for this set.

"use client";

import { useState } from "react";
import AdminAddProductModal, { type ProductSelection } from "./AdminAddProductModal";
import AdminProductPacksModal from "./AdminProductPacksModal";
import { getProductLabel } from "@/lib/productTypes";
import type { AdminProductRow } from "@/lib/data/adminChecklist";

interface AdminProductsClientProps {
  setId:           string;
  initialProducts: AdminProductRow[];
}

export default function AdminProductsClient({ setId, initialProducts }: AdminProductsClientProps) {
  const [products, setProducts] = useState<AdminProductRow[]>(initialProducts);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [packsProduct, setPacksProduct] = useState<AdminProductRow | null>(null);

  const handlePacksSubmit = async (
    packKinds: { packsCount: number; cardsPerPack: number }[]
  ): Promise<string | void> => {
    if (!packsProduct) return;
    const res = await fetch(`/api/admin/sets/${setId}/products/${packsProduct.id}/packs`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ packKinds }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Failed to save packs";

    setProducts((prev) =>
      prev.map((p) => (p.id === packsProduct.id ? { ...p, packKinds: data.product.packKinds, packsPerUnit: data.product.packsPerUnit } : p))
    );
    setPacksProduct(null);
  };

  // Submits one fetch per checked product in parallel. On full success the
  // modal closes; on partial failure (e.g. a race with another admin
  // adding the same product), whatever succeeded is still merged in and
  // the modal stays open with an error naming what didn't.
  const handleAddMany = async (selections: ProductSelection[]): Promise<string | void> => {
    const results = await Promise.all(
      selections.map(async (sel) => {
        const res = await fetch(`/api/admin/sets/${setId}/products`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ productType: sel.productType, productTypeOther: sel.productTypeOther || null }),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, sel, product: data.product as AdminProductRow | undefined };
      })
    );

    const succeeded = results.filter((r) => r.ok && r.product).map((r) => r.product!);
    const failed    = results.filter((r) => !r.ok);

    if (succeeded.length > 0) {
      setProducts((prev) => [...prev, ...succeeded]);
    }
    if (failed.length > 0) {
      const names = failed.map((f) => getProductLabel(f.sel.productType, f.sel.productTypeOther)).join(", ");
      return `Couldn't add: ${names} (already in the catalog?)`;
    }

    setModalOpen(false);
  };

  const handleDelete = async (product: AdminProductRow) => {
    if (!confirm(`Remove "${product.label}" from this set's product catalog?`)) return;

    setDeletingId(product.id);
    try {
      const res = await fetch(`/api/admin/sets/${setId}/products/${product.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to delete product");
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } finally {
      setDeletingId(null);
    }
  };

  // Derived live from `products` state (not a separate server-fetched
  // summary) so adding/removing a product or editing its pack kinds is
  // immediately reflected — same math as getPacksOpenedGlobal in
  // lib/data/productOpenings.ts, just computed client-side from the data
  // already on hand.
  const totalPacksOpened = products.reduce(
    (sum, p) => sum + p.openedQuantity * (p.packsPerUnit > 0 ? p.packsPerUnit : 1),
    0
  );
  const totalCardsPulled = products.reduce(
    (sum, p) => sum + p.openedQuantity * p.packKinds.reduce((s, k) => s + k.packsCount * k.cardsPerPack, 0),
    0
  );
  const packsOpenedLabel = products.length === 1 && products[0].packsPerUnit === 1 ? "Boxes Opened" : "Packs Opened";

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white">Products</h2>
          <p className="text-sm text-slate-400">
            Which products this set was released in — drives the &quot;Which Product&quot; dropdown when logging a gel.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shrink-0"
        >
          + Add Products
        </button>
      </div>

      {products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4 max-w-md">
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{packsOpenedLabel}</p>
            <p className="text-xl font-bold text-white tabular-nums">{totalPacksOpened.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cards Pulled</p>
            <p className="text-xl font-bold text-white tabular-nums">{totalCardsPulled.toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Packs</th>
              <th className="px-4 py-3">Opened</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                <td className="px-4 py-3 text-slate-200">{p.label}</td>
                <td className="px-4 py-3 text-slate-400">
                  {p.packsPerUnit > 0 ? (
                    <span>
                      {p.packsPerUnit.toLocaleString()} pack{p.packsPerUnit === 1 ? "" : "s"}
                      {p.packKinds.length > 1 && ` (${p.packKinds.length} kinds)`}
                    </span>
                  ) : (
                    <span className="text-slate-600 italic">Not set</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 tabular-nums">
                  {p.openedQuantity > 0 ? (
                    `${p.openedQuantity.toLocaleString()} opened`
                  ) : (
                    <span className="text-slate-600 italic">None yet</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <button
                      onClick={() => setPacksProduct(p)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs text-slate-300 hover:bg-slate-800/60 transition-colors"
                    >
                      Edit Packs
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={deletingId === p.id}
                      className="px-3 py-1.5 rounded-lg border border-red-900/50 text-xs text-red-400 hover:bg-red-950/40 transition-colors disabled:opacity-40"
                    >
                      {deletingId === p.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No products added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminAddProductModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddMany}
        existingProductTypes={new Set(products.filter((p) => p.productType !== "OTHER").map((p) => p.productType))}
      />

      <AdminProductPacksModal
        isOpen={packsProduct !== null}
        onClose={() => setPacksProduct(null)}
        onSubmit={handlePacksSubmit}
        product={packsProduct}
      />
    </div>
  );
}
