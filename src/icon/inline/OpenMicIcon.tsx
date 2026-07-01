import { createInlineIcon, inlineSvgRoot } from './createInlineIcon';

export const OpenMicIcon = createInlineIcon('OpenMicIcon', ({ strokeWidth }) =>
  inlineSvgRoot(
    strokeWidth,
    <>
      <path d="M12 19.0001V22.0001M5 10.0001V12.0001C5 13.8566 5.7375 15.6371 7.05025 16.9499C8.36301 18.2626 10.1435 19.0001 12 19.0001C13.8565 19.0001 15.637 18.2626 16.9497 16.9499C18.2625 15.6371 19 13.8566 19 12.0001V10.0001" />
      <path d="M15 5C15 3.34315 13.6569 2 12 2C10.3431 2 9 3.34315 9 5V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V5Z" />
    </>,
  ),
);
