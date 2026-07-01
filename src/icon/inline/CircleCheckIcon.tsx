import { createInlineIcon, inlineSvgRoot } from './createInlineIcon';

export const CircleCheckIcon = createInlineIcon('CircleCheckIcon', ({ strokeWidth }) =>
  inlineSvgRoot(
    strokeWidth,
    <>
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
      <path d="M8.99998 12L11 14L15 10" />
    </>,
  ),
);
