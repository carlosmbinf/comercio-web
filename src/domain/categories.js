export const UNCATEGORIZED_CATEGORY_ID = '__commerce-uncategorized__';

export function getCatalogCategories(categories, preferences) {
  const byId = new Map((categories || []).map((category) => [String(category._id), category]));
  const available = new Map();
  const pathFor = (category) => {
    const names = [];
    const visited = new Set();
    let current = category;
    while (current && !visited.has(current._id)) {
      visited.add(current._id);
      names.unshift(current.nombre);
      current = byId.get(String(current.idCategoriaHeredada || ''));
    }
    return names.join(' › ');
  };
  const hasCompletePath = (category) => {
    const seen = new Set();
    let current = category;
    while (current?.idCategoriaHeredada) {
      if (seen.has(current._id)) return false;
      seen.add(current._id);
      current = byId.get(String(current.idCategoriaHeredada));
      if (!current) return false;
    }
    return true;
  };
  [...byId.values()].sort((a, b) =>
    (Number.isInteger(a.ordenInicio) ? a.ordenInicio : Infinity) -
      (Number.isInteger(b.ordenInicio) ? b.ordenInicio : Infinity) ||
    pathFor(a).localeCompare(pathFor(b), 'es')).forEach((category) => {
    // An inactive ancestor is not published: keep its descendants out of the storefront.
    if (!hasCompletePath(category)) return;
    const path = new Set();
    let current = category;
    let visible = true;
    while (current && !path.has(current._id)) {
      path.add(current._id);
      if (current.visibleEnInicio === false) visible = false;
      current = byId.get(String(current.idCategoriaHeredada || ''));
    }
    available.set(String(category._id), { id: String(category._id), label: pathFor(category), visible });
  });
  const ordered = [];
  (Array.isArray(preferences) ? preferences : []).forEach((entry) => {
    if (!available.has(entry?.id)) return;
    ordered.push(available.get(entry.id));
    available.delete(entry.id);
  });
  return [...ordered, ...available.values()];
}

export function getVisibleCatalogProducts(products, categories) {
  const visibleIds = new Set(getCatalogCategories(categories, null)
    .filter((category) => category.visible).map((category) => category.id));
  return (products || []).filter((product) => {
    const id = String(product?.idCategoria || '').trim();
    return !id || visibleIds.has(id);
  });
}

export function categoryIdsFor(_categories, categoryId) {
  if (!categoryId) return new Set();
  return new Set([String(categoryId)]);
}

export function getPopulatedCategoryRows(categories, categoryIds, products) {
  const categorized = categories.map((category) => ({
    ...category,
    items: products.filter((product) => categoryIds.get(category.id)?.has(String(product?.idCategoria || '').trim())),
  })).filter((category) => category.items.length > 0);
  const uncategorized = products.filter((product) => !String(product?.idCategoria || '').trim());
  return uncategorized.length
    ? [...categorized, { id: UNCATEGORIZED_CATEGORY_ID, label: 'Sin categoría', items: uncategorized }]
    : categorized;
}
