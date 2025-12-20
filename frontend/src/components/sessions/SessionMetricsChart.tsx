import { useMemo } from 'react';
import { usePageState } from '../../hooks/usePageState';
import { buildChartSeries } from '../../lib/analysis/metrics';
import { ChartBox } from '../shared/ChartBox';
import { Dropdown } from '../shared/Dropdown';
import { MetricsLineChart } from './MetricsLineChart';

type SessionMetricsChartProps = {
  metrics: { score: number[]; acc: number[]; ttk: number[] }
  title: string
  info: React.ReactNode
  modalControls?: React.ReactNode
  storageKeyPrefix: string
}

export function SessionMetricsChart({ metrics, title, info, modalControls, storageKeyPrefix }: SessionMetricsChartProps) {
  const { labels, score: scoreSeries, acc: accSeries, ttk: ttkSeries } = useMemo(() => buildChartSeries(metrics), [metrics])
  const [historyLimit, setHistoryLimit] = usePageState<string>(`${storageKeyPrefix}:historyLimit`, 'all')

  const limitedSeries = useMemo(() => {
    if (!labels || historyLimit === 'all') return { labels, scoreSeries, accSeries, ttkSeries }
    const n = parseInt(historyLimit || '0', 10)
    if (!isFinite(n) || n <= 0) return { labels, scoreSeries, accSeries, ttkSeries }
    const start = Math.max(0, labels.length - n)
    return {
      labels: labels.slice(start),
      scoreSeries: scoreSeries.slice(start),
      accSeries: accSeries.slice(start),
      ttkSeries: ttkSeries.slice(start),
    }
  }, [labels, scoreSeries, accSeries, ttkSeries, historyLimit])

  return (
    <ChartBox
      title={title}
      expandable={true}
      actions={
        <Dropdown
          size="sm"
          label="Points"
          value={historyLimit}
          onChange={(v) => setHistoryLimit(v)}
          options={[
            { label: 'All', value: 'all' },
            { label: '5', value: '5' },
            { label: '10', value: '10' },
            { label: '20', value: '20' },
            { label: '50', value: '50' },
          ]}
        />
      }
      modalControls={modalControls}
      info={info}
    >
      <MetricsLineChart labels={limitedSeries.labels} score={limitedSeries.scoreSeries} acc={limitedSeries.accSeries} ttk={limitedSeries.ttkSeries} />
    </ChartBox>
  )
}
