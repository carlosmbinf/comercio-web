import React from 'react';
import ShoppingBagRoundedIcon from '@mui/icons-material/ShoppingBagRounded';

export default function BrandImage({ src, alt = '', className = '', fallback = null, style }) {
  const [failedSource, setFailedSource] = React.useState('');
  if (!src || src === failedSource) return fallback;
  return <img alt={alt} className={className} decoding="async" onError={() => setFailedSource(src)} src={src} style={style} />;
}

export function BrandLogo({ src, name }) {
  return (
    <span className={`brand-icon${src ? ' brand-icon-custom' : ''}`}>
      <BrandImage src={src} alt={`Logo de ${name}`} className="brand-logo-image" fallback={<ShoppingBagRoundedIcon />} />
    </span>
  );
}
