import { createInlineIcon, inlineSvgRoot } from './createInlineIcon';

export const CalendarIcon = createInlineIcon('CalendarIcon', ({ strokeWidth }) =>
  inlineSvgRoot(
    strokeWidth,
    <>
      <path d="M8.00001 2V6M16 2V6" />
      <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" />
      <path d="M3 9.99988H21M8 13.9999H8.01M12 13.9999H12.01M16 13.9999H16.01M8 17.9999H8.01M12 17.9999H12.01M16 17.9999H16.01" />
    </>,
  ),
);
