import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, AreaSeries } from 'lightweight-charts'
import PacmanLoader from '../ui/pacman-loader'
import { formatChartTime } from '../../lib/dateTime'

interface TradingViewChartProps {
  symbol: string
  period: string
  chartType: 'candlestick' | 'line' | 'area'
  selectedIndicators: string[]
  onLoadingChange: (loading: boolean) => void
  data?: any[]
  onLoadMore?: () => void
  onDataUpdate?: (klines: any[], indicators: any) => void
  onIndicatorLoadingChange?: (loading: boolean) => void
}

type ChartType = 'candlestick' | 'line' | 'area'

export default function TradingViewChart({
  symbol,
  period,
  chartType,
  selectedIndicators,
  onLoadingChange,
  data = [],
  onLoadMore,
  onDataUpdate,
  onIndicatorLoadingChange
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const seriesRef = useRef<any>(null)
  const volumeSeriesRef = useRef<any>(null)
  const ma5SeriesRef = useRef<any>(null)
  const ma10SeriesRef = useRef<any>(null)
  const ma20SeriesRef = useRef<any>(null)
  const ema20SeriesRef = useRef<any>(null)
  const ema50SeriesRef = useRef<any>(null)
  const ema100SeriesRef = useRef<any>(null)
  const vwapSeriesRef = useRef<any>(null)
  const bollUpperSeriesRef = useRef<any>(null)
  const bollMiddleSeriesRef = useRef<any>(null)
  const bollLowerSeriesRef = useRef<any>(null)
  const rsiSeriesRef = useRef<any>(null)
  const macdSeriesRef = useRef<any>(null)
  const atrSeriesRef = useRef<any>(null)
  const stochSeriesRef = useRef<any>(null)
  const obvSeriesRef = useRef<any>(null)
  const [loading, setLoading] = useState(false)
  const [hasData, setHasData] = useState(false)
  const [chartData, setChartData] = useState<any[]>([])
  const [indicatorData, setIndicatorData] = useState<any>({})
  const [cachedIndicators, setCachedIndicators] = useState<string[]>([])
  const [activeSubplot, setActiveSubplot] = useState<string | null>(null)
  const indicatorPaneRef = useRef<any>(null)
  const indicatorLabelRef = useRef<any>(null)
  const prevIndicatorsRef = useRef<string[]>([])
  const prevSubplotIndicatorsRef = useRef<string[]>([])

  // 检测是否需要重新初始化图表（子图结构变化）
  const needsChartReinit = (prevIndicators: string[], newIndicators: string[]) => {
    const subplotIndicators = ['RSI14', 'RSI7', 'MACD', 'ATR14', 'STOCH', 'OBV']
    const prevSubplots = prevIndicators.filter(ind => subplotIndicators.includes(ind))
    const newSubplots = newIndicators.filter(ind => subplotIndicators.includes(ind))

    // 子图指标从无到有，或从有到无，需要重新初始化
    return (prevSubplots.length === 0) !== (newSubplots.length === 0)
  }

  // 创建 pane 标签的 primitive
  const createPaneLabel = (text: string) => ({
    paneViews() {
      return [{
        renderer() {
          return {
            draw(target: any) {
              target.useMediaCoordinateSpace((scope: any) => {
                const ctx = scope.context
                ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                ctx.fillStyle = 'rgba(156, 163, 175, 0.6)'
                ctx.textAlign = 'left'
                ctx.textBaseline = 'top'
                ctx.fillText(text, 8, 8)
              })
            }
          }
        }
      }]
    }
  })

  // 创建主图表系列
  const createMainSeries = (chart: any, type: ChartType) => {
    switch (type) {
      case 'candlestick':
        return chart.addSeries(CandlestickSeries, {
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderDownColor: '#ef4444',
          borderUpColor: '#22c55e',
          wickDownColor: '#ef4444',
          wickUpColor: '#22c55e',
        })
      case 'line':
        return chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 2,
        })
      case 'area':
        return chart.addSeries(AreaSeries, {
          topColor: '#3b82f640',
          bottomColor: '#3b82f610',
          lineColor: '#3b82f6',
          lineWidth: 2,
        })
      default:
        return chart.addSeries(CandlestickSeries, {
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderDownColor: '#ef4444',
          borderUpColor: '#22c55e',
          wickDownColor: '#ef4444',
          wickUpColor: '#22c55e',
        })
    }
  }

  // 转换数据格式
  const convertDataForSeries = (data: any[], type: ChartType) => {
    switch (type) {
      case 'candlestick':
        return data.map(item => ({
          time: item.time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        }))
      case 'line':
      case 'area':
        return data.map(item => ({
          time: item.time,
          value: item.close,
        }))
      default:
        return data
    }
  }

  // 计算移动平均线
  const calculateMA = (data: any[], period: number) => {
    const result = []
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, item) => acc + item.close, 0)
      result.push({
        time: data[i].time,
        value: sum / period,
      })
    }
    return result
  }


  // 图表初始化 - 只在chartType变化时重新初始化
  useEffect(() => {
    if (!chartContainerRef.current) return

    try {
      const container = chartContainerRef.current

      // 判断是否需要指标子图
      const subplotIndicators = selectedIndicators.filter(ind => ['RSI14', 'RSI7', 'MACD', 'ATR14', 'STOCH', 'OBV'].includes(ind))
      const needsSubplot = subplotIndicators.length > 0

      // 创建图表 - 使用正确的Panel架构
      const chart = createChart(container, {
        width: container.clientWidth,
        height: Math.max(container.clientHeight || 300, 300),
        layout: {
          background: { color: 'transparent' },
          textColor: '#9ca3af',
          attributionLogo: false,
        },
        localization: {
          locale: 'en-US',
        },
        grid: {
          vertLines: { color: 'rgba(156, 163, 175, 0.1)' },
          horzLines: { color: 'rgba(156, 163, 175, 0.1)' },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            width: 1,
            color: 'rgba(156, 163, 175, 0.5)',
            style: 0,
          },
          horzLine: {
            width: 1,
            color: 'rgba(156, 163, 175, 0.5)',
            style: 0,
          },
        },
        rightPriceScale: {
          borderColor: 'rgba(156, 163, 175, 0.2)',
        },
        timeScale: {
          borderColor: 'rgba(156, 163, 175, 0.2)',
          timeVisible: true,
          secondsVisible: false,
          barSpacing: 9,
          rightBarStaysOnScroll: false,
        },
      })

      // 创建Volume Panel
      const volumePane = chart.addPane()
      volumePane.attachPrimitive(createPaneLabel('Volume'))

      // 创建指标Panel（如果需要）
      let indicatorPane = null
      if (needsSubplot) {
        indicatorPane = chart.addPane()
        indicatorPaneRef.current = indicatorPane
        // 创建并附加标签 primitive
        const labelPrimitive = createPaneLabel('Indicators')
        indicatorPane.attachPrimitive(labelPrimitive)
        indicatorLabelRef.current = labelPrimitive
      }

      // 设置Panel高度比例
      if (needsSubplot) {
        // 三层布局：主图60% + Volume20% + 指标20%
        chart.panes()[0].setStretchFactor(3)  // 主图 60% (3/5)
        volumePane.setStretchFactor(1)        // Volume 20% (1/5)
        indicatorPane.setStretchFactor(1)     // 指标 20% (1/5)
      } else {
        // 两层布局：主图80% + Volume20%
        chart.panes()[0].setStretchFactor(4)  // 主图 80% (4/5)
        volumePane.setStretchFactor(1)        // Volume 20% (1/5)
      }

      // 在主Panel创建主图表系列
      const mainSeries = createMainSeries(chart, chartType)

      // 在Volume Panel创建成交量系列
      const volumeSeries = volumePane.addSeries(HistogramSeries, {
        color: '#6b7280',
        priceFormat: {
          type: 'volume',
        },
      })


      // 创建移动平均线系列
      const ma5Series = chart.addSeries(LineSeries, {
        color: '#ff6b6b',
        lineWidth: 1,
        visible: false,
      })

      const ma10Series = chart.addSeries(LineSeries, {
        color: '#4ecdc4',
        lineWidth: 1,
        visible: false,
      })

      const ma20Series = chart.addSeries(LineSeries, {
        color: '#45b7d1',
        lineWidth: 1,
        visible: false,
      })

      // EMA指标系列
      const ema20Series = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 2,
        visible: false,
      })

      const ema50Series = chart.addSeries(LineSeries, {
        color: '#8b5cf6',
        lineWidth: 2,
        visible: false,
      })

      const ema100Series = chart.addSeries(LineSeries, {
        color: '#ec4899',
        lineWidth: 2,
        visible: false,
      })

      const vwapSeries = chart.addSeries(LineSeries, {
        color: '#14b8a6',
        lineWidth: 2,
        visible: false,
      })

      // 创建BOLL布林带系列
      const bollUpperSeries = chart.addSeries(LineSeries, {
        color: '#9333ea',
        lineWidth: 1,
        visible: false,
      })

      const bollMiddleSeries = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 1,
        visible: false,
      })

      const bollLowerSeries = chart.addSeries(LineSeries, {
        color: '#9333ea',
        lineWidth: 1,
        visible: false,
      })

      // 创建指标系列（在指标Panel中）
      let rsiSeries = null
      let macdSeries = null
      let atrSeries = null
      let stochSeries = null
      let obvSeries = null

      if (indicatorPane) {
        rsiSeries = indicatorPane.addSeries(LineSeries, {
          color: '#e11d48',
          lineWidth: 2,
          visible: false,
        })

        // MACD需要多个系列
        const macdLine = indicatorPane.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 2,
          visible: false,
        })
        const signalLine = indicatorPane.addSeries(LineSeries, {
          color: '#f59e0b',
          lineWidth: 1,
          visible: false,
        })
        const histogram = indicatorPane.addSeries(HistogramSeries, {
          color: '#6b7280',
          visible: false,
        })
        macdSeries = { macdLine, signalLine, histogram }

        atrSeries = indicatorPane.addSeries(LineSeries, {
          color: '#8b5cf6',
          lineWidth: 2,
          visible: false,
        })

        // Stochastic需要两条线（%K和%D）
        const stochK = indicatorPane.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 2,
          visible: false,
        })
        const stochD = indicatorPane.addSeries(LineSeries, {
          color: '#f59e0b',
          lineWidth: 1,
          visible: false,
        })
        stochSeries = { stochK, stochD }

        obvSeries = indicatorPane.addSeries(LineSeries, {
          color: '#10b981',
          lineWidth: 2,
          visible: false,
        })
      }

      chartRef.current = chart
      seriesRef.current = mainSeries
      volumeSeriesRef.current = volumeSeries
      ma5SeriesRef.current = ma5Series
      ma10SeriesRef.current = ma10Series
      ma20SeriesRef.current = ma20Series
      ema20SeriesRef.current = ema20Series
      ema50SeriesRef.current = ema50Series
      ema100SeriesRef.current = ema100Series
      vwapSeriesRef.current = vwapSeries
      bollUpperSeriesRef.current = bollUpperSeries
      bollMiddleSeriesRef.current = bollMiddleSeries
      bollLowerSeriesRef.current = bollLowerSeries
      rsiSeriesRef.current = rsiSeries
      macdSeriesRef.current = macdSeries
      atrSeriesRef.current = atrSeries
      stochSeriesRef.current = stochSeries
      obvSeriesRef.current = obvSeries

      // 监听容器大小变化
      let resizeTimeout: NodeJS.Timeout
      const resizeObserver = new ResizeObserver(entries => {
        clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(() => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect
            if (chartRef.current && width > 0 && height > 0) {
              chartRef.current.applyOptions({ width, height })
            }
          }
        }, 100)
      })
      resizeObserver.observe(container)

      return () => {
        clearTimeout(resizeTimeout)
        resizeObserver.disconnect()
        if (chartRef.current) {
          chartRef.current.remove()
          chartRef.current = null
          seriesRef.current = null
          volumeSeriesRef.current = null
          ma5SeriesRef.current = null
          ma10SeriesRef.current = null
          ma20SeriesRef.current = null
          ema20SeriesRef.current = null
          ema50SeriesRef.current = null
          ema100SeriesRef.current = null
          vwapSeriesRef.current = null
          bollUpperSeriesRef.current = null
          bollMiddleSeriesRef.current = null
          bollLowerSeriesRef.current = null
          rsiSeriesRef.current = null
          macdSeriesRef.current = null
          atrSeriesRef.current = null
          stochSeriesRef.current = null
          obvSeriesRef.current = null
          indicatorPaneRef.current = null
          indicatorLabelRef.current = null
        }
      }
    } catch (error) {
      console.error('Chart initialization failed:', error)
    }
  }, [chartType])

  // 动态管理子图Pane - 只在子图结构变化时重新初始化
  useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current) return

    const shouldReinit = needsChartReinit(prevIndicatorsRef.current, selectedIndicators)

    if (shouldReinit) {
      // 需要重新初始化图表结构
      const container = chartContainerRef.current
      const currentChartData = chartData
      const currentIndicatorData = indicatorData

      // 在重建前设置正确的activeSubplot，避免状态滞后
      const subplotIndicators = selectedIndicators.filter(ind => ['RSI14', 'RSI7', 'MACD', 'ATR14', 'STOCH', 'OBV'].includes(ind))
      if (subplotIndicators.length > 0 && !activeSubplot) {
        setActiveSubplot(subplotIndicators[0])
      }

      // 保存当前数据，重新初始化图表
      if (chartRef.current) {
        chartRef.current.remove()
      }

      try {
        // 判断是否需要指标子图
        const subplotIndicators = selectedIndicators.filter(ind => ['RSI14', 'RSI7', 'MACD', 'ATR14', 'STOCH', 'OBV'].includes(ind))
        const needsSubplot = subplotIndicators.length > 0

        // 创建图表 - 使用正确的Panel架构
        const chart = createChart(container, {
          width: container.clientWidth,
          height: Math.max(container.clientHeight || 300, 300),
          layout: {
            background: { color: 'transparent' },
            textColor: '#9ca3af',
            attributionLogo: false,
          },
          localization: {
            locale: 'en-US',
          },
          grid: {
            vertLines: { color: 'rgba(156, 163, 175, 0.1)' },
            horzLines: { color: 'rgba(156, 163, 175, 0.1)' },
          },
          crosshair: {
            mode: 1,
            vertLine: {
              width: 1,
              color: 'rgba(156, 163, 175, 0.5)',
              style: 0,
            },
            horzLine: {
              width: 1,
              color: 'rgba(156, 163, 175, 0.5)',
              style: 0,
            },
          },
          rightPriceScale: {
            borderColor: 'rgba(156, 163, 175, 0.2)',
          },
          timeScale: {
            borderColor: 'rgba(156, 163, 175, 0.2)',
            timeVisible: true,
            secondsVisible: false,
            barSpacing: 9,
            rightBarStaysOnScroll: false,
          },
        })

        // 创建Volume Panel
        const volumePane = chart.addPane()
        volumePane.attachPrimitive(createPaneLabel('Volume'))

        // 创建指标Panel（如果需要）
        let indicatorPane = null
        if (needsSubplot) {
          indicatorPane = chart.addPane()
          indicatorPaneRef.current = indicatorPane
          const labelPrimitive = createPaneLabel('Indicators')
          indicatorPane.attachPrimitive(labelPrimitive)
          indicatorLabelRef.current = labelPrimitive
        }

        // 设置Panel高度比例
        if (needsSubplot) {
          chart.panes()[0].setStretchFactor(3)
          volumePane.setStretchFactor(1)
          indicatorPane.setStretchFactor(1)
        } else {
          chart.panes()[0].setStretchFactor(4)
          volumePane.setStretchFactor(1)
        }

        // 重新创建所有系列
        const mainSeries = createMainSeries(chart, chartType)
        const volumeSeries = volumePane.addSeries(HistogramSeries, {
          color: '#6b7280',
          priceFormat: { type: 'volume' },
        })

        // 创建移动平均线系列
        const ma5Series = chart.addSeries(LineSeries, { color: '#ff6b6b', lineWidth: 1, visible: false })
        const ma10Series = chart.addSeries(LineSeries, { color: '#4ecdc4', lineWidth: 1, visible: false })
        const ma20Series = chart.addSeries(LineSeries, { color: '#45b7d1', lineWidth: 1, visible: false })
        const ema20Series = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, visible: false })
        const ema50Series = chart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 2, visible: false })
        const ema100Series = chart.addSeries(LineSeries, { color: '#ec4899', lineWidth: 2, visible: false })
        const vwapSeries = chart.addSeries(LineSeries, { color: '#14b8a6', lineWidth: 2, visible: false })
        const bollUpperSeries = chart.addSeries(LineSeries, { color: '#9333ea', lineWidth: 1, visible: false })
        const bollMiddleSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, visible: false })
        const bollLowerSeries = chart.addSeries(LineSeries, { color: '#9333ea', lineWidth: 1, visible: false })

        // 创建指标系列（在指标Panel中）
        let rsiSeries = null
        let macdSeries = null
        let atrSeries = null
        let stochSeries = null
        let obvSeries = null

        if (indicatorPane) {
          rsiSeries = indicatorPane.addSeries(LineSeries, { color: '#e11d48', lineWidth: 2, visible: false })
          const macdLine = indicatorPane.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, visible: false })
          const signalLine = indicatorPane.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, visible: false })
          const histogram = indicatorPane.addSeries(HistogramSeries, { color: '#6b7280', visible: false })
          macdSeries = { macdLine, signalLine, histogram }
          atrSeries = indicatorPane.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 2, visible: false })
          const stochK = indicatorPane.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, visible: false })
          const stochD = indicatorPane.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, visible: false })
          stochSeries = { stochK, stochD }
          obvSeries = indicatorPane.addSeries(LineSeries, { color: '#10b981', lineWidth: 2, visible: false })
        }

        // 更新所有引用
        chartRef.current = chart
        seriesRef.current = mainSeries
        volumeSeriesRef.current = volumeSeries
        ma5SeriesRef.current = ma5Series
        ma10SeriesRef.current = ma10Series
        ma20SeriesRef.current = ma20Series
        ema20SeriesRef.current = ema20Series
        ema50SeriesRef.current = ema50Series
        ema100SeriesRef.current = ema100Series
        vwapSeriesRef.current = vwapSeries
        bollUpperSeriesRef.current = bollUpperSeries
        bollMiddleSeriesRef.current = bollMiddleSeries
        bollLowerSeriesRef.current = bollLowerSeries
        rsiSeriesRef.current = rsiSeries
        macdSeriesRef.current = macdSeries
        atrSeriesRef.current = atrSeries
        stochSeriesRef.current = stochSeries
        obvSeriesRef.current = obvSeries

        // 重新应用数据
        const resolvedActiveSubplot = (activeSubplot && subplotIndicators.includes(activeSubplot))
          ? activeSubplot
          : subplotIndicators[0]

        if (currentChartData.length > 0) {
          const mainData = convertDataForSeries(currentChartData, chartType)
          const volumeData = currentChartData.map(item => ({
            time: item.time,
            value: item.volume || 0,
            color: item.close >= item.open ? '#22c55e' : '#ef4444',
          }))

          mainSeries.setData(mainData)
          volumeSeries.setData(volumeData)

          // 重新应用移动平均线数据
          const ma5Data = calculateMA(currentChartData, 5)
          const ma10Data = calculateMA(currentChartData, 10)
          const ma20Data = calculateMA(currentChartData, 20)
          ma5Series.setData(ma5Data)
          ma10Series.setData(ma10Data)
          ma20Series.setData(ma20Data)

          // 重新应用指标数据
          if (currentIndicatorData.EMA20 && ema20Series) {
            const ema20Data = currentIndicatorData.EMA20.map((value: number, index: number) => ({
              time: currentChartData[index]?.time,
              value: value
            })).filter((item: any) => item.time && item.value > 0)
            ema20Series.setData(ema20Data)
          }

          if (currentIndicatorData.EMA50 && ema50Series) {
            const ema50Data = currentIndicatorData.EMA50.map((value: number, index: number) => ({
              time: currentChartData[index]?.time,
              value: value
            })).filter((item: any) => item.time && item.value > 0)
            ema50Series.setData(ema50Data)
          }

          if (currentIndicatorData.EMA100 && ema100SeriesRef.current) {
            const ema100Data = currentIndicatorData.EMA100.map((value: number, index: number) => ({
              time: currentChartData[index]?.time,
              value: value
            })).filter((item: any) => item.time && item.value > 0)
            ema100SeriesRef.current.setData(ema100Data)
          }

          if (currentIndicatorData.VWAP && vwapSeriesRef.current) {
            const vwapData = currentIndicatorData.VWAP.map((value: number, index: number) => ({
              time: currentChartData[index]?.time,
              value: value
            })).filter((item: any) => item.time && !isNaN(item.value) && item.value !== null)
            vwapSeriesRef.current.setData(vwapData)
          }

          // 重新应用BOLL数据
          if (currentIndicatorData.BOLL) {
            const bollData = currentIndicatorData.BOLL
            if (bollData.upper && bollUpperSeries) {
              const upperData = bollData.upper.map((value: number, index: number) => ({
                time: currentChartData[index]?.time,
                value: value
              })).filter((item: any) => item.time && !isNaN(item.value))
              bollUpperSeries.setData(upperData)
            }
            if (bollData.middle && bollMiddleSeries) {
              const middleData = bollData.middle.map((value: number, index: number) => ({
                time: currentChartData[index]?.time,
                value: value
              })).filter((item: any) => item.time && !isNaN(item.value))
              bollMiddleSeries.setData(middleData)
            }
            if (bollData.lower && bollLowerSeries) {
              const lowerData = bollData.lower.map((value: number, index: number) => ({
                time: currentChartData[index]?.time,
                value: value
              })).filter((item: any) => item.time && !isNaN(item.value))
              bollLowerSeries.setData(lowerData)
            }
          }

          // 重新应用RSI数据 - 应用所有可用的RSI数据
          if (rsiSeries) {
            const rsiSource = resolvedActiveSubplot === 'RSI7' ? currentIndicatorData.RSI7 : currentIndicatorData.RSI14 || currentIndicatorData.RSI7
            const rsiData = (rsiSource || []).map((value: number, index: number) => ({
              time: currentChartData[index]?.time,
              value: value
            })).filter((item: any) => item.time && !isNaN(item.value) && item.value > 0)
            rsiSeries.setData(rsiData)
          }

          // 重新应用MACD数据 - 无条件应用如果数据存在
          if (currentIndicatorData.MACD && macdSeries) {
            const macdData = currentIndicatorData.MACD
            if (macdData.macd && macdSeries.macdLine) {
              const macdLineData = macdData.macd.map((value: number, index: number) => ({
                time: currentChartData[index]?.time,
                value: value
              })).filter((item: any) => item.time && !isNaN(item.value))
              macdSeries.macdLine.setData(macdLineData)
            }
            if (macdData.signal && macdSeries.signalLine) {
              const signalData = macdData.signal.map((value: number, index: number) => ({
                time: currentChartData[index]?.time,
                value: value
              })).filter((item: any) => item.time && !isNaN(item.value))
              macdSeries.signalLine.setData(signalData)
            }
            if (macdData.histogram && macdSeries.histogram) {
              const histogramData = macdData.histogram.map((value: number, index: number) => ({
                time: currentChartData[index]?.time,
                value: value,
                color: value >= 0 ? '#22c55e' : '#ef4444'
              })).filter((item: any) => item.time && !isNaN(item.value))
              macdSeries.histogram.setData(histogramData)
            }
          }

          // 重新应用ATR数据 - 无条件应用如果数据存在
          if (currentIndicatorData.ATR14 && atrSeries) {
            const atrData = currentIndicatorData.ATR14.map((value: number, index: number) => ({
              time: currentChartData[index]?.time,
              value: value
            })).filter((item: any) => item.time && !isNaN(item.value))
            atrSeries.setData(atrData)
          }

          // 重新应用STOCH数据
          if (currentIndicatorData.STOCH && stochSeriesRef.current) {
            const stochData = currentIndicatorData.STOCH
            if (stochData.k && stochSeriesRef.current.stochK) {
              const kData = stochData.k.map((value: number, index: number) => ({
                time: currentChartData[index]?.time,
                value: value
              })).filter((item: any) => item.time && !isNaN(item.value))
              stochSeriesRef.current.stochK.setData(kData)
            }
            if (stochData.d && stochSeriesRef.current.stochD) {
              const dData = stochData.d.map((value: number, index: number) => ({
                time: currentChartData[index]?.time,
                value: value
              })).filter((item: any) => item.time && !isNaN(item.value))
              stochSeriesRef.current.stochD.setData(dData)
            }
          }

          // 重新应用OBV数据
          if (currentIndicatorData.OBV && obvSeriesRef.current) {
            const obvData = currentIndicatorData.OBV.map((value: number, index: number) => ({
              time: currentChartData[index]?.time,
              value: value
            })).filter((item: any) => item.time && !isNaN(item.value))
            obvSeriesRef.current.setData(obvData)
          }
        }

        // 重新应用指标显示状态
        setTimeout(() => {
          const subplotIndicators = selectedIndicators.filter(ind => ['RSI14', 'RSI7', 'MACD', 'ATR14', 'STOCH', 'OBV'].includes(ind))
          const resolvedActiveSubplot = (activeSubplot && subplotIndicators.includes(activeSubplot))
            ? activeSubplot
            : subplotIndicators[0]

          // 主图指标显示状态
          if (ma5Series) ma5Series.applyOptions({ visible: selectedIndicators.includes('MA5') })
          if (ma10Series) ma10Series.applyOptions({ visible: selectedIndicators.includes('MA10') })
          if (ma20Series) ma20Series.applyOptions({ visible: selectedIndicators.includes('MA20') })
          if (ema20Series) ema20Series.applyOptions({ visible: selectedIndicators.includes('EMA20') })
          if (ema50Series) ema50Series.applyOptions({ visible: selectedIndicators.includes('EMA50') })
          if (ema100SeriesRef.current) ema100SeriesRef.current.applyOptions({ visible: selectedIndicators.includes('EMA100') })
          if (vwapSeriesRef.current) vwapSeriesRef.current.applyOptions({ visible: selectedIndicators.includes('VWAP') })

          const showBoll = selectedIndicators.includes('BOLL')
          if (bollUpperSeries) bollUpperSeries.applyOptions({ visible: showBoll })
          if (bollMiddleSeries) bollMiddleSeries.applyOptions({ visible: showBoll })
          if (bollLowerSeries) bollLowerSeries.applyOptions({ visible: showBoll })

          // 子图指标显示状态
          if (rsiSeries) {
            const showRSI = (resolvedActiveSubplot === 'RSI14' || resolvedActiveSubplot === 'RSI7') && selectedIndicators.includes(resolvedActiveSubplot)
            rsiSeries.applyOptions({ visible: showRSI })
          }

          if (macdSeries) {
            const showMACD = resolvedActiveSubplot === 'MACD' && selectedIndicators.includes('MACD')
            if (macdSeries.macdLine) macdSeries.macdLine.applyOptions({ visible: showMACD })
            if (macdSeries.signalLine) macdSeries.signalLine.applyOptions({ visible: showMACD })
            if (macdSeries.histogram) macdSeries.histogram.applyOptions({ visible: showMACD })
          }

          if (atrSeries) {
            const showATR = resolvedActiveSubplot === 'ATR14' && selectedIndicators.includes('ATR14')
            atrSeries.applyOptions({ visible: showATR })
          }

          if (stochSeriesRef.current) {
            const showSTOCH = resolvedActiveSubplot === 'STOCH' && selectedIndicators.includes('STOCH')
            if (stochSeriesRef.current.stochK) stochSeriesRef.current.stochK.applyOptions({ visible: showSTOCH })
            if (stochSeriesRef.current.stochD) stochSeriesRef.current.stochD.applyOptions({ visible: showSTOCH })
          }

          if (obvSeriesRef.current) {
            const showOBV = resolvedActiveSubplot === 'OBV' && selectedIndicators.includes('OBV')
            obvSeriesRef.current.applyOptions({ visible: showOBV })
          }
        }, 0)
      } catch (error) {
        console.error('Chart reinitialization failed:', error)
      }
    }

    prevIndicatorsRef.current = selectedIndicators
  }, [selectedIndicators, chartData, indicatorData, chartType])

  // 更新数据
  useEffect(() => {
    const subplotIndicators = selectedIndicators.filter(ind => ['RSI14', 'RSI7', 'MACD', 'ATR14', 'STOCH', 'OBV'].includes(ind))
    const resolvedActiveSubplot = (activeSubplot && subplotIndicators.includes(activeSubplot))
      ? activeSubplot
      : subplotIndicators[0]

    if (seriesRef.current && volumeSeriesRef.current && chartData.length > 0) {
      // 转换主图数据
      const mainData = convertDataForSeries(chartData, chartType)

      // 成交量数据
      const volumeData = chartData.map(item => ({
        time: item.time,
        value: item.volume || 0,
        color: item.close >= item.open ? '#22c55e' : '#ef4444',
      }))

      // 移动平均线数据
      const ma5Data = calculateMA(chartData, 5)
      const ma10Data = calculateMA(chartData, 10)
      const ma20Data = calculateMA(chartData, 20)

      // 确保数据完全替换，避免重合
      seriesRef.current.setData(mainData)
      volumeSeriesRef.current.setData(volumeData)

      if (ma5SeriesRef.current) ma5SeriesRef.current.setData(ma5Data)
      if (ma10SeriesRef.current) ma10SeriesRef.current.setData(ma10Data)
      if (ma20SeriesRef.current) ma20SeriesRef.current.setData(ma20Data)

      // 渲染技术指标数据
      if (indicatorData.EMA20 && ema20SeriesRef.current) {
        const ema20Data = indicatorData.EMA20.map((value: number, index: number) => ({
          time: chartData[index]?.time,
          value: value
        })).filter((item: any) => item.time && item.value > 0)
        ema20SeriesRef.current.setData(ema20Data)
      }

      if (indicatorData.EMA50 && ema50SeriesRef.current) {
        const ema50Data = indicatorData.EMA50.map((value: number, index: number) => ({
          time: chartData[index]?.time,
          value: value
        })).filter((item: any) => item.time && item.value > 0)
        ema50SeriesRef.current.setData(ema50Data)
      }

      if (indicatorData.EMA100 && ema100SeriesRef.current) {
        const ema100Data = indicatorData.EMA100.map((value: number, index: number) => ({
          time: chartData[index]?.time,
          value: value
        })).filter((item: any) => item.time && item.value > 0)
        ema100SeriesRef.current.setData(ema100Data)
      }

      if (indicatorData.VWAP && vwapSeriesRef.current) {
        const vwapData = indicatorData.VWAP.map((value: number, index: number) => ({
          time: chartData[index]?.time,
          value: value
        })).filter((item: any) => item.time && !isNaN(item.value) && item.value !== null)
        vwapSeriesRef.current.setData(vwapData)
      }

      // 渲染RSI指标 - 根据当前有效子图决定数据源
      if (rsiSeriesRef.current) {
        const rsiSource = resolvedActiveSubplot === 'RSI7' ? indicatorData.RSI7 : indicatorData.RSI14 || indicatorData.RSI7
        const rsiData = (rsiSource || []).map((value: number, index: number) => ({
          time: chartData[index]?.time,
          value: value
        })).filter((item: any) => item.time && !isNaN(item.value) && item.value > 0)
        rsiSeriesRef.current.setData(rsiData)
      }

      // 渲染MACD指标 - 无条件应用如果数据存在
      if (indicatorData.MACD && macdSeriesRef.current) {
        const macdData = indicatorData.MACD
        if (macdData.macd && macdSeriesRef.current.macdLine) {
          const macdLineData = macdData.macd.map((value: number, index: number) => ({
            time: chartData[index]?.time,
            value: value
          })).filter((item: any) => item.time && !isNaN(item.value))
          macdSeriesRef.current.macdLine.setData(macdLineData)
        }
        if (macdData.signal && macdSeriesRef.current.signalLine) {
          const signalData = macdData.signal.map((value: number, index: number) => ({
            time: chartData[index]?.time,
            value: value
          })).filter((item: any) => item.time && !isNaN(item.value))
          macdSeriesRef.current.signalLine.setData(signalData)
        }
        if (macdData.histogram && macdSeriesRef.current.histogram) {
          const histogramData = macdData.histogram.map((value: number, index: number) => ({
            time: chartData[index]?.time,
            value: value,
            color: value >= 0 ? '#22c55e' : '#ef4444'
          })).filter((item: any) => item.time && !isNaN(item.value))
          macdSeriesRef.current.histogram.setData(histogramData)
        }
      }

      // 渲染ATR指标
      if (indicatorData.ATR14 && atrSeriesRef.current) {
        const atrData = indicatorData.ATR14.map((value: number, index: number) => ({
          time: chartData[index]?.time,
          value: value
        })).filter((item: any) => item.time && !isNaN(item.value))
        atrSeriesRef.current.setData(atrData)
      }

      // 渲染STOCH指标
      if (indicatorData.STOCH && stochSeriesRef.current) {
        const stochData = indicatorData.STOCH
        if (stochData.k && stochSeriesRef.current.stochK) {
          const kData = stochData.k.map((value: number, index: number) => ({
            time: chartData[index]?.time,
            value: value
          })).filter((item: any) => item.time && !isNaN(item.value))
          stochSeriesRef.current.stochK.setData(kData)
        }
        if (stochData.d && stochSeriesRef.current.stochD) {
          const dData = stochData.d.map((value: number, index: number) => ({
            time: chartData[index]?.time,
            value: value
          })).filter((item: any) => item.time && !isNaN(item.value))
          stochSeriesRef.current.stochD.setData(dData)
        }
      }

      // 渲染OBV指标
      if (indicatorData.OBV && obvSeriesRef.current) {
        const obvData = indicatorData.OBV.map((value: number, index: number) => ({
          time: chartData[index]?.time,
          value: value
        })).filter((item: any) => item.time && !isNaN(item.value))
        obvSeriesRef.current.setData(obvData)
      }

      // 渲染BOLL布林带
      if (indicatorData.BOLL) {
        const bollData = indicatorData.BOLL
        if (bollData.upper && bollUpperSeriesRef.current) {
          const upperData = bollData.upper.map((value: number, index: number) => ({
            time: chartData[index]?.time,
            value: value
          })).filter((item: any) => item.time && !isNaN(item.value))
          bollUpperSeriesRef.current.setData(upperData)
        }
        if (bollData.middle && bollMiddleSeriesRef.current) {
          const middleData = bollData.middle.map((value: number, index: number) => ({
            time: chartData[index]?.time,
            value: value
          })).filter((item: any) => item.time && !isNaN(item.value))
          bollMiddleSeriesRef.current.setData(middleData)
        }
        if (bollData.lower && bollLowerSeriesRef.current) {
          const lowerData = bollData.lower.map((value: number, index: number) => ({
            time: chartData[index]?.time,
            value: value
          })).filter((item: any) => item.time && !isNaN(item.value))
          bollLowerSeriesRef.current.setData(lowerData)
        }
      }
    }
  }, [chartData, chartType, indicatorData])

  // 控制主图指标显示/隐藏 - 纯UI操作，不重绘图表
  useEffect(() => {
    // 移动平均线
    if (ma5SeriesRef.current) {
      ma5SeriesRef.current.applyOptions({ visible: selectedIndicators.includes('MA5') })
    }
    if (ma10SeriesRef.current) {
      ma10SeriesRef.current.applyOptions({ visible: selectedIndicators.includes('MA10') })
    }
    if (ma20SeriesRef.current) {
      ma20SeriesRef.current.applyOptions({ visible: selectedIndicators.includes('MA20') })
    }

    // EMA指标
    if (ema20SeriesRef.current) {
      ema20SeriesRef.current.applyOptions({ visible: selectedIndicators.includes('EMA20') })
    }
    if (ema50SeriesRef.current) {
      ema50SeriesRef.current.applyOptions({ visible: selectedIndicators.includes('EMA50') })
    }
    if (ema100SeriesRef.current) {
      ema100SeriesRef.current.applyOptions({ visible: selectedIndicators.includes('EMA100') })
    }
    if (vwapSeriesRef.current) {
      vwapSeriesRef.current.applyOptions({ visible: selectedIndicators.includes('VWAP') })
    }

    // BOLL布林带
    const showBoll = selectedIndicators.includes('BOLL')
    if (bollUpperSeriesRef.current) {
      bollUpperSeriesRef.current.applyOptions({ visible: showBoll })
    }
    if (bollMiddleSeriesRef.current) {
      bollMiddleSeriesRef.current.applyOptions({ visible: showBoll })
    }
    if (bollLowerSeriesRef.current) {
      bollLowerSeriesRef.current.applyOptions({ visible: showBoll })
    }
  }, [selectedIndicators])

  // 更新指标 pane 标签
  const updateIndicatorPaneLabel = (labelText: string) => {
    if (indicatorPaneRef.current && indicatorLabelRef.current) {
      // 移除旧标签
      indicatorPaneRef.current.detachPrimitive(indicatorLabelRef.current)
      // 添加新标签
      const newLabel = createPaneLabel(labelText)
      indicatorPaneRef.current.attachPrimitive(newLabel)
      indicatorLabelRef.current = newLabel
    }
  }

  // 控制子图指标显示/隐藏 - 纯UI操作，不重绘图表
  useEffect(() => {
    const subplotIndicators = selectedIndicators.filter(ind => ['RSI14', 'RSI7', 'MACD', 'ATR14', 'STOCH', 'OBV'].includes(ind))
    const resolvedActiveSubplot = (activeSubplot && subplotIndicators.includes(activeSubplot))
      ? activeSubplot
      : subplotIndicators[0]

    // 检测新增的子图指标
    const prevSubplotIndicators = prevSubplotIndicatorsRef.current
    const newlyAddedIndicators = subplotIndicators.filter(ind => !prevSubplotIndicators.includes(ind))

    // 如果有新增的子图指标，自动切换到最新添加的指标
    if (newlyAddedIndicators.length > 0) {
      setActiveSubplot(newlyAddedIndicators[newlyAddedIndicators.length - 1])
    }
    // 设置默认激活的子图（仅在没有activeSubplot且有子图指标时）
    else if (subplotIndicators.length > 0 && !activeSubplot) {
      setActiveSubplot(subplotIndicators[0])
    }
    // 如果当前激活的子图不在选中列表中，切换到第一个可用的
    else if (activeSubplot && !subplotIndicators.includes(activeSubplot) && subplotIndicators.length > 0) {
      setActiveSubplot(subplotIndicators[0])
    }

    // 更新上一次的子图指标列表
    prevSubplotIndicatorsRef.current = subplotIndicators

    // 控制RSI显示
    if (rsiSeriesRef.current) {
      const showRSI = (resolvedActiveSubplot === 'RSI14' || resolvedActiveSubplot === 'RSI7') && selectedIndicators.includes(resolvedActiveSubplot)
      rsiSeriesRef.current.applyOptions({ visible: showRSI })
    }

    // 控制MACD显示
    if (macdSeriesRef.current) {
      const showMACD = resolvedActiveSubplot === 'MACD' && selectedIndicators.includes('MACD')
      if (macdSeriesRef.current.macdLine) {
        macdSeriesRef.current.macdLine.applyOptions({ visible: showMACD })
      }
      if (macdSeriesRef.current.signalLine) {
        macdSeriesRef.current.signalLine.applyOptions({ visible: showMACD })
      }
      if (macdSeriesRef.current.histogram) {
        macdSeriesRef.current.histogram.applyOptions({ visible: showMACD })
      }
    }

    // 控制ATR显示
    if (atrSeriesRef.current) {
      const showATR = resolvedActiveSubplot === 'ATR14' && selectedIndicators.includes('ATR14')
      atrSeriesRef.current.applyOptions({ visible: showATR })
    }

    // 控制STOCH显示
    if (stochSeriesRef.current) {
      const showSTOCH = resolvedActiveSubplot === 'STOCH' && selectedIndicators.includes('STOCH')
      if (stochSeriesRef.current.stochK) {
        stochSeriesRef.current.stochK.applyOptions({ visible: showSTOCH })
      }
      if (stochSeriesRef.current.stochD) {
        stochSeriesRef.current.stochD.applyOptions({ visible: showSTOCH })
      }
    }

    // 控制OBV显示
    if (obvSeriesRef.current) {
      const showOBV = resolvedActiveSubplot === 'OBV' && selectedIndicators.includes('OBV')
      obvSeriesRef.current.applyOptions({ visible: showOBV })
    }

    // 更新指标 pane 标签
    if (resolvedActiveSubplot && subplotIndicators.includes(resolvedActiveSubplot)) {
      updateIndicatorPaneLabel(resolvedActiveSubplot)
    }
  }, [selectedIndicators, activeSubplot])


  // 获取K线数据和指标
  const fetchKlineData = async (forceAllIndicators = false) => {
    if (loading) return

    setLoading(true)
    onIndicatorLoadingChange?.(true)
    onLoadingChange(true)
    try {
      // 始终请求当前选中的指标，避免缓存缺失
      const indicatorsToFetch = selectedIndicators
      const indicatorsParam = indicatorsToFetch.length > 0 ? `&indicators=${indicatorsToFetch.join(',')}` : ''
      const response = await fetch(`/api/market/kline-with-indicators/${symbol}?market=hyperliquid&period=${period}&count=500${indicatorsParam}`)
      const result = await response.json()

      if (result.klines && result.klines.length > 0) {
        const newChartData = result.klines.map((item: any) => ({
          time: formatChartTime(item.timestamp),
          open: item.open || 0,
          high: item.high || 0,
          low: item.low || 0,
          close: item.close || 0,
          volume: item.volume || 0,
        }))

        setChartData(newChartData)

        // 合并新获取的指标数据
        if (result.indicators) {
          setIndicatorData(prev => ({ ...prev, ...result.indicators }))
          setCachedIndicators(prev => [...new Set([...prev, ...indicatorsToFetch])])
        }

        // 通知父组件最新数据，用于 AI 分析启用按钮
        if (onDataUpdate) {
          onDataUpdate(newChartData, result.indicators || {})
        }

        setHasData(true)
      } else {
        setHasData(false)
      }
    } catch (error) {
      console.error('Failed to fetch kline data:', error)
      setHasData(false)
    } finally {
      setLoading(false)
      onLoadingChange(false)
      onIndicatorLoadingChange?.(false)
    }
  }

  // 当symbol或period变化时清空缓存并重新获取数据
  useEffect(() => {
    if (symbol && period) {
      // 立即清空图表数据和缓存
      setHasData(false)
      setChartData([])
      setIndicatorData({})
      setCachedIndicators([])

      // 清空所有series数据，避免新旧数据混合
      if (seriesRef.current) seriesRef.current.setData([])
      if (volumeSeriesRef.current) volumeSeriesRef.current.setData([])
      if (ma5SeriesRef.current) ma5SeriesRef.current.setData([])
      if (ma10SeriesRef.current) ma10SeriesRef.current.setData([])
      if (ma20SeriesRef.current) ma20SeriesRef.current.setData([])
      if (ema20SeriesRef.current) ema20SeriesRef.current.setData([])
      if (ema50SeriesRef.current) ema50SeriesRef.current.setData([])
      if (ema100SeriesRef.current) ema100SeriesRef.current.setData([])
      if (vwapSeriesRef.current) vwapSeriesRef.current.setData([])
      if (bollUpperSeriesRef.current) bollUpperSeriesRef.current.setData([])
      if (bollMiddleSeriesRef.current) bollMiddleSeriesRef.current.setData([])
      if (bollLowerSeriesRef.current) bollLowerSeriesRef.current.setData([])
      if (rsiSeriesRef.current) rsiSeriesRef.current.setData([])
      if (macdSeriesRef.current?.macdLine) macdSeriesRef.current.macdLine.setData([])
      if (macdSeriesRef.current?.signalLine) macdSeriesRef.current.signalLine.setData([])
      if (macdSeriesRef.current?.histogram) macdSeriesRef.current.histogram.setData([])
      if (atrSeriesRef.current) atrSeriesRef.current.setData([])
      if (stochSeriesRef.current?.stochK) stochSeriesRef.current.stochK.setData([])
      if (stochSeriesRef.current?.stochD) stochSeriesRef.current.stochD.setData([])
      if (obvSeriesRef.current) obvSeriesRef.current.setData([])

      // 强制请求所有选中指标
      fetchKlineData(true)
    }
  }, [symbol, period])

  // 当指标选择变化时，检查并获取缺失的指标数据
  useEffect(() => {
    if (symbol && period && selectedIndicators.length > 0) {
      const missingIndicators = selectedIndicators.filter(ind =>
        !cachedIndicators.includes(ind) || !indicatorData[ind]
      )
      if (missingIndicators.length > 0) {
        fetchKlineData()
      }
    }
  }, [selectedIndicators])

  return (
    <div className="relative w-full h-full">


      {/* 图表容器 - 铺满父元素 */}
      <div ref={chartContainerRef} className="w-full h-full" />


      {/* 指标子图切换器 */}
      {(() => {
        const subplotIndicators = selectedIndicators.filter(ind => ['RSI14', 'RSI7', 'MACD', 'ATR14', 'STOCH', 'OBV'].includes(ind))
        if (subplotIndicators.length === 0) return null

        const currentActiveSubplot = activeSubplot || subplotIndicators[0]

        return (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-md p-2 border text-xs">
            <span className="text-muted-foreground">{currentActiveSubplot}</span>
            {subplotIndicators.length > 1 && (
              <select
                value={currentActiveSubplot}
                onChange={(e) => setActiveSubplot(e.target.value)}
                className="bg-transparent border-0 text-xs focus:outline-none cursor-pointer"
              >
                {subplotIndicators.map(indicator => (
                  <option key={indicator} value={indicator}>
                    {indicator}
                  </option>
                ))}
              </select>
            )}
          </div>
        )
      })()}

      {/* 自定义水印 */}
      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground/30 pointer-events-none select-none">
        Hyper Alpha Arena
      </div>


      {!loading && !hasData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">No K-line data available</p>
            <p className="text-sm">Click "Backfill Historical Data" to fetch data</p>
          </div>
        </div>
      )}
    </div>
  )
}
