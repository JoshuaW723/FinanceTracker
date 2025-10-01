import { Fragment, memo, useCallback, useMemo, useState } from "react";
import { LayoutChangeEvent, View, ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";

import { useAppTheme } from "../theme";

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendLineChartProps {
  incomeSeries: TrendPoint[];
  expenseSeries: TrendPoint[];
  style?: ViewStyle;
}

const CHART_HEIGHT = 180;
const MIN_CHART_WIDTH = 280;

const buildPath = (points: { x: number; y: number }[]) => {
  if (!points.length) {
    return "";
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
};

const TrendLineChartComponent = ({ incomeSeries, expenseSeries, style }: TrendLineChartProps) => {
  const theme = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(MIN_CHART_WIDTH);
  const seriesLength = Math.max(incomeSeries.length, expenseSeries.length);
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

  const { incomePath, expensePath, pointsMeta } = useMemo(() => {
    if (!seriesLength) {
      return {
        incomePath: "",
        expensePath: "",
        pointsMeta: [] as {
          label: string;
          income?: { x: number; y: number; value: number };
          expense?: { x: number; y: number; value: number };
        }[],
      };
    }

    const mergedLabels = Array.from(
      new Set([...incomeSeries.map((item) => item.label), ...expenseSeries.map((item) => item.label)]),
    );

    const values = [
      ...incomeSeries.map((point) => point.value),
      ...expenseSeries.map((point) => point.value),
    ];

    const valueMax = Math.max(1, ...values.map((value) => Math.abs(value)));
    const verticalPadding = 24;
    const usableHeight = CHART_HEIGHT - verticalPadding * 2;
    const step = mergedLabels.length > 1 ? chartWidth / (mergedLabels.length - 1) : chartWidth / 2;

    const pointMetadata = mergedLabels.map((label, index) => {
      const incomePoint = incomeSeries.find((point) => point.label === label);
      const expensePoint = expenseSeries.find((point) => point.label === label);
      const x = mergedLabels.length > 1 ? index * step : chartWidth / 2;

      const incomeMeta = incomePoint
        ? {
            x,
            y:
              verticalPadding +
              usableHeight -
              ((incomePoint.value + valueMax) / (valueMax * 2)) * usableHeight,
            value: incomePoint.value,
          }
        : undefined;

      const expenseMeta = expensePoint
        ? {
            x,
            y:
              verticalPadding +
              usableHeight -
              ((expensePoint.value + valueMax) / (valueMax * 2)) * usableHeight,
            value: expensePoint.value,
          }
        : undefined;

      return {
        label,
        income: incomeMeta,
        expense: expenseMeta,
      };
    });

    const incomePath = buildPath(pointMetadata.flatMap((meta) => (meta.income ? [meta.income] : [])));
    const expensePath = buildPath(pointMetadata.flatMap((meta) => (meta.expense ? [meta.expense] : [])));

    return {
      incomePath,
      expensePath,
      pointsMeta: pointMetadata,
    };
  }, [chartWidth, expenseSeries, incomeSeries, seriesLength]);

  return (
    <View style={[{ width: "100%" }, style]} onLayout={handleLayout}>
      <Svg width={chartWidth} height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
        <Defs>
          <LinearGradient id="incomeGradient" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={theme.colors.success} stopOpacity={0.45} />
            <Stop offset="1" stopColor={theme.colors.success} stopOpacity={0.05} />
          </LinearGradient>
          <LinearGradient id="expenseGradient" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={theme.colors.danger} stopOpacity={0.4} />
            <Stop offset="1" stopColor={theme.colors.danger} stopOpacity={0.05} />
          </LinearGradient>
        </Defs>

        <Path
          d={`M0,${CHART_HEIGHT / 2} H${chartWidth}`}
          stroke={theme.colors.border}
          strokeDasharray="4,6"
        />

        {incomePath && (
          <>
            <Path
              d={`${incomePath} L${chartWidth},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`}
              fill="url(#incomeGradient)"
              opacity={0.25}
            />
            <Path d={incomePath} stroke={theme.colors.success} strokeWidth={3} fill="none" />
          </>
        )}

        {expensePath && (
          <>
            <Path
              d={`${expensePath} L${chartWidth},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`}
              fill="url(#expenseGradient)"
              opacity={0.3}
            />
            <Path d={expensePath} stroke={theme.colors.danger} strokeWidth={3} fill="none" />
          </>
        )}

        {pointsMeta.map((meta) => (
          <SvgText
            key={meta.label}
            x={meta.income?.x ?? meta.expense?.x ?? 0}
            y={CHART_HEIGHT - 8}
            fontSize={12}
            fill={theme.colors.textMuted}
            textAnchor="middle"
          >
            {meta.label}
          </SvgText>
        ))}

        {pointsMeta.map((meta) => (
          <Fragment key={`points-${meta.label}`}>
            {meta.income && (
              <Circle
                key={`income-${meta.label}`}
                cx={meta.income.x}
                cy={meta.income.y}
                r={4}
                fill={theme.colors.success}
                stroke={theme.colors.background}
                strokeWidth={1.5}
              />
            )}
            {meta.expense && (
              <Circle
                key={`expense-${meta.label}`}
                cx={meta.expense.x}
                cy={meta.expense.y}
                r={4}
                fill={theme.colors.danger}
                stroke={theme.colors.background}
                strokeWidth={1.5}
              />
            )}
          </Fragment>
        ))}
      </Svg>
    </View>
  );
};

export const TrendLineChart = memo(TrendLineChartComponent);
