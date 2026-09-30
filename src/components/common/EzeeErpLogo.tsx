import React from 'react';
import { DrukErpLogo, DrukErpLogoProps } from './DrukErpLogo';

export type EzeeErpLogoProps = DrukErpLogoProps;

export const EzeeErpLogo: React.FC<EzeeErpLogoProps> = (props) => {
  return <DrukErpLogo {...props} />;
};

export { DrukErpLogo };
