export const UNCATEGORIZED_CATEGORY_ID = '__commerce-uncategorized__';
export const CATEGORY_SELECTION_LIMIT = 15;

// Only use IDs belonging to this sample, never other subscriptions in Minimongo.
export function getCategorySelectionProducts(products = [], productIds = []) {
  const byId = new Map(products.map((product) => [String(product._id), product]));
  return [...new Set(productIds)].slice(0, CATEGORY_SELECTION_LIMIT)
    .map((id) => byId.get(String(id))).filter(Boolean);
}

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
    const id = String(category._id);
    const parentId = String(category.idCategoriaHeredada || '').trim();
    available.set(id, {
      id,
      label: pathFor(category),
      name: String(category.nombre || ''),
      parentId: parentId || null,
      visible,
    });
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
  const targetId = String(categoryId);
  const descendantsByParent = new Map();
  (Array.isArray(_categories) ? _categories : []).forEach((category) => {
    const parentId = String(category?.idCategoriaHeredada || category?.parentId || '').trim();
    const id = String(category?._id || category?.id || '').trim();
    if (!parentId || !id) return;
    if (!descendantsByParent.has(parentId)) descendantsByParent.set(parentId, []);
    descendantsByParent.get(parentId).push(id);
  });

  const ids = new Set([targetId]);
  const pending = [targetId];
  while (pending.length) {
    const parentId = pending.pop();
    (descendantsByParent.get(parentId) || []).forEach((id) => {
      if (ids.has(id)) return;
      ids.add(id);
      pending.push(id);
    });
  }
  return ids;
}

export function buildCategoryTree(categories = []) {
  const nodesById = new Map();
  (Array.isArray(categories) ? categories : []).forEach((category) => {
    if (!category?.id) return;
    nodesById.set(String(category.id), {
      ...category,
      id: String(category.id),
      parentId: category.parentId ? String(category.parentId) : null,
      children: [],
    });
  });

  const roots = [];
  nodesById.forEach((node) => {
    const parent = node.parentId ? nodesById.get(node.parentId) : null;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  });

  return roots;
}

export function flattenCategoryTree(roots = []) {
  const result = [];
  const visit = (nodes) => {
    (Array.isArray(nodes) ? nodes : []).forEach((node) => {
      result.push(node);
      visit(node.children);
    });
  };
  visit(roots);
  return result;
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
