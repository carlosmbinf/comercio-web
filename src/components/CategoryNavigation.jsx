import React from 'react';
import { Box, Button, Chip, IconButton, TextField, Typography } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

const INITIAL_ROOT_LIMIT = 8;
const SEARCH_RESULT_LIMIT = 12;
const FLYOUT_CHILD_LIMIT = 12;

function MenuBranch({ node, depth, openPath, setOpenPath, cancelClose, scheduleClose, onOpenAll, onSelect }) {
  const hasChildren = node.children.length > 0;
  const isOpen = openPath[depth] === node.id;
  const openBranch = () => {
    if (hasChildren) setOpenPath((current) => [...current.slice(0, depth), node.id]);
  };
  const toggleBranch = () => {
    setOpenPath((current) => (
      current[depth] === node.id
        ? current.slice(0, depth)
        : [...current.slice(0, depth), node.id]
    ));
  };

  return (
    <Box
      className={`category-menu-branch depth-${Math.min(depth, 4)}${isOpen ? ' open' : ''}`}
      key={node.id}
      onFocus={openBranch}
      onMouseEnter={() => {
        cancelClose();
        openBranch();
      }}
    >
      <Button
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-haspopup={hasChildren ? 'menu' : undefined}
        className="category-menu-select"
        onClick={() => (hasChildren ? openBranch() : onSelect(node.id))}
        onFocus={openBranch}
        title={node.label}
        variant="text"
      >
        <span>{node.name || node.label}</span>
      </Button>
      {hasChildren ? (
        <IconButton
          aria-label={`${isOpen ? 'Ocultar' : 'Mostrar'} subcategorías de ${node.name || node.label}`}
          aria-expanded={isOpen}
          className="category-menu-expand"
          onClick={toggleBranch}
          onFocus={openBranch}
          size="small"
        >
          <ChevronRightRoundedIcon fontSize="small" />
        </IconButton>
      ) : null}

      {hasChildren && isOpen ? (
        <Box
          className="category-menu-submenu"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          role="group"
          aria-label={`Subcategorías de ${node.name || node.label}`}
        >
          <Typography className="category-menu-submenu-title" variant="overline">
            {node.name || node.label}
          </Typography>
          <Button
            className="category-menu-parent-action"
            onClick={() => onSelect(node.id)}
            size="small"
            variant="text"
          >
            Ver todos los productos de esta categoría
          </Button>
          {node.children.slice(0, FLYOUT_CHILD_LIMIT).map((child) => (
            <MenuBranch
              depth={depth + 1}
              key={child.id}
              node={child}
              cancelClose={cancelClose}
              scheduleClose={scheduleClose}
              onOpenAll={onOpenAll}
              onSelect={onSelect}
              openPath={openPath}
              setOpenPath={setOpenPath}
            />
          ))}
          {node.children.length > FLYOUT_CHILD_LIMIT ? (
            <Button className="category-menu-viewall" onClick={onOpenAll} size="small" variant="text">
              Ver todas ({node.children.length})
            </Button>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

export function CategoryMenu({ onOpenAll, onSelect, roots = [], selectedCategory = 'all' }) {
  const [openPath, setOpenPath] = React.useState([]);
  const closeTimer = React.useRef(null);
  const shownRoots = roots.slice(0, 6);
  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenPath([]), 220);
  };
  const selectAndClose = (categoryId) => {
    cancelClose();
    onSelect(categoryId);
    setOpenPath([]);
  };

  React.useEffect(() => () => cancelClose(), []);

  return (
    <Box
      className="category-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose();
      }}
      onFocus={cancelClose}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
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
        <MenuBranch
          depth={0}
          key={root.id}
          node={root}
          cancelClose={cancelClose}
          scheduleClose={scheduleClose}
          onOpenAll={onOpenAll}
          onSelect={selectAndClose}
          openPath={openPath}
          setOpenPath={setOpenPath}
        />
      ))}
      {roots.length > shownRoots.length ? (
        <Chip
          clickable
          className="subheader-cat-chip more"
          label="Ver todas…"
          onClick={onOpenAll}
          size="small"
        />
      ) : null}
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
