import React from 'react';
import { Box, Button, Chip, IconButton, Popover, TextField, Typography, useTheme } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

const INITIAL_ROOT_LIMIT = 8;
const SEARCH_RESULT_LIMIT = 12;

export function CategoryMenu({ onOpenAll, onSelect, roots = [], selectedCategory = 'all' }) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [openPath, setOpenPath] = React.useState([]);
  const panelId = React.useId();
  const panelRef = React.useRef(null);
  const shownRoots = roots.slice(0, 6);
  const resolvedPath = React.useMemo(() => {
    const path = [];
    let siblings = roots;
    for (const id of openPath) {
      const node = siblings.find((entry) => entry.id === id);
      if (!node?.children.length) break;
      path.push(node);
      siblings = node.children;
    }
    return path;
  }, [openPath, roots]);
  const currentNode = resolvedPath[resolvedPath.length - 1];
  const closeMenu = () => {
    setAnchorEl(null);
    setOpenPath([]);
  };
  const selectAndClose = (categoryId) => {
    onSelect(categoryId);
    closeMenu();
  };
  const openAll = () => {
    closeMenu();
    onOpenAll();
  };
  const containsSelection = (node) => node.id === selectedCategory || node.children.some(containsSelection);

  React.useEffect(() => {
    if (resolvedPath.length !== openPath.length) {
      setOpenPath(resolvedPath.map((node) => node.id));
      if (!resolvedPath.length) setAnchorEl(null);
    }
  }, [openPath.length, resolvedPath]);

  React.useEffect(() => {
    if (anchorEl) {
      panelRef.current?.focus();
      panelRef.current?.querySelector('.category-menu-items')?.scrollTo(0, 0);
    }
  }, [anchorEl, currentNode]);

  return (
    <Box
      className="category-menu"
      role="navigation"
      aria-label="Categorías principales"
    >
      <Chip
        clickable
        className={selectedCategory === 'all' ? 'subheader-cat-chip active' : 'subheader-cat-chip'}
        label="Destacados"
        onClick={() => selectAndClose('all')}
        size="small"
      />
      {shownRoots.map((root) => (
        <Button
          aria-controls={anchorEl && resolvedPath[0]?.id === root.id ? panelId : undefined}
          aria-expanded={root.children.length ? Boolean(anchorEl && resolvedPath[0]?.id === root.id) : undefined}
          aria-haspopup={root.children.length ? 'dialog' : undefined}
          aria-pressed={containsSelection(root)}
          className={`category-menu-select${containsSelection(root) ? ' selected' : ''}`}
          endIcon={root.children.length ? <ExpandMoreRoundedIcon fontSize="small" /> : null}
          key={root.id}
          onClick={(event) => {
            if (!root.children.length) return selectAndClose(root.id);
            setAnchorEl(event.currentTarget);
            setOpenPath([root.id]);
          }}
          title={root.label}
        >
          <span>{root.name || root.label}</span>
        </Button>
      ))}
      {roots.length > shownRoots.length ? (
        <Chip
          clickable
          className="subheader-cat-chip more"
          label="Ver todas…"
          onClick={openAll}
          size="small"
        />
      ) : null}
      <Popover
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        className={`catalog-overlay mode-${theme.palette.mode}`}
        marginThreshold={12}
        onClose={closeMenu}
        open={Boolean(anchorEl && currentNode)}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { className: 'category-menu-paper' } }}
      >
        {currentNode ? (
          <Box
            aria-label={`Subcategorías de ${currentNode.name || currentNode.label}`}
            aria-modal="true"
            className="category-menu-submenu"
            id={panelId}
            ref={panelRef}
            role="dialog"
            tabIndex={-1}
          >
            <Box className="category-menu-heading">
              {resolvedPath.length > 1 ? (
                <IconButton aria-label="Volver a la categoría anterior" onClick={() => setOpenPath((path) => path.slice(0, -1))} size="small">
                  <ArrowBackRoundedIcon fontSize="small" />
                </IconButton>
              ) : null}
              <Box className="category-menu-heading-copy">
                <Typography className="category-menu-submenu-title" variant="caption">Explorar categorías</Typography>
                <Typography fontWeight={800} variant="subtitle2">{currentNode.name || currentNode.label}</Typography>
              </Box>
              <IconButton aria-label="Cerrar categorías" onClick={closeMenu} size="small"><CloseRoundedIcon fontSize="small" /></IconButton>
            </Box>
            {resolvedPath.length > 1 ? (
              <Typography className="category-menu-breadcrumb" variant="caption">
                {resolvedPath.map((node) => node.name || node.label).join(' / ')}
              </Typography>
            ) : null}
            <Button className="category-menu-parent-action" onClick={() => selectAndClose(currentNode.id)}>
              Ver todo en esta categoría
              {selectedCategory === currentNode.id ? <CheckRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
            </Button>
            <Box className="category-menu-items">
              {currentNode.children.map((child) => (
                <Button
                  aria-pressed={containsSelection(child)}
                  className={`category-menu-item${containsSelection(child) ? ' selected' : ''}`}
                  key={child.id}
                  onClick={() => child.children.length ? setOpenPath((path) => [...path, child.id]) : selectAndClose(child.id)}
                >
                  <span>{child.name || child.label}</span>
                  {child.children.length ? <ChevronRightRoundedIcon fontSize="small" /> : selectedCategory === child.id ? <CheckRoundedIcon fontSize="small" /> : null}
                </Button>
              ))}
            </Box>
            <Button className="category-menu-viewall" onClick={openAll}>Todas las categorías y filtros</Button>
          </Box>
        ) : null}
      </Popover>
    </Box>
  );
}

function TreeRow({ node, depth, expandedIds, toggleExpanded, selectedCategory, onSelect }) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);

  return (
    <Box className={`category-tree-node depth-${Math.min(depth, 5)}`} key={node.id}>
      <Box className={selectedCategory === node.id ? 'category-tree-row selected' : 'category-tree-row'}>
        <Button
          className="category-tree-select"
          onClick={() => onSelect(node.id)}
          title={node.label}
          variant="text"
        >
          <span className="category-tree-name">{node.name || node.label}</span>
          {selectedCategory === node.id ? <Chip label="Elegida" size="small" /> : null}
        </Button>
        {hasChildren ? (
          <IconButton
            aria-label={`${expanded ? 'Contraer' : 'Expandir'} ${node.name || node.label}`}
            aria-expanded={expanded}
            className="category-tree-expand"
            onClick={() => toggleExpanded(node.id)}
            size="small"
          >
            {expanded ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
          </IconButton>
        ) : null}
      </Box>
      {hasChildren && expanded ? (
        <Box className="category-tree-children" role="group" aria-label={`Subcategorías de ${node.name || node.label}`}>
          {node.children.map((child) => (
            <TreeRow
              depth={depth + 1}
              expandedIds={expandedIds}
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedCategory={selectedCategory}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

export function CategoryTreeExplorer({ categories = [], onSelect, selectedCategory = 'all' }) {
  const [search, setSearch] = React.useState('');
  const [visibleRootCount, setVisibleRootCount] = React.useState(INITIAL_ROOT_LIMIT);
  const [visibleResultCount, setVisibleResultCount] = React.useState(SEARCH_RESULT_LIMIT);
  const [expandedIds, setExpandedIds] = React.useState(() => new Set());
  const query = search.trim().toLocaleLowerCase('es');

  React.useEffect(() => {
    setVisibleRootCount(INITIAL_ROOT_LIMIT);
    setVisibleResultCount(SEARCH_RESULT_LIMIT);
  }, [query]);

  const toggleExpanded = (id) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allNodes = React.useMemo(() => {
    const result = [];
    const visit = (nodes) => {
      nodes.forEach((node) => {
        result.push(node);
        visit(node.children || []);
      });
    };
    visit(categories);
    return result;
  }, [categories]);

  const matchingCategories = query
    ? allNodes.filter((category) => String(category.label || category.name || '').toLocaleLowerCase('es').includes(query))
    : [];
  const displayedRoots = query ? [] : categories.slice(0, visibleRootCount);

  return (
    <Box className="category-tree-explorer">
      <TextField
        className="category-tree-search"
        fullWidth
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar en todas las categorías…"
        size="small"
        value={search}
        InputProps={{
          startAdornment: <SearchRoundedIcon color="action" fontSize="small" sx={{ mr: 1 }} />,
        }}
      />

      <Box className="category-tree-content">
        {!query ? (
          <>
            <Button
              className={selectedCategory === 'all' ? 'category-tree-all selected' : 'category-tree-all'}
              fullWidth
              onClick={() => onSelect('all')}
              variant="text"
            >
              Todas las categorías
            </Button>
            {displayedRoots.map((root) => (
              <TreeRow
                depth={0}
                expandedIds={expandedIds}
                key={root.id}
                node={root}
                onSelect={onSelect}
                selectedCategory={selectedCategory}
                toggleExpanded={toggleExpanded}
              />
            ))}
            {categories.length > visibleRootCount ? (
              <Button
                className="category-tree-show-more"
                fullWidth
                onClick={() => setVisibleRootCount((current) => current + INITIAL_ROOT_LIMIT)}
                variant="text"
              >
                Ver más categorías principales ({categories.length - visibleRootCount})
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Typography className="category-tree-results-label" variant="caption">
              {matchingCategories.length} {matchingCategories.length === 1 ? 'resultado' : 'resultados'}
            </Typography>
            {matchingCategories.slice(0, visibleResultCount).map((category) => (
              <Button
                className={selectedCategory === category.id ? 'category-search-result selected' : 'category-search-result'}
                key={category.id}
                onClick={() => onSelect(category.id)}
                title={category.label}
                variant="text"
              >
                <span>{category.label}</span>
                {selectedCategory === category.id ? <Chip label="Elegida" size="small" /> : null}
              </Button>
            ))}
            {matchingCategories.length > visibleResultCount ? (
              <Button
                className="category-tree-show-more"
                fullWidth
                onClick={() => setVisibleResultCount((current) => current + SEARCH_RESULT_LIMIT)}
                variant="text"
              >
                Ver más resultados ({matchingCategories.length - visibleResultCount})
              </Button>
            ) : null}
            {!matchingCategories.length ? (
              <Typography className="category-tree-no-results" color="text.secondary" variant="body2">
                No hay categorías que coincidan con la búsqueda.
              </Typography>
            ) : null}
          </>
        )}
      </Box>
    </Box>
  );
}
