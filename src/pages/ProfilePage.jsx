import React from 'react';
import { Avatar, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Paper, Typography } from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import { Link as RouterLink, useNavigate, useOutletContext } from 'react-router-dom';

import { logoutFromMeteor } from '../meteor/client';

const getName = (user) =>
  [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(' ').trim() ||
  user?.profile?.name || user?.username || 'Cliente';

export function ProfilePage() {
  const navigate = useNavigate();
  const { auth, user, userReady } = useOutletContext();
  const [confirmLogout, setConfirmLogout] = React.useState(false);
  const [logoutError, setLogoutError] = React.useState('');
  const [loggingOut, setLoggingOut] = React.useState(false);

  const email = user?.emails?.[0]?.address || 'No hay correo asociado a esta cuenta';
  const phone = user?.movil || user?.mobile || user?.phone || user?.telefono || 'No hay teléfono asociado a esta cuenta';
  const fullName = getName(user);

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logoutFromMeteor();
      setConfirmLogout(false);
      navigate('/', { replace: true });
    } catch (error) {
      setLogoutError(error?.reason || error?.message || 'No se pudo cerrar la sesión.');
    } finally {
      setLoggingOut(false);
    }
  };

  if (!auth?.userId) {
    return (
      <Box className="simple-state">
        <Paper className="empty-state-card" elevation={0}>
          <Box className="empty-state-icon"><PersonOutlineRoundedIcon /></Box>
          <Typography variant="h5">Inicia sesión para ver tu perfil</Typography>
          <Typography color="text.secondary">Aquí encontrarás tu información personal y de contacto.</Typography>
          <Button component={RouterLink} sx={{ mt: 2 }} to="/login" variant="contained">Iniciar sesión</Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box className="content-stack">
      <Box className="page-heading">
        <Typography className="eyebrow" variant="overline">TU CUENTA</Typography>
        <Typography variant="h3">Mi perfil</Typography>
        <Typography color="text.secondary">Tu información personal y datos de contacto.</Typography>
      </Box>

      <Card className="profile-card" elevation={0}>
        <CardContent>
          <Box className="profile-hero">
            <Avatar alt={fullName} className="profile-avatar" src={user?.picture || undefined}>
              {fullName.slice(0, 1).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography color="text.secondary" variant="overline">INFORMACIÓN PERSONAL</Typography>
              <Typography noWrap variant="h4">{fullName}</Typography>
              <Typography color="text.secondary">@{user?.username || 'usuario'}</Typography>
            </Box>
            <Button color="error" onClick={() => setConfirmLogout(true)} startIcon={<LogoutRoundedIcon />} variant="outlined">
              Cerrar sesión
            </Button>
          </Box>
          <Divider sx={{ my: 3 }} />
          <Box className="profile-details-grid">
            <Paper className="profile-detail" elevation={0}>
              <Box className="detail-icon"><EmailOutlinedIcon /></Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography color="text.secondary" variant="caption">CORREO ELECTRÓNICO</Typography>
                <Typography sx={{ overflowWrap: 'anywhere' }} variant="body1">{userReady ? email : 'Cargando…'}</Typography>
              </Box>
            </Paper>
            <Paper className="profile-detail" elevation={0}>
              <Box className="detail-icon"><LocalPhoneOutlinedIcon /></Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography color="text.secondary" variant="caption">TELÉFONO</Typography>
                <Typography sx={{ overflowWrap: 'anywhere' }} variant="body1">{userReady ? phone : 'Cargando…'}</Typography>
              </Box>
            </Paper>
            <Paper className="profile-detail" elevation={0}>
              <Box className="detail-icon"><PersonOutlineRoundedIcon /></Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography color="text.secondary" variant="caption">USUARIO</Typography>
                <Typography variant="body1">{user?.username || 'No disponible'}</Typography>
              </Box>
            </Paper>
          </Box>
        </CardContent>
      </Card>

      <Dialog onClose={() => !loggingOut && setConfirmLogout(false)} open={confirmLogout}>
        <DialogTitle>¿Cerrar sesión?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">Tus pedidos seguirán guardados en tu cuenta. Podrás volver a iniciar sesión cuando quieras.</Typography>
          {logoutError ? <Typography color="error" sx={{ mt: 1 }}>{logoutError}</Typography> : null}
        </DialogContent>
        <DialogActions>
          <Button disabled={loggingOut} onClick={() => setConfirmLogout(false)}>Cancelar</Button>
          <Button color="error" disabled={loggingOut} onClick={handleLogout} variant="contained">
            {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
