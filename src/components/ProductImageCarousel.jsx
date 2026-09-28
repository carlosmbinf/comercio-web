import React from 'react';
import { Box, IconButton } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';
import './product-image-carousel.css';

const normalizeImages = (images) => (Array.isArray(images) ? images : [])
  .map((image, index) => {
    const url = typeof image === 'string' ? image : image?.url;
    if (typeof url !== 'string' || !url.trim()) return null;
    return {
      id: String(typeof image === 'object' ? image?.id || image?._id || index : index),
      url: url.trim(),
    };
  })
  .filter(Boolean);

export default function ProductImageCarousel({
  alt = 'Imagen del producto',
  className = '',
  fallback,
  images,
  imageClassName = '',
}) {
  const trackRef = React.useRef(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [failedImages, setFailedImages] = React.useState({});
  const normalizedImages = React.useMemo(() => normalizeImages(images), [images]);

  React.useEffect(() => {
    setActiveIndex(0);
    setFailedImages({});
    if (trackRef.current) trackRef.current.scrollLeft = 0;
  }, [normalizedImages.map((image) => image.id).join('|')]);

  const moveTo = (index) => {
    const track = trackRef.current;
    if (!track || normalizedImages.length < 2) return;
    const nextIndex = (index + normalizedImages.length) % normalizedImages.length;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: nextIndex * track.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' });
    setActiveIndex(nextIndex);
  };

  const handleScroll = (event) => {
    const width = event.currentTarget.clientWidth;
    if (!width) return;
    const nextIndex = Math.max(0, Math.min(normalizedImages.length - 1, Math.round(event.currentTarget.scrollLeft / width)));
    setActiveIndex((current) => current === nextIndex ? current : nextIndex);
  };

  if (!normalizedImages.length) {
    return (
      <Box aria-label="Sin imágenes del producto" className={`product-image-carousel-empty ${className}`} role="img">
        {fallback || <BrokenImageOutlinedIcon />}
      </Box>
    );
  }

  return (
    <Box aria-label={`${alt}: ${normalizedImages.length} imágenes`} className={`product-image-carousel ${className}`}>
      <Box className="product-image-carousel-track" onScroll={handleScroll} ref={trackRef}>
        {normalizedImages.map((image, index) => (
          <Box aria-hidden={activeIndex !== index} className="product-image-carousel-slide" key={image.id}>
            {failedImages[image.id] ? (
              <Box className="product-image-carousel-fallback"><BrokenImageOutlinedIcon /></Box>
            ) : (
              <img
                alt={index === 0 ? alt : `${alt}, imagen ${index + 1}`}
                className={imageClassName}
                loading="lazy"
                onError={() => setFailedImages((current) => ({ ...current, [image.id]: true }))}
                src={image.url}
              />
            )}
          </Box>
        ))}
      </Box>
      {normalizedImages.length > 1 ? (
        <>
          <IconButton
            aria-label="Imagen anterior"
            className="product-image-carousel-arrow previous"
            onClick={(event) => { event.stopPropagation(); moveTo(activeIndex - 1); }}
            size="small"
          >
            <ChevronLeftRoundedIcon />
          </IconButton>
          <IconButton
            aria-label="Imagen siguiente"
            className="product-image-carousel-arrow next"
            onClick={(event) => { event.stopPropagation(); moveTo(activeIndex + 1); }}
            size="small"
          >
            <ChevronRightRoundedIcon />
          </IconButton>
          <Box aria-live="polite" className="product-image-carousel-count" role="status">
            {activeIndex + 1} / {normalizedImages.length}
          </Box>
        </>
      ) : null}
    </Box>
  );
}