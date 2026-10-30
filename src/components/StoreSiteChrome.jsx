import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BrandImage, { BrandLogo } from './BrandImage';
import { normalizePublicLink } from '../domain/appearanceCustomization';

export function SiteLink({ href, newTab = false, children, ...props }) {
  const safeHref = normalizePublicLink(href);
  if (!safeHref) return null;
  return <Box component={safeHref.startsWith('/') ? RouterLink : 'a'} {...(safeHref.startsWith('/') ? { to: safeHref } : { href: safeHref })} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined} {...props}>{children}</Box>;
}

export function StoreAnnouncement({ appearance }) {
  const { announcementText, announcementUrl } = appearance.design;
  if (!announcementText) return null;
  return <Box className="site-announcement">{announcementUrl ? <SiteLink href={announcementUrl}>{announcementText}</SiteLink> : announcementText}</Box>;
}

export function StoreHeader({ appearance, storeLabel, children }) {
  const headerRef = React.useRef(null);
  const design = appearance.design;
  React.useEffect(() => {
    const element = headerRef.current;
    const root = element?.closest('.app-root');
    if (!root) return undefined;
    const measure = () => root.style.setProperty('--brand-header-height', `${design.headerSticky ? element.getBoundingClientRect().height : 0}px`);
    measure();
    const Observer = element.ownerDocument.defaultView?.ResizeObserver;
    const observer = Observer ? new Observer(measure) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [design.headerSticky, design.headerLayout]);
  return <Box component="header" className={`site-header header-layout-${design.headerLayout}${appearance.headerImage ? ' has-chrome-image' : ''}`} data-sticky={design.headerSticky} ref={headerRef}>
    <BrandImage src={appearance.headerImage} className="brand-chrome-image" />
    <Container maxWidth={false} className="header-inner site-width">
      <RouterLink aria-label="Ir al inicio" className="brand-link" to="/">
        <BrandLogo src={appearance.logo} name={storeLabel} />
        <Box sx={{ minWidth: 0 }}>
          <Typography className="brand-title" noWrap>{storeLabel}</Typography>
          {design.headerShowCaption ? <Typography className="brand-caption" noWrap>{design.headerCaption || `COMPRA LOCAL · ${storeLabel.toLocaleUpperCase('es')}`}</Typography> : null}
        </Box>
      </RouterLink>
      {children}
    </Container>
    {design.headerLinks.length ? <Box component="nav" className="site-header-links site-width" aria-label="Enlaces del comercio">{design.headerLinks.map((link, index) => <SiteLink key={index} {...link}>{link.label}</SiteLink>)}</Box> : null}
  </Box>;
}

export function StoreFooter({ appearance, storeLabel }) {
  const design = appearance.design;
  if (!design.footerVisible) return null;
  return <Box component="footer" className={`site-footer footer-layout-${design.footerLayout}${appearance.footerImage ? ' has-chrome-image' : ''}`}>
    <BrandImage src={appearance.footerImage} className="brand-chrome-image" />
    <Container maxWidth={false} className="footer-inner site-width">
      <Box className="footer-identity">
        {design.footerShowLogo ? <BrandLogo src={appearance.logo} name={storeLabel} /> : null}
        <Box>{design.footerShowTitle ? <Typography className="footer-title" fontWeight={800}>{design.footerTitle || storeLabel}</Typography> : null}
          {design.footerShowDescription ? <Typography className="footer-description" variant="body2">{design.footerText || 'Compra segura, seguimiento claro y atención en un solo lugar.'}</Typography> : null}</Box>
      </Box>
      {design.footerLinks.length ? <Box component="nav" className="footer-links" aria-label="Enlaces del pie de página">{design.footerLinks.map((link, index) => <SiteLink key={index} {...link}>{link.label}</SiteLink>)}</Box> : null}
      {design.footerCopyright ? <Typography className="footer-copyright" variant="caption">{design.footerCopyright}</Typography> : null}
    </Container>
  </Box>;
}
