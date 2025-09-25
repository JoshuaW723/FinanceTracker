import { Fragment, memo, useMemo } from "react";
import { View, ViewStyle } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

import { colors, radii } from "../theme";

export interface BarDatum {
  label: string;
  value: number;
}

interface MiniBarChartProps {
  data: BarDatum[];
  style?: ViewStyle;
}

const CHART_HEIGHT = 140;
const BAR_WIDTH = 24;
const BAR_GAP = 16;

const MiniBarChartComponent = ({ data, style }: MiniBarChartProps) => {
  const { maxValue, minValue } = useMemo(() => {
    if (!data.length) {
      return { maxValue: 0, minValue: 0 };
    }

    const values = data.map((item) => item.value);
    return {
      maxValue: Math.max(0, ...values),
      minValue: Math.min(0, ...values),
    };
  }, [data]);

  const valueRange = Math.max(Math.abs(maxValue), Math.abs(minValue)) || 1;
  const chartWidth = data.length * BAR_WIDTH + Math.max(0, data.length - 1) * BAR_GAP;

  return (
    <View style={style}>
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        {data.map((item, index) => {
          const value = item.value;
          const barHeight = (Math.abs(value) / valueRange) * (CHART_HEIGHT - 40);
          const isPositive = value >= 0;
          const x = index * (BAR_WIDTH + BAR_GAP);
          const y = isPositive ? CHART_HEIGHT / 2 - barHeight : CHART_HEIGHT / 2;
          const fill = isPositive ? colors.primary : colors.danger;

          return (
            <Fragment key={item.label}>
              <Rect
                x={x}
                y={y}
                rx={radii.sm}
                width={BAR_WIDTH}
                height={barHeight}
                fill={fill}
                opacity={0.9}
              />
              <SvgText
                x={x + BAR_WIDTH / 2}
                y={CHART_HEIGHT - 12}
                fontSize={12}
                fill={colors.textMuted}
                fontWeight="500"
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            </Fragment>
          );
        })}
        <Rect x={0} y={CHART_HEIGHT / 2} width={chartWidth} height={1} fill={colors.border} />
      </Svg>
    </View>
  );
};

export const MiniBarChart = memo(MiniBarChartComponent);
