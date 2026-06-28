"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatEuro } from "@/lib/partspro-data";

type SalesTrendPoint = {
  day: string;
  key: string;
  orders: number;
  pieces: number;
  sales: number;
};

type InventoryMixPoint = {
  fill: string;
  key: string;
  label: string;
  value: number;
};

type SalesTrendChartProps = {
  data: readonly SalesTrendPoint[];
  salesLabel: string;
};

type InventoryMixChartProps = {
  data: readonly InventoryMixPoint[];
};

export function AdminSalesTrendChart({ data, salesLabel }: SalesTrendChartProps) {
  const gradientId = React.useId().replaceAll(":", "");

  return (
    <MeasuredChart height={220}>
      {(width, height) => (
        <AreaChart width={width} height={height} data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e5edf7" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="day"
            fontSize={11}
            interval="preserveStartEnd"
            minTickGap={18}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            width={42}
            fontSize={11}
            tickFormatter={formatAxisEuro}
            tickLine={false}
            axisLine={false}
          />
          <RechartsTooltip
            formatter={(value, name) => [
              name === "sales" ? formatEuro(Number(value)) : value,
              name === "sales" ? salesLabel : name,
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
            dataKey="sales"
            stroke="#2563eb"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      )}
    </MeasuredChart>
  );
}

export function AdminInventoryMixChart({ data }: InventoryMixChartProps) {
  if (!data.some((item) => item.value > 0)) {
    return <ChartPlaceholder compact />;
  }

  return (
    <MeasuredChart compact height={116}>
      {(width, height) => (
        <PieChart width={width} height={height}>
          <Pie
            data={data}
            innerRadius={34}
            outerRadius={52}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      )}
    </MeasuredChart>
  );
}

function MeasuredChart({
  children,
  compact = false,
  height,
}: {
  children: (width: number, height: number) => React.ReactNode;
  compact?: boolean;
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
      {width > 0 ? children(width, height) : <ChartPlaceholder compact={compact} />}
    </div>
  );
}

function ChartPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full min-h-[96px] items-end gap-1.5 rounded-lg bg-slate-50 p-3">
      {Array.from({ length: compact ? 5 : 10 }).map((_, index) => (
        <div
          key={index}
          className="flex-1 rounded-t bg-primary/15"
          style={{ height: `${24 + ((index * 19) % 58)}%` }}
        />
      ))}
    </div>
  );
}

function formatAxisEuro(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return "";
  }

  if (Math.abs(numeric) >= 1000) {
    return `€${Math.round(numeric / 1000)}k`;
  }

  return `€${Math.round(numeric)}`;
}
