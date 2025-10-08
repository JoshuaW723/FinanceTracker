import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { useAppTheme } from "../theme";

export interface SpendingPoint {
  label: string;
  value: number;
  hint?: string;
}

interface SpendingChartProps {
  data: SpendingPoint[];
  style?: ViewStyle;
  formatValue?: (value: number) => string;
  onActiveChange?: (point: SpendingPoint | null) => void;
}

interface SpendingLineChartProps extends SpendingChartProps {
  comparison?: SpendingPoint[];
}

const CHART_HEIGHT = 200;
const MIN_CHART_WIDTH = 320;
const VERTICAL_PADDING = 32;
const HORIZONTAL_PADDING = 24;
const GRID_LINE_COUNT = 4;
const BAR_TOOLTIP_ANCHOR_RATIO = 0.99;

const buildPath = (points: { x: number; y: number }[]) => {
  if (!points.length) {
    return "";
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
};

const SpendingLineChartComponent = ({
  data,
  style,
  comparison,
  formatValue,
  onActiveChange,
}: SpendingLineChartProps) => {
  const theme = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(MIN_CHART_WIDTH);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const touchActiveRef = useRef(false);
  const chartWidth = Math.max(containerWidth, MIN_CHART_WIDTH);
  const usableHeight = CHART_HEIGHT - VERTICAL_PADDING * 2;
  const baseLineY = CHART_HEIGHT - VERTICAL_PADDING;
  const handleRelease = useCallback(() => {
    touchActiveRef.current = false;
    setActiveIndex(null);
  }, []);

  const extractTouchX = useCallback((event: GestureResponderEvent) => {
    const primaryTouch = event.nativeEvent.touches?.[0];
    if (primaryTouch && typeof primaryTouch.locationX === "number") {
      return primaryTouch.locationX;
    }

    return event.nativeEvent.locationX;
  }, []);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (width && Math.round(width) !== Math.round(containerWidth)) {
        setContainerWidth(width);
      }
    },
    [containerWidth],
  );

  useEffect(() => {
    setActiveIndex(null);
  }, [data.length]);

  useEffect(() => {
    if (!onActiveChange) {
      return;
    }

    if (activeIndex === null) {
      onActiveChange(null);
      return;
    }

    onActiveChange(data[activeIndex] ?? null);
  }, [activeIndex, data, onActiveChange]);

  const { primaryPath, primaryPoints, comparisonPath, comparisonPoints, areaPath } = useMemo(() => {
    if (!data.length) {
      return {
        primaryPath: "",
        primaryPoints: [] as (SpendingPoint & { x: number; y: number })[],
        comparisonPath: "",
        comparisonPoints: [] as (SpendingPoint & { x: number; y: number })[],
        areaPath: "",
      };
    }

    const maxValue = Math.max(
      ...data.map((item) => item.value),
      ...(comparison?.map((item) => item.value) ?? [0]),
      1,
    );
    const plotWidth = Math.max(chartWidth - HORIZONTAL_PADDING * 2, chartWidth * 0.6);
    const stepValue = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;
    const firstX = data.length > 1 ? HORIZONTAL_PADDING : chartWidth / 2;
    const lastX = data.length > 1 ? HORIZONTAL_PADDING + plotWidth : chartWidth / 2;

    const toPoints = (series: SpendingPoint[] | undefined) =>
      (series ?? []).map((item, index) => {
        const x = data.length > 1 ? HORIZONTAL_PADDING + index * stepValue : chartWidth / 2;
        const y =
          CHART_HEIGHT -
          VERTICAL_PADDING -
          Math.max(0, Math.min(1, item.value / maxValue)) * usableHeight;

        return { ...item, x, y };
      });

    const primaryPointsMeta = toPoints(data);
    const comparisonPointsMeta = toPoints(comparison);
    const primaryPathString = buildPath(primaryPointsMeta);
    const areaPathString = primaryPointsMeta.length
      ? `${primaryPathString} L${lastX},${baseLineY} L${firstX},${baseLineY} Z`
      : "";

    return {
      primaryPath: primaryPathString,
      comparisonPath: buildPath(comparisonPointsMeta),
      primaryPoints: primaryPointsMeta,
      comparisonPoints: comparisonPointsMeta,
      areaPath: areaPathString,
    };
  }, [baseLineY, chartWidth, comparison, data, usableHeight]);

  const activePoint = activeIndex !== null ? primaryPoints[activeIndex] : undefined;
  const activeComparison =
    activeIndex !== null ? comparisonPoints[activeIndex] : undefined;
  const activeLabel = activePoint?.hint ?? activePoint?.label ?? "";
  const format = formatValue ?? ((value: number) => `${value}`);
  const [tooltipSize, setTooltipSize] = useState<{ width: number; height: number } | null>(null);

  const tooltipPosition = useMemo(() => {
    if (!activePoint) {
      return null;
    }

    const width = tooltipSize?.width ?? 140;
    const height = tooltipSize?.height ?? 72;
    const margin = 12;
    const anchorY = Math.max(
      VERTICAL_PADDING,
      Math.min(CHART_HEIGHT - VERTICAL_PADDING, activePoint.y),
    );
    const proposedTop = anchorY - height / 2;
    const top = Math.min(
      CHART_HEIGHT - height - margin,
      Math.max(margin, proposedTop),
    );
    const left = Math.min(
      chartWidth - margin - width,
      Math.max(margin, activePoint.x - width / 2),
    );

    return { top, left };
  }, [activePoint, chartWidth, tooltipSize]);

  const updateActiveIndexFromX = useCallback(
    (x: number | undefined) => {
      if (typeof x !== "number" || !primaryPoints.length) {
        return;
      }

      const clampedX = Math.max(0, Math.min(chartWidth, x));
      let nextIndex = 0;
      let smallestDistance = Number.POSITIVE_INFINITY;

      primaryPoints.forEach((point, index) => {
        const distance = Math.abs(point.x - clampedX);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          nextIndex = index;
        }
      });

      setActiveIndex((previous) => (previous === nextIndex ? previous : nextIndex));
    },
    [chartWidth, primaryPoints],
  );

  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      touchActiveRef.current = true;
      updateActiveIndexFromX(extractTouchX(event));
    },
    [extractTouchX, updateActiveIndexFromX],
  );

  const handleTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!touchActiveRef.current) {
        return;
      }

      updateActiveIndexFromX(extractTouchX(event));
    },
    [extractTouchX, updateActiveIndexFromX],
  );

  return (
    <View
      style={[{ width: "100%" }, style]}
      onLayout={handleLayout}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleRelease}
      onTouchCancel={handleRelease}
    >
      {activePoint && tooltipPosition ? (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              top: tooltipPosition.top,
              left: tooltipPosition.left,
            },
          ]}
          onLayout={(event) =>
            setTooltipSize({
              width: event.nativeEvent.layout.width,
              height: event.nativeEvent.layout.height,
            })
          }
        >
          <Text style={[styles.tooltipTitle, { color: theme.colors.text }]}>Day {activeLabel}</Text>
          <Text style={[styles.tooltipValue, { color: theme.colors.primary }]}>{format(activePoint.value)}</Text>
          {activeComparison ? (
            <Text style={[styles.tooltipCaption, { color: theme.colors.textMuted }]}>
              Last month: {format(activeComparison.value)}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Svg width={chartWidth} height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
        <Defs>
          <LinearGradient id="spendingLineGradient" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={0.45} />
            <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0.05} />
          </LinearGradient>
        </Defs>

        {Array.from({ length: GRID_LINE_COUNT + 1 }).map((_, index) => {
          const y = VERTICAL_PADDING + (usableHeight / GRID_LINE_COUNT) * index;
          const opacity = index === GRID_LINE_COUNT ? 1 : 0.35;
          return (
            <Path
              key={`grid-${index}`}
              d={`M${HORIZONTAL_PADDING},${y} H${chartWidth - HORIZONTAL_PADDING}`}
              stroke={theme.colors.border}
              strokeDasharray={index === GRID_LINE_COUNT ? undefined : "6,6"}
              strokeOpacity={opacity}
            />
          );
        })}

        {comparisonPath ? (
          <Path
            d={comparisonPath}
            stroke={theme.colors.textMuted}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="6,6"
          />
        ) : null}

        {areaPath ? (
          <Path d={areaPath} fill="url(#spendingLineGradient)" opacity={0.45} />
        ) : null}

        {primaryPath ? (
          <Path
            d={primaryPath}
            stroke={theme.colors.primary}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {activePoint ? (
          <Path
            d={`M${activePoint.x},${VERTICAL_PADDING} L${activePoint.x},${baseLineY}`}
            stroke={theme.colors.border}
            strokeWidth={1}
            strokeDasharray="6,6"
          />
        ) : null}

        {primaryPoints.map((point) =>
          point.label ? (
            <SvgText
              key={`label-${point.x}-${point.label}`}
              x={point.x}
              y={baseLineY + 20}
              fontSize={12}
              fill={theme.colors.textMuted}
              textAnchor="middle"
            >
              {point.label}
            </SvgText>
          ) : null,
        )}

        {comparisonPoints.map((point, index) => (
          <Circle
            key={`comparison-point-${index}`}
            cx={point.x}
            cy={point.y}
            r={3.5}
            fill={theme.colors.surface}
            stroke={theme.colors.textMuted}
            strokeWidth={1.5}
          />
        ))}

        {primaryPoints.map((point, index) => (
          <Fragment key={`point-group-${index}`}>
            {index === activeIndex ? (
              <Circle
                cx={point.x}
                cy={point.y}
                r={8}
                fill={"transparent"}
                stroke={theme.colors.primary}
                strokeOpacity={0.25}
                strokeWidth={6}
              />
            ) : null}
            <Circle
              cx={point.x}
              cy={point.y}
              r={index === activeIndex ? 5 : 4}
              fill={theme.colors.primary}
              stroke={theme.colors.background}
              strokeWidth={2}
            />
          </Fragment>
        ))}

      </Svg>
    </View>
  );
};

const SpendingBarChartComponent = ({ data, style, formatValue, onActiveChange }: SpendingChartProps) => {
  const theme = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(MIN_CHART_WIDTH);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const touchActiveRef = useRef(false);
  const chartWidth = Math.max(containerWidth, MIN_CHART_WIDTH);
  const format = formatValue ?? ((value: number) => `${value}`);
  const handleRelease = useCallback(() => {
    touchActiveRef.current = false;
    setActiveIndex(null);
  }, []);

  const extractTouchX = useCallback((event: GestureResponderEvent) => {
    const primaryTouch = event.nativeEvent.touches?.[0];
    if (primaryTouch && typeof primaryTouch.locationX === "number") {
      return primaryTouch.locationX;
    }

    return event.nativeEvent.locationX;
  }, []);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (width && Math.round(width) !== Math.round(containerWidth)) {
        setContainerWidth(width);
      }
    },
    [containerWidth],
  );

  useEffect(() => {
    if (!data.length) {
      setActiveIndex(null);
      return;
    }

    setActiveIndex((previous) => {
      if (previous === null) {
        return null;
      }

      return Math.min(previous, data.length - 1);
    });
  }, [data]);

  useEffect(() => {
    if (!onActiveChange) {
      return;
    }

    if (activeIndex === null) {
      onActiveChange(null);
      return;
    }

    onActiveChange(data[activeIndex] ?? null);
  }, [activeIndex, data, onActiveChange]);

  const bars = useMemo(() => {
    if (!data.length) {
      return [] as {
        label: string;
        hint?: string;
        value: number;
        x: number;
        y: number;
        width: number;
        height: number;
      }[];
    }

    const maxValue = Math.max(...data.map((item) => item.value), 1);
    const usableHeight = CHART_HEIGHT - VERTICAL_PADDING * 2;
    const barWidth = Math.min(32, chartWidth / (data.length * 1.6));
    const totalBarsWidth = barWidth * data.length;
    const gap = (chartWidth - totalBarsWidth) / (data.length + 1);

    return data.map((item, index) => {
      const height = Math.max(0, Math.min(1, item.value / maxValue)) * usableHeight;
      const x = gap + index * (barWidth + gap);
      const y = CHART_HEIGHT - VERTICAL_PADDING - height;

      return {
        label: item.label,
        hint: item.hint,
        value: item.value,
        x,
        y,
        width: barWidth,
        height,
      };
    });
  }, [chartWidth, data]);

  const activePoint = activeIndex !== null ? bars[activeIndex] : undefined;
  const activeLabel = activePoint?.hint ?? activePoint?.label ?? "";
  const [tooltipSize, setTooltipSize] = useState<{ width: number; height: number } | null>(null);

  const tooltipPosition = useMemo(() => {
    if (!activePoint) {
      return null;
    }

    const width = tooltipSize?.width ?? 140;
    const height = tooltipSize?.height ?? 64;
    const margin = 12;
    const barCenterX = activePoint.x + activePoint.width / 2;
    const desiredAnchorY =
      activePoint.y + activePoint.height * (1 - BAR_TOOLTIP_ANCHOR_RATIO);
    const anchorY = Math.max(
      VERTICAL_PADDING,
      Math.min(CHART_HEIGHT - VERTICAL_PADDING, desiredAnchorY),
    );
    const proposedTop = anchorY - height / 2;
    const top = Math.min(
      CHART_HEIGHT - height - margin,
      Math.max(margin, proposedTop),
    );
    const left = Math.min(
      chartWidth - margin - width,
      Math.max(margin, barCenterX - width / 2),
    );

    return { top, left };
  }, [activePoint, chartWidth, tooltipSize]);

  const updateActiveIndexFromX = useCallback(
    (x: number | undefined) => {
      if (typeof x !== "number" || !bars.length) {
        return;
      }

      const clampedX = Math.max(0, Math.min(chartWidth, x));
      let nextIndex = bars.findIndex((bar) => clampedX >= bar.x && clampedX <= bar.x + bar.width);

      if (nextIndex === -1) {
        let smallestDistance = Number.POSITIVE_INFINITY;
        bars.forEach((bar, index) => {
          const center = bar.x + bar.width / 2;
          const distance = Math.abs(center - clampedX);
          if (distance < smallestDistance) {
            smallestDistance = distance;
            nextIndex = index;
          }
        });
      }

      if (nextIndex !== -1) {
        setActiveIndex((previous) => (previous === nextIndex ? previous : nextIndex));
      }
    },
    [bars, chartWidth],
  );

  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      touchActiveRef.current = true;
      updateActiveIndexFromX(extractTouchX(event));
    },
    [extractTouchX, updateActiveIndexFromX],
  );

  const handleTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!touchActiveRef.current) {
        return;
      }

      updateActiveIndexFromX(extractTouchX(event));
    },
    [extractTouchX, updateActiveIndexFromX],
  );

  return (
    <View
      style={[{ width: "100%" }, style]}
      onLayout={handleLayout}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleRelease}
      onTouchCancel={handleRelease}
    >
      {activePoint && tooltipPosition ? (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              top: tooltipPosition.top,
              left: tooltipPosition.left,
            },
          ]}
          onLayout={(event) =>
            setTooltipSize({
              width: event.nativeEvent.layout.width,
              height: event.nativeEvent.layout.height,
            })
          }
        >
          <Text style={[styles.tooltipTitle, { color: theme.colors.text }]}>Spending</Text>
          <Text style={[styles.tooltipValue, { color: theme.colors.primary }]}>
            {format(activePoint.value)}
          </Text>
          {activeLabel ? (
            <Text style={[styles.tooltipCaption, { color: theme.colors.textMuted }]}>on {activeLabel}</Text>
          ) : null}
        </View>
      ) : null}
      <Svg width={chartWidth} height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
        <Path
          d={`M0,${CHART_HEIGHT - VERTICAL_PADDING} H${chartWidth}`}
          stroke={theme.colors.border}
          strokeWidth={1}
        />

        {bars.map((bar, index) => (
          <Rect
            key={`bar-${index}`}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            rx={8}
            fill={theme.colors.primary}
            opacity={activeIndex === index ? 1 : 0.7}
          />
        ))}

        {bars.map((bar, index) => (
          <SvgText
            key={`bar-label-${index}`}
            x={bar.x + bar.width / 2}
            y={CHART_HEIGHT - VERTICAL_PADDING + 18}
            fontSize={12}
            fill={theme.colors.textMuted}
            textAnchor="middle"
          >
            {bar.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  tooltip: {
    position: "absolute",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    minWidth: 120,
    zIndex: 10,
    elevation: 4,
  },
  tooltipTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tooltipValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  tooltipCaption: {
    fontSize: 12,
    fontWeight: "500",
  },
});

export const SpendingLineChart = memo(SpendingLineChartComponent);
export const SpendingBarChart = memo(SpendingBarChartComponent);

