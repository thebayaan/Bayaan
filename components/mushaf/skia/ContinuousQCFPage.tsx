// @ai-start
import React, {useMemo} from 'react';
import QCFPage, {type QCFPageFrame} from '../qcf/QCFPage';
import type {RenderConstants} from './continuousRenderConstants';

// A Mushaf 1440 page in the vertical scroll: the same text block as the
// DigitalKhatt page it replaces (its lines stacked from the top).
const ContinuousQCFPage: React.FC<{
  pageNumber: number;
  textColor: string;
  dividerColor: string;
  onTap?: () => void;
  render: RenderConstants;
  /** The page's height in the list (its getItemLayout entry). */
  pageHeight: number;
}> = React.memo(
  ({pageNumber, textColor, dividerColor, onTap, render, pageHeight}) => {
    const {screenWidth, contentWidth, canvasMarginX, baseLineHeight} = render;
    const frame = useMemo<QCFPageFrame>(
      () => ({
        width: screenWidth,
        height: pageHeight,
        contentLeft: canvasMarginX,
        contentTop: 0,
        contentWidth,
        contentHeight: pageHeight,
        lineHeight: baseLineHeight,
        centerOpeningPages: false,
      }),
      [screenWidth, pageHeight, baseLineHeight, canvasMarginX, contentWidth],
    );
    return (
      <QCFPage
        pageNumber={pageNumber}
        textColor={textColor}
        dividerColor={dividerColor}
        frame={frame}
        onTap={onTap}
      />
    );
  },
);
ContinuousQCFPage.displayName = 'ContinuousQCFPage';

export default ContinuousQCFPage;
// @ai-end
