import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { SiteLink } from './StoreSiteChrome';

export default function StoreContentBlocks({ appearance, placement }) {
  const blocks = appearance.design.contentBlocks.filter((block) => block.placement === placement);
  if (!blocks.length) return null;
  return <Box className="store-content-blocks">{blocks.map((block, index) => <Box component="section" key={index} className={`store-content-block block-tone-${block.tone}`}>
    <Box><Typography component="h2" variant="h4">{block.title}</Typography>{block.body ? <Typography className="store-content-block-copy">{block.body}</Typography> : null}</Box>
    {block.buttonLabel && block.href ? <Button component={SiteLink} href={block.href} variant={block.tone === 'brand' ? 'outlined' : 'contained'}>{block.buttonLabel}</Button> : null}
  </Box>)}</Box>;
}
