import {domMax, LazyMotion} from 'framer-motion';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export function MotionLazy({children}: Props) {
  return (
    <LazyMotion features={domMax}>
      {children}
    </LazyMotion>
  );
}
