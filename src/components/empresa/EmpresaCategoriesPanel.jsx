import React from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Switch, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import { Meteor, callMeteor } from '../../meteor/client';
import { CategoriasComercioCollection } from '../../meteor/collections';
import { ensureEmpresaMethodSuccess } from '../../domain/empresa';

const CATEGORY_FIELDS = {
  _id: 1,
  activa: 1,
  createAt: 1,
  creadaPor: 1,
  idCategoriaHeredada: 1,
  nombre: 1,
};

const buildTree = (categories) => {
  const byId = new Map((categories || []).map((category) => [String(category._id), { ...category, children: [] }]));
  const roots = [];

  byId.forEach((category) => {
    const parent = category.idCategoriaHeredada ? byId.get(String(category.idCategoriaHeredada)) : null;
    if (parent && parent._id !== category._id) parent.children.push(category);
    else roots.push(category);
  });

  const sort = (nodes) => nodes.sort((left, right) => String(left.nombre || '').localeCompare(String(right.nombre || ''), 'es'))
    .forEach((node) => sort(node.children));
  sort(roots);
  return roots;
};

function CategoryNode({ ancestorsActive = true, category, depth, onAddChild, onEdit, onToggle, userId }) {
  const canManage = category.creadaPor === userId;
  const active = category.activa !== false;
  const branchActive = ancestorsActive && active;

  return (
    <Box className="empresa-category-node" sx={{ ml: Math.min(depth, 5) * 2 }}>
      <Paper className={active ? 'empresa-category-card' : 'empresa-category-card inactive'} elevation={0}>
        <Box className="empresa-category-icon"><FolderOutlinedIcon /></Box>
        <Box className="empresa-category-copy">
          <Typography fontWeight={700} variant="subtitle1">{category.nombre}</Typography>
          <Typography color="text.secondary" variant="caption">
            {category.children.length ? `${category.children.length} subcategorías` : 'Sin subcategorías'} · {canManage ? 'Creada por ti' : 'Compartida'}
          </Typography>
        </Box>
        <Button disabled={!branchActive} onClick={() => onAddChild(category)} size="small" startIcon={<CreateNewFolderOutlinedIcon />} variant="text">Subcategoría</Button>
        {canManage ? (
          <>
            <IconButton aria-label={`Renombrar ${category.nombre}`} onClick={() => onEdit(category)} size="small"><EditOutlinedIcon fontSize="small" /></IconButton>
            <Switch
              checked={active}
              inputProps={{ 'aria-label': `${active ? 'Desactivar' : 'Activar'} ${category.nombre}` }}
              onChange={() => onToggle(category, !active)}
              size="small"
            />
          </>
        ) : <Typography color="text.secondary" variant="caption">{active ? 'Activa' : 'Inactiva'}</Typography>}
      </Paper>
      {category.children.length ? (
        <Box className="empresa-category-children">
          {category.children.map((child) => (
            <CategoryNode ancestorsActive={branchActive} category={child} depth={depth + 1} key={child._id} onAddChild={onAddChild} onEdit={onEdit} onToggle={onToggle} userId={userId} />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

export default function EmpresaCategoriesPanel({ notify, userId }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState(null);
  const [parentCategory, setParentCategory] = React.useState(null);
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [feedback, setFeedback] = React.useState('');

  const data = Meteor.useTracker(() => {
    if (!userId) return { categories: [], ready: true };
    const handle = Meteor.subscribe('categoriasComercio');
    return {
      categories: handle.ready()
        ? CategoriasComercioCollection.find({}, { fields: CATEGORY_FIELDS, sort: { createAt: 1, nombre: 1 } }).fetch()
        : [],
      ready: handle.ready(),
    };
  }, [userId]);

  const tree = React.useMemo(() => buildTree(data.categories), [data.categories]);
  const activeCount = data.categories.filter((category) => category.activa !== false).length;

  const openCreate = (parent = null) => {
    setEditingCategory(null);
    setParentCategory(parent);
    setName('');
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (category) => {
    setEditingCategory(category);
    setParentCategory(null);
    setName(category.nombre || '');
    setError('');
    setDialogOpen(true);
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    const normalizedName = name.replace(/\s+/g, ' ').trim();
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      setError('Usa un nombre de entre 2 y 80 caracteres.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      if (editingCategory) {
        ensureEmpresaMethodSuccess(await callMeteor('comercio.categorias.actualizar', {
          categoriaId: editingCategory._id,
          nombre: normalizedName,
        }));
      } else {
        ensureEmpresaMethodSuccess(await callMeteor('comercio.categorias.crear', {
          idCategoriaHeredada: parentCategory?._id || '',
          nombre: normalizedName,
        }));
      }

      setDialogOpen(false);
      setFeedback(editingCategory ? 'Categoría actualizada.' : parentCategory ? 'Subcategoría creada.' : 'Categoría creada.');
      notify?.(editingCategory ? 'Categoría actualizada.' : 'Categoría creada.');
    } catch (methodError) {
      setError(methodError?.reason || methodError?.message || 'No se pudo guardar la categoría.');
    } finally {
      setBusy(false);
    }
  };

  const toggleCategory = async (category, active) => {
    const action = active ? 'activar' : 'desactivar';
    if (!window.confirm(`¿Quieres ${action} “${category.nombre}”?${active ? '' : ' Sus productos dejarán de mostrarse en la vitrina.'}`)) return;

    setFeedback('');
    setError('');
    try {
      ensureEmpresaMethodSuccess(await callMeteor('comercio.categorias.actualizar', {
        activa: active,
        categoriaId: category._id,
      }));
      setFeedback(active ? 'Categoría activada.' : 'Categoría desactivada.');
    } catch (methodError) {
      setError(methodError?.reason || methodError?.message || 'No se pudo actualizar la categoría.');
    }
  };

  return (
    <Box className="content-stack empresa-panel">
      <Box className="empresa-panel-heading">
        <Box>
          <Typography variant="h4">Categorías</Typography>
          <Typography color="text.secondary" variant="body2">El árbol se comparte entre empresas; solo quien creó una categoría puede renombrarla o desactivarla.</Typography>
        </Box>
        <Button onClick={() => openCreate()} startIcon={<AddRoundedIcon />} variant="contained">Nueva categoría</Button>
      </Box>

      <Paper className="empresa-category-summary" elevation={0}>
        <Box><strong>{data.categories.length}</strong><span>categorías en el árbol compartido</span></Box>
        <Box><strong>{activeCount}</strong><span>categorías activas</span></Box>
      </Paper>
      {error ? <Alert onClose={() => setError('')} severity="error">{error}</Alert> : null}
      {feedback ? <Alert onClose={() => setFeedback('')} severity="success">{feedback}</Alert> : null}
      {!data.ready ? <Paper className="empresa-loading-inline" elevation={0}><CircularProgress size={22} /><Typography color="text.secondary">Cargando árbol de categorías…</Typography></Paper> : null}
      {data.ready && !tree.length ? (
        <Paper className="empresa-empty" elevation={0}><FolderOutlinedIcon color="primary" fontSize="large" /><Typography variant="h6">El árbol empieza aquí</Typography><Typography color="text.secondary" variant="body2">Crea una categoría principal y luego organiza sus subcategorías.</Typography><Button onClick={() => openCreate()} startIcon={<AddRoundedIcon />} variant="contained">Crear primera categoría</Button></Paper>
      ) : null}
      <Box className="empresa-category-tree">
        {tree.map((category) => (
          <CategoryNode category={category} depth={0} key={category._id} onAddChild={openCreate} onEdit={openEdit} onToggle={toggleCategory} userId={userId} />
        ))}
      </Box>

      <Dialog fullWidth maxWidth="xs" onClose={() => !busy && setDialogOpen(false)} open={dialogOpen}>
        <DialogTitle>{editingCategory ? 'Renombrar categoría' : parentCategory ? `Nueva subcategoría de ${parentCategory.nombre}` : 'Nueva categoría principal'}</DialogTitle>
        <Box component="form" onSubmit={saveCategory}>
          <DialogContent>
            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
            <TextField autoFocus fullWidth inputProps={{ maxLength: 80 }} label="Nombre" onChange={(event) => setName(event.target.value)} value={name} />
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button disabled={busy} startIcon={busy ? <CircularProgress color="inherit" size={16} /> : null} type="submit" variant="contained">{busy ? 'Guardando…' : 'Guardar'}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}