import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  CanFrame,
  DbcMessage,
  DbcSignal,
  BusStats,
  SignalHealthScore,
  SignalHealthMetrics,
  CollectionStage,
  HealthSummary
} from '../types';
import { parseDbc, decodeCanFrame, DEFAULT_DBC_CONTENT } from '../utils/dbc-parser';

let frameIdCounter = 0;

export const useCanBusStore = defineStore('canbus', () => {
  const frames = ref<CanFrame[]>([]);
  const signals = ref<Map<string, { name: string; data: { time: number; value: number }[] }>>(new Map());
  const dbcMessages = ref<Map<number, DbcMessage>>(new Map());
  const filterId = ref('');
  const filterText = ref('');
  const isCapturing = ref(false);
  const pollInterval = ref<number | null>(null);

  const busStats = ref<BusStats>({
    totalFrames: 0,
    rxCount: 0,
    txCount: 0,
    errorCount: 0,
    busLoad: 0,
    lastUpdate: Date.now()
  });

  const filteredFrames = computed(() => {
    let result = frames.value;

    if (filterId.value.trim()) {
      const idFilter = filterId.value.trim().toLowerCase().replace(/^0x/, '');
      result = result.filter(f =>
        f.arbitrationId.toString(16).toLowerCase().includes(idFilter)
      );
    }

    if (filterText.value.trim()) {
      const textFilter = filterText.value.trim().toLowerCase();
      result = result.filter(f => {
        if (f.arbitrationId.toString(16).toLowerCase().includes(textFilter)) return true;
        if (f.data.toLowerCase().includes(textFilter)) return true;
        for (const key of Object.keys(f.decoded)) {
          if (key.toLowerCase().includes(textFilter)) return true;
        }
        return false;
      });
    }

    return result;
  });

  const busLoadPercent = computed(() => {
    return busStats.value.busLoad.toFixed(1);
  });

  function addFrame(frame: CanFrame) {
    frames.value.push(frame);
    if (frames.value.length > 500) {
      frames.value = frames.value.slice(-500);
    }

    busStats.value.totalFrames++;
    if (frame.direction === 'RX') busStats.value.rxCount++;
    else busStats.value.txCount++;
    busStats.value.lastUpdate = Date.now();

    // Update signal history
    const msgDef = dbcMessages.value.get(frame.arbitrationId);
    if (msgDef) {
      const decoded = decodeCanFrame(frame, msgDef);
      frame.decoded = decoded;
      for (const [name, value] of Object.entries(decoded)) {
        if (!signals.value.has(name)) {
          signals.value.set(name, { name, data: [] });
        }
        const sig = signals.value.get(name)!;
        sig.data.push({ time: frame.timestamp, value });
        if (sig.data.length > 100) {
          sig.data = sig.data.slice(-100);
        }
      }
    }

    // Simulate bus load (random 15-45%)
    busStats.value.busLoad = 15 + Math.random() * 30;
  }

  function clearFrames() {
    frames.value = [];
    signals.value = new Map();
    busStats.value = {
      totalFrames: 0,
      rxCount: 0,
      txCount: 0,
      errorCount: 0,
      busLoad: 0,
      lastUpdate: Date.now()
    };
    frameIdCounter = 0;
  }

  function loadMockDbc() {
    parseAndLoadDbc(DEFAULT_DBC_CONTENT);
  }

  function parseAndLoadDbc(text: string) {
    dbcMessages.value = parseDbc(text);
  }

  function generateMockFrame(): CanFrame {
    const messageIds = Array.from(dbcMessages.value.keys());
    const arbId = messageIds.length > 0
      ? messageIds[Math.floor(Math.random() * messageIds.length)]
      : 0x7DF;

    const msgDef = dbcMessages.value.get(arbId);

    // Generate realistic OBD-II values
    const rpm = Math.floor(800 + Math.random() * 5200);
    const speed = Math.floor(Math.random() * 120);
    const temp = Math.floor(70 + Math.random() * 35);
    const throttle = Math.floor(Math.random() * 100);
    const load = Math.floor(Math.random() * 100);

    // Encode values into bytes (simplified encoding for display)
    const rpmRaw = Math.round(rpm / 0.25);
    const rpmLow = rpmRaw & 0xFF;
    const rpmHigh = (rpmRaw >> 8) & 0xFF;
    const speedByte = speed & 0xFF;
    const tempByte = (temp + 40) & 0xFF;
    const throttleByte = Math.round(throttle / 0.392) & 0xFF;
    const loadByte = Math.round(load / 0.392) & 0xFF;

    const dataBytes = [rpmLow, rpmHigh, speedByte, tempByte, throttleByte, loadByte, 0x00, 0x00];
    const dataHex = dataBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    const frame: CanFrame = {
      id: `frame-${++frameIdCounter}`,
      timestamp: Date.now(),
      arbitrationId: arbId,
      dlc: 8,
      data: dataHex,
      decoded: {},
      direction: Math.random() > 0.3 ? 'RX' : 'TX'
    };

    if (msgDef) {
      frame.decoded = {
        EngineRPM: rpm,
        VehicleSpeed: speed,
        CoolantTemp: temp,
        ThrottlePosition: throttle,
        EngineLoad: load
      };
    }

    return frame;
  }

  function startCapture() {
    if (isCapturing.value) return;
    isCapturing.value = true;

    // Load mock DBC if not loaded
    if (dbcMessages.value.size === 0) {
      loadMockDbc();
    }

    pollInterval.value = window.setInterval(() => {
      const frame = generateMockFrame();
      addFrame(frame);
    }, 200);
  }

  function stopCapture() {
    isCapturing.value = false;
    if (pollInterval.value !== null) {
      clearInterval(pollInterval.value);
      pollInterval.value = null;
    }
  }

  function decodeFrame(frame: CanFrame): Record<string, number> {
    const msgDef = dbcMessages.value.get(frame.arbitrationId);
    if (!msgDef) return {};
    return decodeCanFrame(frame, msgDef);
  }

  function exportFrames(): string {
    const header = 'Timestamp,Direction,CAN_ID,DLC,Data,Decoded\n';
    const rows = frames.value.map(f => {
      const decodedStr = Object.entries(f.decoded)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      return `${f.timestamp},${f.direction},0x${f.arbitrationId.toString(16).toUpperCase()},${f.dlc},"${f.data}","${decodedStr}"`;
    }).join('\n');
    return header + rows;
  }

  function getSignalRange(signalName: string): { min: number; max: number; unit: string } {
    const ranges: Record<string, { min: number; max: number; unit: string }> = {
      EngineRPM: { min: 0, max: 16383.75, unit: 'rpm' },
      VehicleSpeed: { min: 0, max: 255, unit: 'km/h' },
      CoolantTemp: { min: -40, max: 215, unit: '°C' },
      ThrottlePosition: { min: 0, max: 100, unit: '%' },
      EngineLoad: { min: 0, max: 100, unit: '%' }
    };
    return ranges[signalName] || { min: 0, max: 100, unit: '' };
  }

  function calculateMetrics(
    data: { time: number; value: number }[],
    signalName: string
  ): SignalHealthMetrics {
    if (data.length === 0) {
      return {
        fluctuation: 0,
        overLimitCount: 0,
        abnormalDuration: 0,
        averageValue: 0,
        maxValue: 0,
        minValue: 0,
        sampleCount: 0
      };
    }

    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const avgVal = values.reduce((a, b) => a + b, 0) / values.length;

    const range = getSignalRange(signalName);
    const totalRange = range.max - range.min;
    const fluctuation = totalRange > 0 ? ((maxVal - minVal) / totalRange) * 100 : 0;

    const safeMin = range.min + totalRange * 0.05;
    const safeMax = range.max - totalRange * 0.05;
    let overLimitCount = 0;
    for (const v of values) {
      if (v < safeMin || v > safeMax) overLimitCount++;
    }

    let abnormalDuration = 0;
    let inAbnormal = false;
    let abnormalStart = 0;
    for (const d of data) {
      const isAbnormal = d.value < safeMin || d.value > safeMax;
      if (isAbnormal && !inAbnormal) {
        inAbnormal = true;
        abnormalStart = d.time;
      } else if (!isAbnormal && inAbnormal) {
        inAbnormal = false;
        abnormalDuration += d.time - abnormalStart;
      }
    }
    if (inAbnormal && data.length > 0) {
      abnormalDuration += data[data.length - 1].time - abnormalStart;
    }

    return {
      fluctuation: Math.round(fluctuation * 10) / 10,
      overLimitCount,
      abnormalDuration: Math.round(abnormalDuration / 1000 * 10) / 10,
      averageValue: Math.round(avgVal * 10) / 10,
      maxValue: Math.round(maxVal * 10) / 10,
      minValue: Math.round(minVal * 10) / 10,
      sampleCount: data.length
    };
  }

  function getStageData(
    data: { time: number; value: number }[],
    stage: CollectionStage
  ): { time: number; value: number }[] {
    const now = Date.now();
    const durations: Record<CollectionStage, number> = {
      recent: 10 * 1000,
      midterm: 30 * 1000,
      longterm: 60 * 1000
    };
    const cutoff = now - durations[stage];
    return data.filter(d => d.time >= cutoff);
  }

  function calculateScore(metrics: SignalHealthMetrics): number {
    if (metrics.sampleCount === 0) return 100;

    let score = 100;

    const fluctuationPenalty = Math.min(30, metrics.fluctuation * 0.4);
    score -= fluctuationPenalty;

    const overLimitPenalty = Math.min(35, metrics.overLimitCount * 2);
    score -= overLimitPenalty;

    const abnormalPenalty = Math.min(35, metrics.abnormalDuration * 0.8);
    score -= abnormalPenalty;

    return Math.max(0, Math.round(score));
  }

  function getRiskLevel(score: number): 'healthy' | 'warning' | 'critical' {
    if (score >= 70) return 'healthy';
    if (score >= 40) return 'warning';
    return 'critical';
  }

  const healthScores = computed<SignalHealthScore[]>(() => {
    const result: SignalHealthScore[] = [];
    const stages: CollectionStage[] = ['recent', 'midterm', 'longterm'];

    for (const [name, sig] of signals.value.entries()) {
      const stageMetrics: Record<CollectionStage, SignalHealthMetrics> = {
        recent: { fluctuation: 0, overLimitCount: 0, abnormalDuration: 0, averageValue: 0, maxValue: 0, minValue: 0, sampleCount: 0 },
        midterm: { fluctuation: 0, overLimitCount: 0, abnormalDuration: 0, averageValue: 0, maxValue: 0, minValue: 0, sampleCount: 0 },
        longterm: { fluctuation: 0, overLimitCount: 0, abnormalDuration: 0, averageValue: 0, maxValue: 0, minValue: 0, sampleCount: 0 }
      };

      for (const stage of stages) {
        const stageData = getStageData(sig.data, stage);
        stageMetrics[stage] = calculateMetrics(stageData, name);
      }

      const overallScore = calculateScore(stageMetrics.longterm);
      const range = getSignalRange(name);
      const currentValue = sig.data.length > 0 ? sig.data[sig.data.length - 1].value : 0;

      result.push({
        signalName: name,
        unit: range.unit,
        overallScore,
        riskLevel: getRiskLevel(overallScore),
        stages: stageMetrics,
        currentValue: Math.round(currentValue * 10) / 10,
        lastUpdate: Date.now()
      });
    }

    result.sort((a, b) => a.overallScore - b.overallScore);
    return result;
  });

  const healthSummary = computed<HealthSummary>(() => {
    const scores = healthScores.value;
    const total = scores.length;
    const healthy = scores.filter(s => s.riskLevel === 'healthy').length;
    const warning = scores.filter(s => s.riskLevel === 'warning').length;
    const critical = scores.filter(s => s.riskLevel === 'critical').length;
    const avgScore = total > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.overallScore, 0) / total)
      : 0;

    return {
      totalSignals: total,
      healthyCount: healthy,
      warningCount: warning,
      criticalCount: critical,
      averageScore: avgScore,
      topRisks: scores.filter(s => s.riskLevel !== 'healthy').slice(0, 5)
    };
  });

  return {
    frames,
    signals,
    dbcMessages,
    filterId,
    filterText,
    busStats,
    isCapturing,
    filteredFrames,
    busLoadPercent,
    healthScores,
    healthSummary,
    addFrame,
    clearFrames,
    loadMockDbc,
    parseAndLoadDbc,
    startCapture,
    stopCapture,
    decodeFrame,
    exportFrames
  };
});
