export interface MetricPoint {
  metricName: string;
  value: number;
  unit: "Count" | "Milliseconds" | "Percent";
}

export class MetricsCollector {
  private readonly points: MetricPoint[] = [];

  record(point: MetricPoint): void {
    this.points.push(point);
  }

  list(): MetricPoint[] {
    return [...this.points];
  }
}
