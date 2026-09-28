import React from 'react';
import { METEOR_HTTP_URL } from '../config';
import { getProductImageSources } from '../domain/productImages';

function ImageWithFallback({ sources, onError, ...props }) {
  const [sourceIndex, setSourceIndex] = React.useState(0);

  return (
    <img
      {...props}
      onError={(event) => {
        if (sourceIndex + 1 < sources.length) {
          setSourceIndex(sourceIndex + 1);
        } else {
          onError?.(event);
        }
      }}
      src={sources[sourceIndex]}
    />
  );
}

export default function ProductImage({ src, ...props }) {
  const sources = getProductImageSources(src, METEOR_HTTP_URL);
  return <ImageWithFallback {...props} key={sources.join('|')} sources={sources} />;
}