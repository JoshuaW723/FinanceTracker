import { Fragment, memo, useCallback, useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View, ViewStyle } from "react-native";
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
}

interface SpendingLineChartProps extends SpendingChartProps {
  comparison?: SpendingPoint[];
  formatValue?: (value: number) => string;
}

const CHART_HEIGHT = 200;
const MIN_CHART_WIDTH = 320;
const VERTICAL_PADDING = 32;
const HORIZONTAL_PADDING = 24;
const GRID_LINE_COUNT = 4;

const buildPath = (points: { x: number; y: number }[]) => {
  if (!points.length) {
    return "";
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
};

const SpendingLineChartComponent = ({ data, style, comparison, formatValue }: SpendingLineChartProps) => {
  const theme = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(MIN_CHART_WIDTH);
  const [activeIndex, setActiveIndex] = useState(() => (data.length ? data.length - 1 : 0));
  const chartWidth = Math.max(containerWidth, MIN_CHART_WIDTH);
  const usableHeight = CHART_HEIGHT - VERTICAL_PADDING * 2;
  const baseLineY = CHART_HEIGHT - VERTICAL_PADDING;

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
      setActiveIndex(0);
      return;
    }

    setActiveIndex((previous) => Math.min(previous, data.length - 1));
  }, [data]);

  const {
    primaryPath,
    primaryPoints,
    comparisonPath,
    comparisonPoints,
    areaPath,
    step,
  } = useMemo(() => {
    if (!data.length) {
      return {
        primaryPath: "",
        primaryPoints: [] as (SpendingPoint & { x: number; y: number })[],
        comparisonPath: "",
        comparisonPoints: [] as (SpendingPoint & { x: number; y: number })[],
        areaPath: "",
        step: chartWidth,
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
      step: stepValue,
    };
  }, [baseLineY, chartWidth, comparison, data, usableHeight]);

  const activePoint = primaryPoints[activeIndex];
  const activeComparison = comparisonPoints[activeIndex];
  const activeLabel = activePoint?.hint ?? activePoint?.label ?? "";
  const format = formatValue ?? ((value: number) => `${value}`);

  return (
    <View style={[{ width: "100%" }, style]} onLayout={handleLayout}>
      {activePoint && (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.tooltipTitle, { color: theme.colors.text }]}>Day {activeLabel}</Text>
          <Text style={[styles.tooltipValue, { color: theme.colors.primary }]}>{format(activePoint.value)}</Text>
          {activeComparison ? (
            <Text style={[styles.tooltipCaption, { color: theme.colors.textMuted }]}> 
              Last month: {format(activeComparison.value)}
            </Text>
          ) : null}
        </View>
      )}
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
              onPress={() => setActiveIndex(index)}
            />
          </Fragment>
        ))}

        {primaryPoints.map((point, index) => {
          const rectX = Math.max(0, point.x - step / 2);
          const rectWidth = Math.min(step || chartWidth, chartWidth - rectX);

          return (
            <Rect
              key={`hit-${index}`}
              x={rectX}
              y={0}
              width={rectWidth}
              height={CHART_HEIGHT}
              fill="transparent"
              onPress={() => setActiveIndex(index)}
            />
          );
        })}
      </Svg>
    </View>
  );
};

const SpendingBarChartComponent = ({ data, style }: SpendingChartProps) => {
  const theme = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(MIN_CHART_WIDTH);
  const chartWidth = Math.max(containerWidth, MIN_CHART_WIDTH);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (width && Math.round(width) !== Math.round(containerWidth)) {
        setContainerWidth(width);
      }
    },
    [containerWidth],
  );

  const bars = useMemo(() => {
    if (!data.length) {
      return [] as {
        label: string;
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
        x,
        y,
        width: barWidth,
        height,
      };
    });
  }, [chartWidth, data]);

  return (
    <View style={[{ width: "100%" }, style]} onLayout={handleLayout}>
      <Svg width={chartWidth} height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
        <Path
          d={`M0,${CHART_HEIGHT - VERTICAL_PADDING} H${chartWidth}`}
          stroke={theme.colors.border}
          strokeWidth={1}
        />

        {bars.map((bar) => (
          <Rect
            key={`bar-${bar.label}`}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            rx={8}
            fill={theme.colors.primary}
            opacity={0.85}
          />
        ))}

        {bars.map((bar) => (
          <SvgText
            key={`bar-label-${bar.label}`}
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
    top: 8,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
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

