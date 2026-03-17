import { memo } from 'react';

export default memo(function Logo(
  props: React.ImgHTMLAttributes<HTMLImageElement>
) {
  return (
    <img
      src="/ecodigital-logo.png"
      alt="Ecodigital Logo"
      width={props.width ?? 120}
      height={props.height ?? 120}
      {...props}
    />
  );
});
