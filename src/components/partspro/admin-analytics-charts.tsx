"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

type TrafficTrendPoint = {
  date: string;
  label: string;
  pageviews: number;
  visitors: number;
};

type AdminTrafficTrendChartProps = {
  data: readonly TrafficTrendPoint[];
  pageviewsLabel: string;
  visitorsLabel: string;
};

export function AdminTrafficTrendChart({
  data,
  pageviewsLabel,
  visitorsLabel,
}: AdminTrafficTrendChartProps) {
  const viewsGradientId = React.useId().replaceAll(":", "");

  if (!data.some((item) => item.pageviews > 0 || item.visitors > 0)) {
    return <ChartPlaceholder />;
  }

  return (
    <MeasuredChart height={260}>
      {(width, height) => (
        <AreaChart width={width} height={height} data={data}>
          <defs>
            <linearGradient id={viewsGradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e5edf7" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            fontSize={11}
            interval="preserveStartEnd"
            minTickGap={22}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={38}
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <RechartsTooltip
            labelFormatter={(_label, payload) => payload[0]?.payload?.date ?? ""}
            formatter={(value, name) => [
              Number(value).toLocaleString(),
              name === "pageviews" ? pageviewsLabel : visitorsLabel,
            ]}
            contentStyle={{
              border: "1px solid #dfe6f1",
              borderRadius: 8,
              boxShadow: "0 16px 40px rgba(15,23,42,0.12)",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="pageviews"
            stroke="#2563eb"
            strokeWidth={2.5}
            fill={`url(#${viewsGradientId})`}
          />
          <Area
            type="monotone"
            dataKey="visitors"
            stroke="#7c3aed"
            strokeWidth={2}
            fill="transparent"
          />
        </AreaChart>
      )}
    </MeasuredChart>
  );
}

function MeasuredChart({
  children,
  height,
}: {
  children: (width: number, height: number) => React.ReactNode;
  height: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    let frame = 0;
    const updateWidth = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setWidth(Math.floor(element.getBoundingClientRect().width));
      });
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="h-full w-full min-w-0">
      {width > 0 ? children(width, height) : <ChartPlaceholder />}
    </div>
  );
}

function ChartPlaceholder() {
  return (
    <div className="flex h-[260px] items-end gap-2 rounded-lg bg-slate-50 p-4">
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          key={index}
          className="flex-1 rounded-t bg-primary/15"
          style={{ height: `${18 + ((index * 23) % 68)}%` }}
        />
      ))}
    </div>
  );
}
