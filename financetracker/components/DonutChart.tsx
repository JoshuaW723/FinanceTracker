import { memo, useMemo } from "react";
import { View, ViewStyle } from "react-native";
import Svg, { G, Path, Text as SvgText } from "react-native-svg";

import { useAppTheme } from "../theme";

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  style?: ViewStyle;
}

const RADIUS = 60;
const STROKE_WIDTH = 22;

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [`M ${start.x} ${start.y}`, `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`].join(" ");
};

const DonutChartComponent = ({ data, style }: DonutChartProps) => {
  const theme = useAppTheme();

  const { segments, total } = useMemo(() => {
    const totalValue = data.reduce((acc, item) => acc + Math.max(item.value, 0), 0);
    let cumulativeAngle = 0;

    const segments = data.map((item, index) => {
      const normalizedValue = totalValue ? Math.max(item.value, 0) / totalValue : 0;
      const startAngle = cumulativeAngle;
      const sweepAngle = normalizedValue * 360;
      cumulativeAngle += sweepAngle;

      const colorPalette = [
        theme.colors.primary,
        theme.colors.accent,
        theme.colors.success,
        theme.colors.danger,
        theme.colors.primaryMuted,
      ];

      const color = item.color ?? colorPalette[index % colorPalette.length];

      return {
        label: item.label,
        value: item.value,
        percentage: normalizedValue,
        path: describeArc(RADIUS + STROKE_WIDTH, RADIUS + STROKE_WIDTH, RADIUS, startAngle, startAngle + sweepAngle),
        color,
        startAngle,
        sweepAngle,
      };
    });

    return { segments, total: totalValue };
  }, [data, theme.colors]);

  return (
    <View style={style}>
      <Svg width={(RADIUS + STROKE_WIDTH) * 2} height={(RADIUS + STROKE_WIDTH) * 2}>
        <G rotation={-90} origin={`${RADIUS + STROKE_WIDTH}, ${RADIUS + STROKE_WIDTH}`}>
          {segments.map((segment) => (
            <Path
              key={segment.label}
              d={segment.path}
              stroke={segment.color}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeOpacity={0.9}
            />
          ))}
        </G>
        <SvgText
          x={RADIUS + STROKE_WIDTH}
          y={RADIUS + STROKE_WIDTH - 4}
          fontSize={20}
          fontWeight="700"
          fill={theme.colors.text}
          textAnchor="middle"
        >
          {total ? Math.round(total).toLocaleString() : "0"}
        </SvgText>
        <SvgText
          x={RADIUS + STROKE_WIDTH}
          y={RADIUS + STROKE_WIDTH + 16}
          fontSize={12}
          fill={theme.colors.textMuted}
          textAnchor="middle"
        >
          total spend
        </SvgText>
      </Svg>
    </View>
  );
};

export const DonutChart = memo(DonutChartComponent);
